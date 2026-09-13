from datetime import datetime
from typing import Optional, List, Any, Dict
from pydantic import BaseModel, ConfigDict


class ORMBase(BaseModel):
    model_config = ConfigDict(from_attributes=True)


class TestLabRequest(BaseModel):
    query: str
    embedding: Optional[List[float]] = None


class ToolCallDebug(BaseModel):
    id: int
    tool_name: str
    arguments_json: Optional[Any] = None
    validated: bool = False
    validation_error: Optional[str] = None
    status: str
    result_json: Optional[Any] = None
    error_message: Optional[str] = None
    executed_at: Optional[datetime] = None
    completed_at: Optional[datetime] = None


class KnowledgeChunkDebug(BaseModel):
    document_id: int
    doc_type: str
    title: Optional[str] = None
    chunk_text: str
    similarity: float


class CustomerDebug(BaseModel):
    id: Optional[int] = None
    shopify_customer_id: Optional[int] = None
    first_name: Optional[str] = None
    last_name: Optional[str] = None
    email: Optional[str] = None
    phone: Optional[str] = None
    orders_count: int = 0
    total_spent: Optional[float] = None


class OrderDebug(BaseModel):
    id: Optional[int] = None
    shopify_order_id: Optional[int] = None
    name: Optional[str] = None
    order_number: Optional[int] = None
    status: Optional[str] = None
    financial_status: Optional[str] = None
    fulfillment_status: Optional[str] = None
    total_price: Optional[float] = None
    items_count: int = 0


class TestLabResponse(BaseModel):
    ai_run_id: int
    customer_query: str
    intent: Optional[str] = None
    intent_confidence: Optional[float] = None
    identified_customer: Optional[CustomerDebug] = None
    identified_order: Optional[OrderDebug] = None
    shopify_context: Optional[Dict[str, Any]] = None
    knowledge_chunks: List[KnowledgeChunkDebug] = []
    tool_calls: List[ToolCallDebug] = []
    final_response: Optional[str] = None
    raw_llm_response: Optional[str] = None
    status: str
    safety_passed: bool = True
    safety_reason: Optional[str] = None
    escalated: bool = False
    escalation_reason: Optional[str] = None
    prompt_tokens: int = 0
    completion_tokens: int = 0
    total_tokens: int = 0
    llm_model: Optional[str] = None
    error_message: Optional[str] = None
    started_at: Optional[datetime] = None
    completed_at: Optional[datetime] = None


class AnalyticsSummary(BaseModel):
    total_conversations: int = 0
    ai_handled_conversations: int = 0
    escalated_conversations: int = 0
    escalation_rate: float = 0.0
    total_ai_runs: int = 0
    total_tokens_used: int = 0
    total_tools_called: int = 0
    top_intents: List[Dict[str, Any]] = []
