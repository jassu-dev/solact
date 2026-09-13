import logging
from typing import Optional, Dict, Any, List
from datetime import datetime
from sqlalchemy.orm import Session
from sqlalchemy import select

from ..models import (
    Document, KnowledgeChunk, Organization, Store, DocType,
)
from ..config import settings
from .embeddings import (
    clean_text, chunk_text, fetch_website_text, embed_texts, estimate_tokens,
)

logger = logging.getLogger(__name__)


def _resolve_doctype(dt: str) -> DocType:
    mapping = {
        "website": DocType.website,
        "shipping_policy": DocType.shipping_policy,
        "return_policy": DocType.return_policy,
        "warranty": DocType.warranty,
        "faq": DocType.faq,
        "text": DocType.text,
    }
    if dt not in mapping:
        raise ValueError(f"Invalid doc_type: {dt}")
    return mapping[dt]


def create_document(
    db: Session,
    organization_id: int,
    store_id: int,
    doc_type: str,
    title: Optional[str] = None,
    source_url: Optional[str] = None,
    content_raw: Optional[str] = None,
) -> Document:
    dt = _resolve_doctype(doc_type)
    doc = Document(
        organization_id=organization_id,
        store_id=store_id,
        doc_type=dt,
        title=title or (source_url.split("//")[-1].split("/")[0] if source_url else doc_type),
        source_url=source_url,
        content_raw=content_raw,
        status="pending",
    )
    db.add(doc)
    db.commit()
    db.refresh(doc)
    return doc


def process_document(db: Session, doc_id: int) -> Document:
    doc = db.get(Document, doc_id)
    if not doc:
        raise Exception("Document not found")
    doc.status = "processing"
    doc.error_message = None
    db.add(doc)
    db.commit()
    try:
        if doc.doc_type == DocType.website:
            if not doc.source_url:
                raise Exception("Website document requires source_url")
            raw = fetch_website_text(doc.source_url)
            doc.content_raw = raw
        else:
            if not doc.content_raw:
                raise Exception("Document has no content")
            raw = doc.content_raw
        cleaned = clean_text(raw)
        doc.content_clean = cleaned
        chunks_text = chunk_text(cleaned, chunk_size=500, chunk_overlap=80)
        db.query(KnowledgeChunk).filter(KnowledgeChunk.document_id == doc.id).delete()
        db.commit()
        if chunks_text:
            embeddings = embed_texts(chunks_text)
            for i, chunk_text_str in enumerate(chunks_text):
                emb = embeddings[i].tolist()
                kc = KnowledgeChunk(
                    organization_id=doc.organization_id,
                    store_id=doc.store_id,
                    document_id=doc.id,
                    chunk_index=i,
                    chunk_text=chunk_text_str,
                    embedding=emb,
                    token_count=estimate_tokens(chunk_text_str),
                )
                db.add(kc)
        doc.chunk_count = len(chunks_text)
        doc.last_chunked_at = datetime.utcnow()
        doc.status = "ready"
        db.add(doc)
        db.commit()
        db.refresh(doc)
        try:
            from .ai_agent import invalidate_store_cache
            invalidate_store_cache(doc.store_id)
        except Exception:
            pass
    except Exception as e:
        logger.exception(f"Failed to process document {doc_id}")
        doc.status = "failed"
        doc.error_message = str(e)[:2000]
        db.add(doc)
        db.commit()
        db.refresh(doc)
    return doc


def ingest_prechunked(
    db: Session,
    organization_id: int,
    store_id: int,
    doc_type: str,
    chunks: list,
    title: Optional[str] = None,
    source_url: Optional[str] = None,
    content_raw: Optional[str] = None,
) -> Document:
    """Store a document whose chunks + embeddings were computed client-side."""
    dt = _resolve_doctype(doc_type)
    doc = Document(
        organization_id=organization_id,
        store_id=store_id,
        doc_type=dt,
        title=title or (source_url.split("//")[-1].split("/")[0] if source_url else doc_type),
        source_url=source_url,
        content_raw=content_raw,
        status="processing",
    )
    db.add(doc)
    db.commit()
    db.refresh(doc)
    try:
        for c in chunks:
            kc = KnowledgeChunk(
                organization_id=organization_id,
                store_id=store_id,
                document_id=doc.id,
                chunk_index=c["chunk_index"],
                chunk_text=c["chunk_text"],
                embedding=c["embedding"],
                token_count=c.get("token_count"),
            )
            db.add(kc)
        doc.chunk_count = len(chunks)
        doc.last_chunked_at = datetime.utcnow()
        doc.status = "ready"
        db.add(doc)
        db.commit()
        db.refresh(doc)
        try:
            from .ai_agent import invalidate_store_cache
            invalidate_store_cache(store_id)
        except Exception:
            pass
    except Exception as e:
        logger.exception(f"Failed to ingest pre-chunked document")
        doc.status = "failed"
        doc.error_message = str(e)[:2000]
        db.add(doc)
        db.commit()
    return doc


def delete_document(db: Session, doc_id: int, organization_id: int):
    doc = db.get(Document, doc_id)
    if not doc or doc.organization_id != organization_id:
        raise Exception("Document not found")
    store_id = doc.store_id
    db.delete(doc)
    db.commit()
    try:
        from .ai_agent import invalidate_store_cache
        invalidate_store_cache(store_id)
    except Exception:
        pass
