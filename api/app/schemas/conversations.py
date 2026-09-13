from datetime import datetime
from typing import Optional, List, Any, Literal
from pydantic import BaseModel, ConfigDict


class ORMBase(BaseModel):
    model_config = ConfigDict(from_attributes=True)


class ConversationResponse(ORMBase):
    id: int
    organization_id: int
    store_id: int
    conversation_key: Optional[str] = None
    chatwoot_conversation_id: Optional[int] = None
    customer_id: Optional[int] = None
    customer_name: Optional[str] = None
    customer_email: Optional[str] = None
    customer_phone: Optional[str] = None
    status: Any = "open"
    escalated: bool = False
    escalated_reason: Optional[str] = None
    escalated_at: Optional[datetime] = None
    last_message_at: Optional[datetime] = None
    ai_reply_count: int = 0
    human_reply_count: int = 0
    created_at: datetime


class MessageResponse(ORMBase):
    id: int
    conversation_id: int
    chatwoot_message_id: Optional[int] = None
    role: Optional[str] = "assistant"
    content: str
    content_html: Optional[str] = None
    external_id: Optional[str] = None
    ai_run_id: Optional[int] = None
    created_at: datetime


class ConversationDetailResponse(ConversationResponse):
    messages: List[MessageResponse]


class ConversationListResponse(BaseModel):
    conversations: List[ConversationResponse]
    total: int


class SendMessageRequest(BaseModel):
    content: str
    customer_email: Optional[str] = None
    customer_phone: Optional[str] = None
    customer_name: Optional[str] = None


class EscalateRequest(BaseModel):
    reason: Optional[str] = None
