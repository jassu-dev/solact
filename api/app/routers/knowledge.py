from fastapi import APIRouter, Depends, HTTPException, status, BackgroundTasks
from sqlalchemy.orm import Session
from sqlalchemy import select, func
from typing import List, Optional

from ..database import get_db
from ..models import User, Document, KnowledgeChunk, Store
from ..dependencies.auth import get_current_user
from ..schemas.knowledge import (
    DocumentCreateRequest, DocumentResponse, DocumentListResponse,
    KnowledgeChunkResponse, ProcessDocumentRequest, RagSearchRequest, RagSearchResult,
    IngestChunksRequest,
)
from ..services.knowledge_service import create_document, process_document, delete_document, ingest_prechunked
from ..services.embeddings import embed_single

router = APIRouter(prefix="/knowledge", tags=["knowledge"])


def _require_store(db, user, store_id):
    store = db.get(Store, store_id)
    if not store or store.organization_id != user.organization_id:
        raise HTTPException(status_code=404, detail="Store not found")
    return store


@router.post("/documents", response_model=DocumentResponse, status_code=201)
def create_doc(
    payload: DocumentCreateRequest,
    bt: BackgroundTasks,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    if not payload.source_url and not payload.content_raw:
        raise HTTPException(status_code=400, detail="Either source_url or content_raw is required")
    doc = create_document(
        db, user.organization_id, payload.store_id or _default_store(db, user).id,
        payload.doc_type, payload.title, payload.source_url, payload.content_raw,
    )
    bt.add_task(process_document_wrapper, doc.id)
    return doc


@router.post("/documents/ingest", response_model=DocumentResponse, status_code=201)
def ingest_chunks(
    payload: IngestChunksRequest,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    """Accept pre-chunked + pre-embedded document from the client."""
    if not payload.chunks:
        raise HTTPException(status_code=400, detail="No chunks provided")
    store_id = _default_store(db, user).id
    doc = ingest_prechunked(
        db,
        user.organization_id,
        store_id,
        payload.doc_type,
        [c.model_dump() for c in payload.chunks],
        title=payload.title,
        source_url=payload.source_url,
        content_raw=payload.content_raw,
    )
    return doc


def process_document_wrapper(doc_id: int):
    from ..database import get_db_session
    db = get_db_session()
    try:
        process_document(db, doc_id)
    finally:
        db.close()


def _default_store(db: Session, user: User) -> Store:
    store = db.execute(
        select(Store).where(Store.organization_id == user.organization_id).limit(1)
    ).scalar_one_or_none()
    if not store:
        raise HTTPException(status_code=400, detail="No store found. Connect Shopify first.")
    return store


@router.get("/documents", response_model=DocumentListResponse)
def list_docs(
    store_id: Optional[int] = None,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    q = select(Document).where(Document.organization_id == user.organization_id)
    if store_id:
        store = db.get(Store, store_id)
        if not store or store.organization_id != user.organization_id:
            raise HTTPException(status_code=404, detail="Store not found")
        q = q.where(Document.store_id == store_id)
    docs = db.execute(q.order_by(Document.created_at.desc())).scalars().all()
    return DocumentListResponse(documents=docs, total=len(docs))


@router.get("/documents/{doc_id}", response_model=DocumentResponse)
def get_doc(doc_id: int, db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    doc = db.get(Document, doc_id)
    if not doc or doc.organization_id != user.organization_id:
        raise HTTPException(status_code=404, detail="Document not found")
    return doc


@router.post("/documents/{doc_id}/process", response_model=DocumentResponse)
def process_doc(doc_id: int, payload: ProcessDocumentRequest, bt: BackgroundTasks, db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    doc = db.get(Document, doc_id)
    if not doc or doc.organization_id != user.organization_id:
        raise HTTPException(status_code=404, detail="Document not found")
    bt.add_task(process_document_wrapper, doc.id)
    doc.status = "queued"
    db.add(doc); db.commit(); db.refresh(doc)
    return doc


@router.delete("/documents/{doc_id}", status_code=204)
def delete_doc(doc_id: int, db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    try:
        delete_document(db, doc_id, user.organization_id)
    except Exception as e:
        raise HTTPException(status_code=404, detail=str(e))
    return None


@router.get("/documents/{doc_id}/chunks", response_model=List[KnowledgeChunkResponse])
def list_chunks(doc_id: int, db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    doc = db.get(Document, doc_id)
    if not doc or doc.organization_id != user.organization_id:
        raise HTTPException(status_code=404, detail="Document not found")
    chunks = db.execute(
        select(KnowledgeChunk).where(KnowledgeChunk.document_id == doc.id).order_by(KnowledgeChunk.chunk_index)
    ).scalars().all()
    return chunks


@router.post("/search", response_model=List[RagSearchResult])
def rag_search(payload: RagSearchRequest, store_id: Optional[int] = None, db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    from ..services.ai_agent import _cosine_search
    sid = store_id
    if not sid:
        sid = _default_store(db, user).id
    else:
        _require_store(db, user, sid)
    store = db.get(Store, sid)
    emb = embed_single(payload.query)
    results = _cosine_search(db, user.organization_id, sid, emb, top_k=payload.top_k)
    out = []
    for c, sim in results:
        doc = db.get(Document, c.document_id)
        out.append(RagSearchResult(
            chunk_id=c.id,
            document_id=c.document_id,
            doc_type=doc.doc_type.value if doc else "",
            title=doc.title if doc else None,
            source_url=doc.source_url if doc else None,
            chunk_text=c.chunk_text,
            similarity=sim,
        ))
    return out
