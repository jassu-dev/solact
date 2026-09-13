from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from sqlalchemy import select, func
from typing import List, Optional

from ..database import get_db
from ..models import User, Store, Conversation, Message, ConversationStatus
from ..dependencies.auth import get_current_user
from ..schemas.conversations import (
    ConversationResponse, ConversationDetailResponse, ConversationListResponse,
    MessageResponse, SendMessageRequest, EscalateRequest,
)
from ..services.chatwoot_service import (
    handle_incoming_message, get_or_create_conversation, add_customer_message,
    escalate_conversation, add_ai_message,
)
from ..services.ai_agent import run_ai_employee

router = APIRouter(prefix="/conversations", tags=["conversations"])


def _default_store(db, user):
    store = db.execute(select(Store).where(Store.organization_id == user.organization_id).limit(1)).scalar_one_or_none()
    if not store:
        raise HTTPException(status_code=400, detail="No store found. Connect Shopify first.")
    return store


@router.get("", response_model=ConversationListResponse)
def list_conversations(
    store_id: Optional[int] = None,
    status: Optional[str] = None,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    sid = store_id or _default_store(db, user).id
    q = select(Conversation).where(
        Conversation.organization_id == user.organization_id,
        Conversation.store_id == sid,
    )
    if status:
        q = q.where(Conversation.status == status)
    q = q.order_by(Conversation.last_message_at.desc().nullslast(), Conversation.created_at.desc())
    convs = db.execute(q).scalars().all()
    total = db.execute(
        select(func.count(Conversation.id)).where(
            Conversation.organization_id == user.organization_id,
            Conversation.store_id == sid,
        )
    ).scalar() or 0
    return ConversationListResponse(conversations=convs, total=total)


@router.get("/{conv_id}", response_model=ConversationDetailResponse)
def get_conversation(conv_id: int, db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    conv = db.get(Conversation, conv_id)
    if not conv or conv.organization_id != user.organization_id:
        raise HTTPException(status_code=404, detail="Conversation not found")
    messages = db.execute(
        select(Message).where(Message.conversation_id == conv.id).order_by(Message.created_at.asc())
    ).scalars().all()
    data = ConversationDetailResponse.model_validate(conv)
    data.messages = messages
    return data


@router.get("/{conv_id}/messages", response_model=List[MessageResponse])
def list_messages(conv_id: int, db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    conv = db.get(Conversation, conv_id)
    if not conv or conv.organization_id != user.organization_id:
        raise HTTPException(status_code=404, detail="Conversation not found")
    return db.execute(
        select(Message).where(Message.conversation_id == conv.id).order_by(Message.created_at.asc())
    ).scalars().all()


@router.post("/send", response_model=MessageResponse)
def send_message(payload: SendMessageRequest, store_id: Optional[int] = None, db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    sid = store_id or _default_store(db, user).id
    store = db.get(Store, sid)
    key = f"manual_{sid}_{payload.customer_email or payload.customer_phone or 'anon'}"
    result = handle_incoming_message(
        db, store, key, payload.content,
        customer_email=payload.customer_email,
        customer_phone=payload.customer_phone,
        customer_name=payload.customer_name,
    )
    return db.get(Message, db.execute(select(Message.id).order_by(Message.id.desc()).limit(1)).scalar())


@router.post("/{conv_id}/escalate", response_model=ConversationDetailResponse)
def escalate(conv_id: int, payload: EscalateRequest, db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    conv = db.get(Conversation, conv_id)
    if not conv or conv.organization_id != user.organization_id:
        raise HTTPException(status_code=404, detail="Conversation not found")
    conv = escalate_conversation(db, conv, payload.reason)
    messages = db.execute(
        select(Message).where(Message.conversation_id == conv.id).order_by(Message.created_at.asc())
    ).scalars().all()
    data = ConversationDetailResponse.model_validate(conv)
    data.messages = messages
    return data
