import logging
import json
import re
from typing import Optional, Dict, Any, List
from datetime import datetime
from sqlalchemy.orm import Session
from sqlalchemy import select, and_, or_
import httpx

from ..config import settings
from ..models import (
    Store, Conversation, Message, MessageRole, ConversationStatus,
    Customer, RunStatus,
)
from .ai_agent import run_ai_employee
from .tools import _find_customer

logger = logging.getLogger(__name__)


class ChatwootClient:
    def __init__(self):
        self.base_url = settings.CHATWOOT_URL.rstrip("/")
        self.token = settings.CHATWOOT_API_TOKEN
        self.account_id = settings.CHATWOOT_ACCOUNT_ID

    def is_configured(self) -> bool:
        return bool(self.base_url) and bool(self.token) and bool(self.account_id)

    def _headers(self):
        return {
            "api_access_token": self.token,
            "Content-Type": "application/json",
            "Accept": "application/json",
        }

    def _url(self, path: str) -> str:
        return f"{self.base_url}/api/v1/accounts/{self.account_id}{path}"

    def _post(self, path: str, data: dict) -> dict:
        r = httpx.post(self._url(path), headers=self._headers(), json=data, timeout=30)
        r.raise_for_status()
        return r.json() if r.content else {}

    def _patch(self, path: str, data: dict) -> dict:
        r = httpx.patch(self._url(path), headers=self._headers(), json=data, timeout=30)
        r.raise_for_status()
        return r.json() if r.content else {}

    def _get(self, path: str) -> dict:
        r = httpx.get(self._url(path), headers=self._headers(), timeout=30)
        r.raise_for_status()
        return r.json() if r.content else {}

    def send_message(self, inbox_id: int, conversation_id: int, content: str, private: bool = False) -> dict:
        return self._post(f"/conversations/{conversation_id}/messages", {
            "content": content,
            "private": private,
        })

    def assign_agent(self, conversation_id: int, agent_id: Optional[int] = None) -> dict:
        payload = {"assignee_id": agent_id} if agent_id else {}
        return self._post(f"/conversations/{conversation_id}/assignments", payload)

    def update_status(self, conversation_id: int, status: str = "open") -> dict:
        return self._post(f"/conversations/{conversation_id}/toggle_status", {"status": status})

    def add_label(self, conversation_id: int, label: str) -> dict:
        try:
            return self._post(f"/conversations/{conversation_id}/labels", {"labels": [label]})
        except Exception:
            return {}

    def toggle_typing_status(self, conversation_id: int, typing_status: str = "on") -> dict:
        try:
            return self._post(f"/conversations/{conversation_id}/toggle_typing_status", {
                "typing_status": typing_status,
            })
        except Exception as e:
            logger.debug(f"Chatwoot toggle typing status failed: {e}")
            return {}


def get_or_create_conversation(
    db: Session,
    store: Store,
    conversation_key: str,
    chatwoot_conversation_id: Optional[int] = None,
    chatwoot_inbox_id: Optional[int] = None,
    chatwoot_display_id: Optional[int] = None,
    customer_email: Optional[str] = None,
    customer_phone: Optional[str] = None,
    customer_name: Optional[str] = None,
) -> Conversation:
    conv = None
    target_cw_id = chatwoot_display_id or chatwoot_conversation_id
    if target_cw_id:
        conv = db.execute(
            select(Conversation).where(
                or_(
                    Conversation.display_id == target_cw_id,
                    Conversation.id == target_cw_id,
                    Conversation.chatwoot_conversation_id == target_cw_id,
                )
            ).order_by((Conversation.display_id == target_cw_id).desc())
        ).scalars().first()
    if not conv:
        q = select(Conversation).where(
            or_(
                Conversation.conversation_key == conversation_key,
                (Conversation.chatwoot_conversation_id == target_cw_id) if target_cw_id else False,
            )
        )
        conv = db.execute(q).scalars().first()

    if conv:
        changed = False
        if not conv.store_id:
            conv.store_id = store.id
            changed = True
        if not conv.organization_id:
            conv.organization_id = store.organization_id
            changed = True
        if chatwoot_conversation_id and not conv.chatwoot_conversation_id:
            conv.chatwoot_conversation_id = chatwoot_conversation_id
            changed = True
        if chatwoot_display_id and conv.display_id != chatwoot_display_id:
            conv.display_id = chatwoot_display_id
            changed = True
        if chatwoot_inbox_id and not conv.chatwoot_inbox_id:
            conv.chatwoot_inbox_id = chatwoot_inbox_id
            changed = True
        if customer_name and not conv.customer_name:
            conv.customer_name = customer_name
            changed = True
        if customer_email and not conv.customer_email:
            conv.customer_email = customer_email
            changed = True
        if customer_phone and not conv.customer_phone:
            conv.customer_phone = customer_phone
            changed = True
        if changed:
            db.add(conv)
            db.commit()
            db.refresh(conv)
        return conv

    customer = None
    if customer_email or customer_phone:
        customer = _find_customer(db, store.id, email=customer_email, phone=customer_phone)

    from sqlalchemy import func
    max_disp = db.execute(select(func.coalesce(func.max(Conversation.display_id), 0)).where(Conversation.account_id == 1)).scalar_one() or 0

    conv = Conversation(
        organization_id=store.organization_id,
        store_id=store.id,
        account_id=1,
        inbox_id=chatwoot_inbox_id or 1,
        display_id=max_disp + 1,
        conversation_key=conversation_key,
        chatwoot_conversation_id=chatwoot_conversation_id,
        chatwoot_inbox_id=chatwoot_inbox_id,
        customer_id=customer.id if customer else None,
        customer_name=customer_name or (customer and f"{customer.first_name or ''} {customer.last_name or ''}".strip()) or None,
        customer_email=customer_email or (customer and customer.email),
        customer_phone=customer_phone or (customer and customer.phone),
        status=ConversationStatus.open,
    )
    db.add(conv)
    db.commit()
    db.refresh(conv)
    return conv


def add_customer_message(
    db: Session,
    conversation: Conversation,
    content: str,
    chatwoot_message_id: Optional[int] = None,
    external_id: Optional[str] = None,
) -> Message:
    if chatwoot_message_id:
        existing = db.get(Message, chatwoot_message_id)
        if existing:
            existing.organization_id = conversation.organization_id
            existing.role = MessageRole.customer
            existing.external_id = external_id
            db.add(existing)
            conversation.last_message_at = datetime.utcnow()
            db.add(conversation)
            db.commit()
            return existing

    msg = Message(
        organization_id=conversation.organization_id,
        conversation_id=conversation.id,
        account_id=getattr(conversation, "account_id", 1) or 1,
        inbox_id=getattr(conversation, "inbox_id", 1) or getattr(conversation, "chatwoot_inbox_id", 1) or 1,
        message_type=0,
        content_type=0,
        private=False,
        chatwoot_message_id=chatwoot_message_id,
        role=MessageRole.customer,
        content=content,
        external_id=external_id,
    )
    db.add(msg)
    conversation.last_message_at = datetime.utcnow()
    db.add(conversation)
    db.commit()
    db.refresh(msg)
    return msg


def add_ai_message(
    db: Session,
    conversation: Conversation,
    content: str,
    ai_run_id: Optional[int] = None,
    chatwoot_message_id: Optional[int] = None,
) -> Message:
    if chatwoot_message_id:
        existing = db.get(Message, chatwoot_message_id)
        if existing:
            existing.organization_id = conversation.organization_id
            existing.role = MessageRole.ai
            existing.ai_run_id = ai_run_id
            db.add(existing)
            conversation.last_message_at = datetime.utcnow()
            conversation.ai_reply_count = (conversation.ai_reply_count or 0) + 1
            db.add(conversation)
            db.commit()
            return existing

    msg = Message(
        organization_id=conversation.organization_id,
        conversation_id=conversation.id,
        account_id=getattr(conversation, "account_id", 1) or 1,
        inbox_id=getattr(conversation, "inbox_id", 1) or getattr(conversation, "chatwoot_inbox_id", 1) or 1,
        message_type=1,
        content_type=0,
        private=False,
        chatwoot_message_id=chatwoot_message_id,
        role=MessageRole.ai,
        content=content,
        ai_run_id=ai_run_id,
    )
    db.add(msg)
    conversation.last_message_at = datetime.utcnow()
    conversation.ai_reply_count = (conversation.ai_reply_count or 0) + 1
    db.add(conversation)
    db.commit()
    db.refresh(msg)
    return msg


def get_available_agents(db: Session, inbox_id: Optional[int] = 1) -> List[Dict[str, Any]]:
    try:
        from sqlalchemy import text
        rows = db.execute(
            text("""
                SELECT u.id, u.name 
                FROM users u
                JOIN inbox_members im ON u.id = im.user_id
                WHERE im.inbox_id = :inbox_id AND u.availability = 0
                ORDER BY u.id ASC
            """),
            {"inbox_id": inbox_id or 1}
        ).fetchall()
        if rows:
            return [{"id": r[0], "name": r[1]} for r in rows]
        rows = db.execute(text("SELECT id, name FROM users WHERE availability = 0 ORDER BY id ASC")).fetchall()
        return [{"id": r[0], "name": r[1]} for r in rows]
    except Exception as e:
        logger.warning(f"Failed to check available agents: {e}")
        return []


def escalate_conversation(
    db: Session,
    conversation: Conversation,
    reason: Optional[str] = None,
    assign_to_agent_id: Optional[int] = None,
) -> Conversation:
    conversation.status = ConversationStatus.awaiting_human
    conversation.escalated = True
    conversation.escalated_reason = reason
    conversation.escalated_at = datetime.utcnow()
    db.add(conversation)
    db.commit()
    db.refresh(conversation)

    cw_id = conversation.display_id or conversation.chatwoot_conversation_id or conversation.id
    if cw_id:
        cw = ChatwootClient()
        if cw.is_configured():
            try:
                cw.add_label(cw_id, "needs-human")
                cw.update_status(cw_id, "open")
                if assign_to_agent_id:
                    cw.assign_agent(cw_id, assign_to_agent_id)
                if reason:
                    cw.send_message(
                        conversation.chatwoot_inbox_id or 1,
                        cw_id,
                        f"[Auto-escalated to human team] Reason: {reason}",
                        private=True,
                    )
            except Exception as e:
                logger.warning(f"Chatwoot escalate failed: {e}")
    return conversation


def handle_incoming_message(
    db: Session,
    store: Store,
    conversation_key: str,
    content: str,
    chatwoot_conversation_id: Optional[int] = None,
    chatwoot_inbox_id: Optional[int] = None,
    chatwoot_display_id: Optional[int] = None,
    chatwoot_message_id: Optional[int] = None,
    customer_email: Optional[str] = None,
    customer_phone: Optional[str] = None,
    customer_name: Optional[str] = None,
    external_id: Optional[str] = None,
) -> Dict[str, Any]:
    conv = get_or_create_conversation(
        db, store, conversation_key,
        chatwoot_conversation_id=chatwoot_conversation_id,
        chatwoot_inbox_id=chatwoot_inbox_id,
        chatwoot_display_id=chatwoot_display_id,
        customer_email=customer_email, customer_phone=customer_phone,
        customer_name=customer_name,
    )
    add_customer_message(db, conv, content, chatwoot_message_id=chatwoot_message_id, external_id=external_id)

    cw = ChatwootClient()
    target_cw_id = chatwoot_display_id or conv.display_id or chatwoot_conversation_id or conv.chatwoot_conversation_id or conv.id

    # If conversation is already actively escalated to human agent, suppress AI reply
    if conv.escalated:
        logger.info(f"Conversation {conv.id} is actively handled by human. Suppressing AI response.")
        return {
            "conversation_id": conv.id,
            "ai_replied": False,
            "reason": "escalated_to_human",
        }

    # Turn on typing indicator only when AI is actually processing!
    if target_cw_id and cw.is_configured():
        cw.toggle_typing_status(target_cw_id, "on")

    conv.status = ConversationStatus.ai_handling
    db.add(conv)
    db.commit()

    run = run_ai_employee(
        db, store, content,
        conversation=conv,
        context_customer_email=customer_email or conv.customer_email,
        context_customer_phone=customer_phone or conv.customer_phone,
        context_customer_name=customer_name or conv.customer_name,
    )
    reply = run.final_response or "I'm sorry, I couldn't process your request right now."

    available_agents = get_available_agents(db, chatwoot_inbox_id or conv.chatwoot_inbox_id or 1)

    if run.escalated:
        if available_agents:
            agent = available_agents[0]
            agent_id = agent["id"]
            agent_name = agent["name"] or "our human support team"
            escalate_conversation(db, conv, run.escalation_reason, assign_to_agent_id=agent_id)
            reply = f"I am handing this conversation over to {agent_name} from our support team who is available right now. Please hold on while they join the chat."
        else:
            # No human agents online: notify customer, log internal ticket, but keep AI active
            conv.escalated = False
            conv.status = ConversationStatus.open
            db.add(conv)
            db.commit()
            if target_cw_id and cw.is_configured():
                try:
                    cw.add_label(target_cw_id, "needs-human")
                    cw.update_status(target_cw_id, "open")
                    cw.send_message(
                        chatwoot_inbox_id or conv.chatwoot_inbox_id or 1,
                        target_cw_id,
                        f"[Notice: No human agents currently online. Solact AI continuing assistance for: {run.escalation_reason}]",
                        private=True,
                    )
                except Exception as e:
                    logger.warning(f"Chatwoot offline note failed: {e}")
            if "currently" not in reply.lower() and "offline" not in reply.lower():
                reply = f"{reply}\n\n(Our human team is currently assisting others, but I've flagged your request for them. In the meantime, I'm here 24/7—how else can I help?)"
    else:
        conv.status = ConversationStatus.open
        db.add(conv)
        db.commit()

    cw_msg_id = None
    if target_cw_id and cw.is_configured():
        try:
            sent = cw.send_message(
                chatwoot_inbox_id or conv.chatwoot_inbox_id or 1,
                target_cw_id,
                reply,
            )
            cw_msg_id = sent.get("id")
            logger.info(f"Successfully sent AI reply to Chatwoot conversation {target_cw_id}: msg_id={cw_msg_id}")
        except Exception as e:
            logger.error(f"Chatwoot send failed: {e}")
        finally:
            cw.toggle_typing_status(target_cw_id, "off")

    add_ai_message(db, conv, reply, ai_run_id=run.id, chatwoot_message_id=cw_msg_id)

    return {
        "conversation_id": conv.id,
        "chatwoot_conversation_id": target_cw_id,
        "ai_run_id": run.id,
        "ai_replied": True,
        "reply": reply,
        "escalated": conv.escalated,
        "escalation_reason": run.escalation_reason,
        "chatwoot_message_id": cw_msg_id,
    }
