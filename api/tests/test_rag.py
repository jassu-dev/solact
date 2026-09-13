import pytest
from sqlalchemy import select

from tests.fixtures import *  # noqa: F401
from app.models import Document, KnowledgeChunk, DocType, Organization, Store
from app.services.knowledge_service import create_document, process_document
from app.services.embeddings import clean_text, chunk_text
from app.services.ai_agent import _cosine_search
from app.services.embeddings import embed_single


def test_clean_and_chunk_text():
    html = "<html><body><p>Hello  world</p><script>var x=1</script><p>foo</p></body></html>"
    cleaned = clean_text(html)
    assert "<script>" not in cleaned
    assert "Hello world" in cleaned or "Hello  world" in cleaned
    chunks = chunk_text(" ".join(f"word{i}" for i in range(1000)), chunk_size=100, chunk_overlap=10)
    assert len(chunks) > 1
    for c in chunks:
        assert len(c.split()) <= 110


def test_create_and_process_document(db, seeded_org):
    store = seeded_org["store"]
    doc = create_document(
        db, seeded_org["org"].id, store.id,
        doc_type="shipping_policy",
        title="Shipping Policy",
        content_raw=(
            "We ship worldwide via USPS, UPS, and DHL. "
            "Standard shipping takes 3-5 business days in the USA. "
            "International shipping takes 7-21 days. "
            "Free shipping on orders over $75 in the contiguous USA. "
            "Tracking is provided for all orders once shipped. "
            "If you have not received your order within 30 days, please contact us."
        ),
    )
    assert doc.status == "pending"
    doc2 = process_document(db, doc.id)
    assert doc2.status == "ready", f"Failed: {doc2.error_message}"
    assert doc2.chunk_count > 0
    chunks = db.execute(select(KnowledgeChunk).where(KnowledgeChunk.document_id == doc.id)).scalars().all()
    assert len(chunks) == doc2.chunk_count
    for c in chunks:
        assert c.embedding is not None
        assert c.organization_id == seeded_org["org"].id
        assert c.store_id == store.id


def test_rag_search_returns_relevant(db, seeded_org):
    store = seeded_org["store"]
    texts = [
        "Our return policy: returns accepted within 30 days of delivery. Items must be unused.",
        "Shipping times: USA standard 3-5 days. Express 1-2 days. International 7-21 days.",
        "Warranty: 1 year manufacturer warranty on all electronics against defects.",
        "FAQ: We accept Visa, Mastercard, Amex, PayPal, Apple Pay, Google Pay.",
    ]
    for i, t in enumerate(texts):
        doc = create_document(
            db, seeded_org["org"].id, store.id,
            doc_type="text",
            title=f"doc{i}",
            content_raw=t,
        )
        process_document(db, doc.id)
    q_emb = embed_single("How long does shipping take to California?")
    results = _cosine_search(db, seeded_org["org"].id, store.id, q_emb, top_k=3)
    assert len(results) >= 1
    texts_found = [c.chunk_text for c, _ in results]
    joined = " ".join(texts_found).lower()
    assert "shipping" in joined or "days" in joined


def test_knowledge_tenant_isolation(db):
    org_a = Organization(name="KA", slug="ka-a1"); db.add(org_a); db.flush()
    org_b = Organization(name="KB", slug="kb-b1"); db.add(org_b); db.flush()
    sa = Store(organization_id=org_a.id, shopify_domain="ka.myshopify.com", is_connected=True); db.add(sa); db.flush()
    sb = Store(organization_id=org_b.id, shopify_domain="kb.myshopify.com", is_connected=True); db.add(sb); db.flush()
    da = create_document(db, org_a.id, sa.id, "text", "A", content_raw="OrgA secret policy: 90 day returns"); db.flush()
    db = db
    process_document(db, da.id)
    q_emb = embed_single("What is the return policy")
    results_b = _cosine_search(db, org_b.id, sb.id, q_emb, top_k=5)
    assert len(results_b) == 0, "Knowledge leaked across tenants"
