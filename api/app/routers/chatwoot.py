from fastapi import APIRouter, Depends, HTTPException, Request
from fastapi.responses import JSONResponse
from sqlalchemy.orm import Session
from typing import Optional
import json
import logging

from ..database import get_db
from ..config import settings
from ..models import Store
from ..services.chatwoot_service import handle_incoming_message
from ..services.shopify_auth import normalize_domain

logger = logging.getLogger(__name__)

router = APIRouter(tags=["chatwoot"])


@router.post("/chatwoot/webhook", include_in_schema=False)
async def chatwoot_webhook(request: Request, db: Session = Depends(get_db)):
    body_bytes = await request.body()
    try:
        payload = json.loads(body_bytes or "{}")
    except Exception:
        return JSONResponse({"status": "bad_json"}, status_code=400)
    event = payload.get("event") or payload.get("type")
    conversation = payload.get("conversation") or payload.get("conversation_additional_attributes") or {}
    if event in ("conversation_status_changed", "conversation_updated", "conversation_resolved"):
        conv_id = conversation.get("id") or payload.get("id")
        conv_disp_id = conversation.get("display_id")
        target_id = conv_disp_id or conv_id
        status_val = str(conversation.get("status") or payload.get("status") or "").lower()
        if target_id and status_val in ("resolved", "1", "closed"):
            from ..models import Conversation
            from sqlalchemy import or_
            try:
                t_int = int(target_id)
                conv = db.execute(
                    select(Conversation).where(
                        or_(
                            Conversation.display_id == t_int,
                            Conversation.id == t_int,
                            Conversation.chatwoot_conversation_id == t_int,
                        )
                    )
                ).scalars().first()
                if conv:
                    conv.escalated = False
                    conv.status = 0
                    db.add(conv)
                    db.commit()
                    logger.info(f"Conversation {conv.id} marked resolved. De-escalated for AI agent.")
                    return JSONResponse({"status": "de_escalated", "conversation_id": conv.id})
            except Exception as e:
                logger.warning(f"Error de-escalating conversation: {e}")
        return JSONResponse({"status": "status_change_recorded", "event": event})
    if event not in ("message_created", "conversation_created"):
        return JSONResponse({"status": "ignored", "event": event})
    message = payload.get("message") or payload

    msg_type = str(message.get("message_type") if message.get("message_type") is not None else payload.get("message_type", "")).lower()
    if msg_type not in ("incoming", "0"):
        return JSONResponse({"status": "ignored_non_incoming", "message_type": msg_type})

    if message.get("private") or payload.get("private"):
        return JSONResponse({"status": "ignored_private"})

    content_type = str(message.get("content_type") or payload.get("content_type") or "").lower()
    if content_type in ("form", "input_email", "input_select", "cards", "article"):
        return JSONResponse({"status": "ignored_system_interactive_prompt"})

    sender = message.get("sender") or payload.get("sender") or {}
    sender_type = str(message.get("sender_type") or payload.get("sender_type") or sender.get("type") or "").lower()
    if sender_type and sender_type != "contact":
        return JSONResponse({"status": "ignored_non_contact", "sender_type": sender_type})

    content = message.get("content") or payload.get("content") or ""
    if not content or not str(content).strip():
        return JSONResponse({"status": "empty_content"})

    inbox = payload.get("inbox") or message.get("inbox") or {}
    inbox_id = inbox.get("id") or conversation.get("inbox_id") or message.get("inbox_id")
    conv_id = conversation.get("id") or message.get("conversation_id") or payload.get("conversation_id")
    msg_id = message.get("id") or payload.get("id")
    if msg_id:
        from ..services.ai_agent import _get_redis_client
        r = _get_redis_client()
        if r:
            dedup_key = f"solact:dedup:cw_msg:{msg_id}"
            if not r.set(dedup_key, "1", nx=True, ex=60):
                logger.info(f"Ignoring duplicate Chatwoot message msg_id={msg_id}")
                return JSONResponse({"status": "ignored_duplicate_msg", "msg_id": msg_id})
    disp_id = conversation.get("display_id")
    conversation_attrs = conversation.get("additional_attributes") or {}
    meta = payload.get("contact_inbox") or payload.get("contact") or {}
    contact = payload.get("contact") or sender
    customer_email = contact.get("email")
    customer_phone = contact.get("phone_number")
    customer_name = contact.get("name")
    store_domain = conversation_attrs.get("source", {}).get("shopify_domain") if isinstance(conversation_attrs, dict) else None
    store = None
    if store_domain:
        try:
            sd = normalize_domain(store_domain)
            store = db.query(Store).filter(Store.shopify_domain == sd).first()
        except Exception:
            pass
    if not store and (conv_id or inbox_id):
        from ..models import Conversation
        from sqlalchemy import or_, select
        conds = []
        if conv_id:
            try:
                conds.append(Conversation.chatwoot_conversation_id == int(conv_id))
            except Exception:
                pass
        if inbox_id:
            try:
                conds.append(Conversation.chatwoot_inbox_id == int(inbox_id))
            except Exception:
                pass
        if conds:
            prev_conv = db.execute(select(Conversation).where(or_(*conds)).limit(1)).scalar_one_or_none()
            if prev_conv:
                store = db.get(Store, prev_conv.store_id)
    if not store:
        inbox_name = str(inbox.get("name") or "")
        from sqlalchemy import select
        stores = db.execute(select(Store).where(Store.is_connected == True)).scalars().all()
        for s in stores:
            if s.shopify_domain and (s.shopify_domain.lower() in inbox_name.lower()):
                store = s
                break
            if s.name and (s.name.lower() in inbox_name.lower()):
                store = s
                break
        if not store and stores:
            store = stores[0]
    if not store:
        return JSONResponse({"status": "no_store_matched", "event": event}, status_code=200)
    conv_key = f"cw:{conv_id or msg_id or 'x'}"
    logger.info(f"Received Chatwoot message: '{content[:50]}' (conv_id={conv_id}, disp_id={disp_id}, inbox_id={inbox_id}, msg_id={msg_id})")
    try:
        result = handle_incoming_message(
            db, store, conv_key, content,
            chatwoot_conversation_id=int(conv_id) if conv_id else None,
            chatwoot_inbox_id=int(inbox_id) if inbox_id else None,
            chatwoot_display_id=int(disp_id) if disp_id else None,
            chatwoot_message_id=int(msg_id) if msg_id else None,
            customer_email=customer_email,
            customer_phone=customer_phone,
            customer_name=customer_name,
        )
        logger.info(f"Chatwoot handle_incoming_message result: {result}")
        return JSONResponse({"status": "ok", **result})
    except Exception as e:
        logger.exception(f"Error handling Chatwoot message: {e}")
        return JSONResponse({"status": "error", "error": str(e)}, status_code=500)


from ..dependencies.auth import get_current_user
from ..models import User, Conversation, AIRun
from sqlalchemy import func
from pydantic import BaseModel
from typing import List


class SupportScheduleUpdate(BaseModel):
    store_id: Optional[int] = None
    support_hours_enabled: bool = True
    support_hours_start: str = "09:00"
    support_hours_end: str = "18:00"
    support_timezone: str = "UTC"
    support_days: List[int] = [1, 2, 3, 4, 5]
    offline_escalation_message: Optional[str] = None


@router.get("/chatwoot/agents-overview")
def get_agents_overview(
    store_id: Optional[int] = None,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    from ..services.chatwoot_service import ChatwootClient
    from ..routers.store_settings import get_store_settings_dict

    # Find target store
    target_store = None
    if store_id:
        target_store = db.query(Store).filter(Store.id == store_id).first()
    if not target_store:
        target_store = db.query(Store).filter(Store.organization_id == user.organization_id).first()

    # 1. Fetch real agents
    cw = ChatwootClient()
    raw_agents = []
    if cw.is_configured():
        raw_agents = cw.get_agents()

    formatted_agents = []
    if raw_agents:
        for a in raw_agents:
            formatted_agents.append({
                "id": a.get("id"),
                "name": a.get("name") or a.get("email") or "Chatwoot Agent",
                "email": a.get("email") or "agent@solact.in",
                "role": a.get("role") or "agent",
                "status": a.get("availability_status") or "online",
                "assigned_conversations": a.get("active_conversations") or 0,
                "channel": "Shopify Storefront & Email",
            })
    else:
        # Real fallback: organization team members from DB
        org_users = db.query(User).filter(User.organization_id == user.organization_id).all()
        for u in org_users:
            formatted_agents.append({
                "id": u.id,
                "name": u.name or u.email.split("@")[0].title(),
                "email": u.email,
                "role": u.role or "owner",
                "status": "online" if u.is_active else "offline",
                "assigned_conversations": 0,
                "channel": "Shopify Storefront & Email",
            })

    # 2. Fetch real escalations from DB
    escalated_convs = db.query(Conversation).filter(
        Conversation.organization_id == user.organization_id,
        Conversation.escalated == True,
    ).order_by(Conversation.updated_at.desc()).limit(15).all()

    formatted_escalations = []
    for c in escalated_convs:
        formatted_escalations.append({
            "id": f"ESC-{c.id}",
            "customer": c.customer_name or c.customer_email or f"Customer #{c.customer_id or c.id}",
            "customer_email": c.customer_email or "—",
            "order": f"#{c.identified_order_id}" if c.identified_order_id else "General Inquiry",
            "reason": c.escalated_reason or "Customer requested human support",
            "assigned_agent": formatted_agents[0]["name"] if formatted_agents else "Support Lead",
            "status": "Awaiting Human" if c.status == 2 else "Resolved",
            "time": c.updated_at.strftime("%b %d, %H:%M") if c.updated_at else "Recent",
        })

    # 3. Calculate real metrics
    total_convs = db.query(func.count(Conversation.id)).filter(
        Conversation.organization_id == user.organization_id
    ).scalar() or 0
    escalated_count = db.query(func.count(Conversation.id)).filter(
        Conversation.organization_id == user.organization_id,
        Conversation.escalated == True,
    ).scalar() or 0
    deflected_count = max(total_convs - escalated_count, 0)
    deflection_rate = round((deflected_count / total_convs) * 100, 1) if total_convs > 0 else 0.0
    escalated_rate = round((escalated_count / total_convs) * 100, 1) if total_convs > 0 else 0.0

    # Compute real AI latency if runs exist
    real_latency_ms = None
    try:
        from ..models import AIRun
        avg_s = db.query(func.avg(func.extract('epoch', AIRun.completed_at - AIRun.started_at))).filter(
            AIRun.organization_id == user.organization_id,
            AIRun.completed_at.is_not(None),
            AIRun.started_at.is_not(None)
        ).scalar()
        if avg_s and avg_s > 0:
            real_latency_ms = f"{int(avg_s * 1000)} ms"
    except Exception:
        pass

    # 4. Schedule settings
    sid = target_store.id if target_store else 1
    sched = get_store_settings_dict(sid)

    return {
        "chatwoot_url": settings.CHATWOOT_URL,
        "agents": formatted_agents,
        "escalations": formatted_escalations,
        "metrics": {
            "deflection_rate": f"{deflection_rate}%",
            "escalated_rate": f"{escalated_rate}%",
            "total_conversations": total_convs,
            "escalated_conversations": escalated_count,
            "avg_latency": real_latency_ms or "—",
            "active_inboxes": "Shopify Web + Email",
        },
        "schedule": {
            "enabled": sched.get("support_hours_enabled", True),
            "start": sched.get("support_hours_start", "09:00"),
            "end": sched.get("support_hours_end", "18:00"),
            "timezone": sched.get("support_timezone", "UTC"),
            "days": sched.get("support_days", [1, 2, 3, 4, 5]),
            "offline_message": sched.get("offline_escalation_message"),
        },
    }


@router.put("/chatwoot/support-schedule")
def update_support_schedule(
    payload: SupportScheduleUpdate,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    from ..routers.store_settings import get_store_settings_dict, _get_redis
    target_store = None
    if payload.store_id:
        target_store = db.query(Store).filter(Store.id == payload.store_id).first()
    if not target_store:
        target_store = db.query(Store).filter(Store.organization_id == user.organization_id).first()
    if not target_store:
        raise HTTPException(status_code=404, detail="Store not found")

    sid = target_store.id
    current_cfg = get_store_settings_dict(sid)
    current_cfg["support_hours_enabled"] = payload.support_hours_enabled
    current_cfg["support_hours_start"] = payload.support_hours_start
    current_cfg["support_hours_end"] = payload.support_hours_end
    current_cfg["support_timezone"] = payload.support_timezone
    current_cfg["support_days"] = payload.support_days
    if payload.offline_escalation_message:
        current_cfg["offline_escalation_message"] = payload.offline_escalation_message

    r = _get_redis()
    if r:
        r.set(f"solact:store_settings:{sid}", json.dumps(current_cfg))

    return {"status": "updated", "schedule": current_cfg}
