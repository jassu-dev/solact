from datetime import datetime
from typing import Optional, List, Any, Literal
from pydantic import BaseModel, ConfigDict, Field


class ORMBase(BaseModel):
    model_config = ConfigDict(from_attributes=True)


DocTypeStr = Literal["website", "shipping_policy", "return_policy", "warranty", "faq", "text"]


class DocumentCreateRequest(BaseModel):
    doc_type: DocTypeStr
    title: Optional[str] = None
    source_url: Optional[str] = None
    content_raw: Optional[str] = None


class DocumentResponse(ORMBase):
    id: int
    organization_id: int
    store_id: int
    doc_type: str
    title: Optional[str] = None
    source_url: Optional[str] = None
    status: str
    error_message: Optional[str] = None
    chunk_count: int = 0
    last_chunked_at: Optional[datetime] = None
    created_at: datetime


class DocumentListResponse(BaseModel):
    documents: List[DocumentResponse]
    total: int


class KnowledgeChunkResponse(ORMBase):
    id: int
    document_id: int
    chunk_index: int
    chunk_text: str
    token_count: Optional[int] = None
    created_at: datetime


class ProcessDocumentRequest(BaseModel):
    pass


class PreEmbeddedChunk(BaseModel):
    chunk_index: int
    chunk_text: str
    token_count: Optional[int] = None
    embedding: List[float]


class IngestChunksRequest(BaseModel):
    """Used when the client has already chunked + embedded the document."""
    doc_type: DocTypeStr
    title: Optional[str] = None
    source_url: Optional[str] = None
    content_raw: Optional[str] = None
    chunks: List[PreEmbeddedChunk]


class RagSearchRequest(BaseModel):
    query: str
    top_k: int = 5


class RagSearchResult(BaseModel):
    chunk_id: int
    document_id: int
    doc_type: str
    title: Optional[str] = None
    source_url: Optional[str] = None
    chunk_text: str
    similarity: float
