import pytest
import json
import hashlib
import hmac
import base64
from sqlalchemy import select, func

from tests.fixtures import *  # noqa: F401
from app.models import Order, Customer, OrderStatus, Conversation, ConversationStatus, MessageRole
from app.services.shopify_auth import verify_webhook
from app.config import settings


def test_webhook_hmac_validation():
    body = b'{"id": 123, "email": "a@b.com"}'
    real_secret = settings.SHOPIFY_API_SECRET
    try:
        settings.SHOPIFY_API_SECRET = "test_secret"
        digest = hmac.new(b"test_secret", msg=body, digestmod=hashlib.sha256).digest()
        valid_hmac = base64.b64encode(digest).decode()
        assert verify_webhook(body, valid_hmac) is True
        assert verify_webhook(body, "WRONG_HMAC") is False
    finally:
        settings.SHOPIFY_API_SECRET = real_secret


def test_webhook_idempotent_upsert_customer(db, seeded_org):
    store = seeded_org["store"]
    from app.services.sync_service import upsert_customer
    payload = {"id": 999, "email": "idem@test.com", "first_name": "Idem", "orders_count": 0, "total_spent": "0"}
    upsert_customer(db, store.id, payload); db.commit()
    upsert_customer(db, store.id, payload); db.commit()
    upsert_customer(db, store.id, {**payload, "orders_count": 5, "total_spent": "99.99"}); db.commit()
    count = db.execute(select(func.count(Customer.id)).where(Customer.shopify_customer_id == 999, Customer.store_id == store.id)).scalar()
    assert count == 1
    c = db.execute(select(Customer).where(Customer.shopify_customer_id == 999, Customer.store_id == store.id)).scalar_one()
    assert c.orders_count == 5


def test_webhook_idempotent_upsert_order(db, seeded_org):
    store = seeded_org["store"]
    from app.services.sync_service import upsert_order, upsert_customer
    upsert_customer(db, store.id, {"id": 77, "email": "buyer@idem.com", "first_name": "B"})
    p1 = {
        "id": 5555, "name": "#99", "order_number": 99,
        "customer": {"id": 77, "email": "buyer@idem.com"},
        "financial_status": "paid", "currency": "USD",
        "subtotal_price": "10.00", "total_price": "12.00",
        "line_items": [
            {"id": 111, "title": "Item", "sku": "X", "quantity": 1, "price": "10", "total_discount": "0"},
        ],
        "created_at": "2026-01-01T00:00:00Z",
    }
    upsert_order(db, store.id, p1); db.commit()
    upsert_order(db, store.id, p1); db.commit()
    p2 = {**p1, "financial_status": "refunded"}
    upsert_order(db, store.id, p2); db.commit()
    count = db.execute(select(func.count(Order.id)).where(Order.shopify_order_id == 5555, Order.store_id == store.id)).scalar()
    assert count == 1
    o = db.execute(select(Order).where(Order.shopify_order_id == 5555, Order.store_id == store.id)).scalar_one()
    assert o.status == OrderStatus.refunded


def test_escalate_conversation(db, seeded_org):
    store = seeded_org["store"]
    from app.services.chatwoot_service import get_or_create_conversation, escalate_conversation
    conv = get_or_create_conversation(db, store, "conv-esc-1", customer_email="a@a.com", customer_name="A")
    assert conv.status == ConversationStatus.open
    assert conv.escalated is False
    conv2 = escalate_conversation(db, conv, reason="Refund requested")
    assert conv2.status == ConversationStatus.awaiting_human
    assert conv2.escalated is True
    assert conv2.escalation_reason == "Refund requested"
    assert conv2.escalated_at is not None
