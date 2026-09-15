from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from sqlalchemy import select, func, and_
from typing import List, Optional, Dict, Any
from datetime import datetime, timedelta

from ..database import get_db
from ..models import (
    User, Store, AIRun, ToolCall, Conversation, Customer, Order,
    Document, KnowledgeChunk, Message, MessageRole, RunStatus,
)
from ..dependencies.auth import get_current_user
from ..schemas.ai import (
    TestLabRequest, TestLabResponse, ToolCallDebug, KnowledgeChunkDebug,
    CustomerDebug, OrderDebug, AnalyticsSummary,
)
from ..services.ai_agent import run_ai_employee

router = APIRouter(tags=["ai"])


def _default_store(db: Session, user: User) -> Store:
    store = db.execute(select(Store).where(Store.organization_id == user.organization_id).limit(1)).scalar_one_or_none()
    if not store:
        if user.role == "admin" or user.email == "admin@solact.in":
            store = db.execute(select(Store).limit(1)).scalar_one_or_none()
        if not store:
            store = Store(
                organization_id=user.organization_id or 1,
                shopify_domain=f"sandbox-store-{user.organization_id or 1}.myshopify.com",
                name="Sandbox Store",
                is_connected=True,
            )
            db.add(store)
            db.commit()
            db.refresh(store)
    return store


@router.post("/test-lab", response_model=TestLabResponse)
def test_lab(payload: TestLabRequest, store_id: Optional[int] = None, db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    try:
        sid = store_id or _default_store(db, user).id
        store = db.get(Store, sid)
        if not store:
            store = _default_store(db, user)
        run = run_ai_employee(
            db, store, payload.query, user_id=user.id, is_test=True,
            precomputed_embedding=payload.embedding,
        )
        return _run_to_test_lab(db, run)
    except Exception as e:
        import logging
        logging.getLogger("solact.ai").error(f"Error executing test_lab: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"AI execution error: {str(e)}")


@router.get("/runs/{run_id}", response_model=TestLabResponse)
def get_run(run_id: int, db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    run = db.get(AIRun, run_id)
    if not run or run.organization_id != user.organization_id:
        raise HTTPException(status_code=404, detail="Run not found")
    return _run_to_test_lab(db, run)


def _run_to_test_lab(db: Session, run: AIRun) -> TestLabResponse:
    tcs = db.execute(select(ToolCall).where(ToolCall.ai_run_id == run.id).order_by(ToolCall.id)).scalars().all()
    tool_debugs = [
        ToolCallDebug(
            id=tc.id, tool_name=tc.tool_name, arguments_json=tc.arguments_json,
            validated=tc.validated, validation_error=tc.validation_error,
            status=tc.status.value if tc.status else "unknown",
            result_json=tc.result_json, error_message=tc.error_message,
            executed_at=tc.executed_at, completed_at=tc.completed_at,
        )
        for tc in tcs
    ]
    kc_data = run.knowledge_chunks_json or []
    kc_debugs = [
        KnowledgeChunkDebug(
            document_id=kc.get("document_id"),
            doc_type=kc.get("doc_type") or "",
            title=kc.get("title"),
            chunk_text=kc.get("chunk_text", ""),
            similarity=float(kc.get("similarity", 0)),
        )
        for kc in kc_data
    ]
    cust = None
    if run.identified_customer_id:
        c = db.get(Customer, run.identified_customer_id)
        if c:
            cust = CustomerDebug(
                id=c.id, shopify_customer_id=c.shopify_customer_id,
                first_name=c.first_name, last_name=c.last_name,
                email=c.email, phone=c.phone,
                orders_count=c.orders_count or 0,
                total_spent=float(c.total_spent) if c.total_spent else None,
            )
    order = None
    if run.identified_order_id:
        o = db.get(Order, run.identified_order_id)
        if o:
            from ..models import OrderItem
            items_count = db.execute(select(func.count(OrderItem.id)).where(OrderItem.order_id == o.id)).scalar() or 0
            order = OrderDebug(
                id=o.id, shopify_order_id=o.shopify_order_id,
                name=o.name, order_number=o.order_number,
                status=o.status.value if o.status else None,
                financial_status=o.financial_status,
                fulfillment_status=o.fulfillment_status,
                total_price=float(o.total_price) if o.total_price else None,
                items_count=items_count,
            )
    return TestLabResponse(
        ai_run_id=run.id,
        customer_query=run.customer_query,
        intent=run.intent,
        intent_confidence=run.intent_confidence,
        identified_customer=cust,
        identified_order=order,
        shopify_context=run.shopify_context_json,
        knowledge_chunks=kc_debugs,
        tool_calls=tool_debugs,
        final_response=run.final_response,
        raw_llm_response=run.raw_llm_response,
        status=run.status.value if run.status else "unknown",
        safety_passed=run.safety_passed,
        safety_reason=run.safety_reason,
        escalated=run.escalated,
        escalation_reason=run.escalation_reason,
        prompt_tokens=run.prompt_tokens or 0,
        completion_tokens=run.completion_tokens or 0,
        total_tokens=run.total_tokens or 0,
        llm_model=run.llm_model,
        error_message=run.error_message,
        started_at=run.started_at,
        completed_at=run.completed_at,
    )


@router.get("/analytics/summary", response_model=AnalyticsSummary)
def analytics_summary(store_id: Optional[int] = None, days: int = 30, db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    try:
        sid = store_id
        if not sid:
            store = db.execute(select(Store).where(Store.organization_id == user.organization_id).limit(1)).scalar_one_or_none()
            if not store and (user.role == "admin" or user.email == "admin@solact.in"):
                store = db.execute(select(Store).limit(1)).scalar_one_or_none()
            if not store:
                return AnalyticsSummary(
                    total_conversations=0,
                    ai_handled_conversations=0,
                    escalated_conversations=0,
                    escalation_rate=0.0,
                    total_ai_runs=0,
                    total_tokens_used=0,
                    total_tools_called=0,
                    top_intents=[],
                )
            sid = store.id

        since = datetime.utcnow() - timedelta(days=max(1, days))
        total_conv = db.execute(select(func.count(Conversation.id)).where(
            Conversation.store_id == sid, Conversation.created_at >= since,
        )).scalar() or 0
        escalated_conv = db.execute(select(func.count(Conversation.id)).where(
            Conversation.store_id == sid, Conversation.created_at >= since, Conversation.escalated == True,
        )).scalar() or 0
        ai_replied = db.execute(select(func.count(Conversation.id)).where(
            Conversation.store_id == sid, Conversation.created_at >= since, Conversation.ai_reply_count > 0,
        )).scalar() or 0
        total_runs = db.execute(select(func.count(AIRun.id)).where(
            AIRun.store_id == sid, AIRun.started_at >= since, AIRun.is_test == False,
        )).scalar() or 0
        tokens_used = db.execute(select(func.coalesce(func.sum(AIRun.total_tokens), 0)).where(
            AIRun.store_id == sid, AIRun.started_at >= since,
        )).scalar() or 0
        tc_count = db.execute(select(func.count(ToolCall.id)).join(AIRun).where(
            AIRun.store_id == sid, AIRun.started_at >= since,
        )).scalar() or 0
        rows = db.execute(
            select(AIRun.intent, func.count(AIRun.id)).where(
                AIRun.store_id == sid, AIRun.started_at >= since, AIRun.intent.is_not(None),
            ).group_by(AIRun.intent).order_by(func.count(AIRun.id).desc()).limit(10)
        ).all()
        top_intents = [{"intent": i, "count": c} for i, c in rows]
        return AnalyticsSummary(
            total_conversations=total_conv,
            ai_handled_conversations=ai_replied,
            escalated_conversations=escalated_conv,
            escalation_rate=(escalated_conv / total_conv) if total_conv > 0 else 0.0,
            total_ai_runs=total_runs,
            total_tokens_used=int(tokens_used),
            total_tools_called=tc_count,
            top_intents=top_intents,
        )
    except Exception as e:
        import logging
        logging.getLogger("solact.ai").error(f"Error computing analytics summary: {e}", exc_info=True)
        return AnalyticsSummary(
            total_conversations=0,
            ai_handled_conversations=0,
            escalated_conversations=0,
            escalation_rate=0.0,
            total_ai_runs=0,
            total_tokens_used=0,
            total_tools_called=0,
            top_intents=[],
        )
