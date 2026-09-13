import pytest
from sqlalchemy import create_engine, text
from sqlalchemy.orm import sessionmaker, Session
from datetime import datetime
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT))

from tests.conftest import *  # noqa

from app.config import settings
from app.database import Base, get_db
from app.main import app as fastapi_app
from app.models import (
    Organization, User, Store, Customer, Product, Order, OrderItem, Fulfillment,
    Document, KnowledgeChunk, Conversation, Message, AIRun, ToolCall,
    OrderStatus, FulfillmentStatus, DocType, ConversationStatus, MessageRole,
)
from app.security import get_password_hash, create_access_token, encrypt_value
from fastapi.testclient import TestClient

_TEST_ENGINE = None
_TestSession = None


def get_engine():
    global _TEST_ENGINE, _TestSession
    if _TEST_ENGINE is None:
        _TEST_ENGINE = create_engine(settings.DATABASE_URL, pool_pre_ping=True, echo=False)
        _TestSession = sessionmaker(autocommit=False, autoflush=False, bind=_TEST_ENGINE)
    return _TEST_ENGINE


def setup_db():
    engine = get_engine()
    try:
        with engine.connect() as c:
            c.execute(text("CREATE EXTENSION IF NOT EXISTS vector"))
            c.commit()
    except Exception:
        pass
    Base.metadata.drop_all(bind=engine)
    Base.metadata.create_all(bind=engine)


@pytest.fixture(scope="session", autouse=True)
def session_engine():
    setup_db()
    yield get_engine()
    Base.metadata.drop_all(bind=get_engine())


@pytest.fixture()
def db():
    engine = get_engine()
    TestingSession = sessionmaker(autocommit=False, autoflush=False, bind=engine)
    session: Session = TestingSession()
    try:
        for tbl in reversed(Base.metadata.sorted_tables):
            session.execute(tbl.delete())
        session.commit()
        yield session
    finally:
        session.close()


@pytest.fixture()
def client(db):
    def _get_test_db():
        try:
            yield db
        finally:
            pass
    fastapi_app.dependency_overrides[get_db] = _get_test_db
    with TestClient(fastapi_app, base_url="http://test") as tc:
        yield tc
    fastapi_app.dependency_overrides.pop(get_db, None)


@pytest.fixture()
def seeded_org(db):
    org = Organization(name="Test Corp", slug="test-corp-abc123")
    db.add(org); db.flush()
    user = User(
        organization_id=org.id, email="owner@test.com",
        name="Owner", password_hash=get_password_hash("Password123!"),
        role="owner", is_active=True, is_verified=True,
    )
    db.add(user); db.flush()
    store = Store(
        organization_id=org.id,
        shopify_domain="test-store.myshopify.com",
        shopify_store_id=1001,
        name="Test Store",
        access_token_enc=encrypt_value("shpat_testtoken123"),
        scope="read_customers,read_products,read_orders",
        is_connected=True,
        sync_status="completed",
    )
    db.add(store); db.flush()
    db.commit()
    return {"org": org, "user": user, "store": store}


@pytest.fixture()
def auth_headers(client, seeded_org):
    token, _ = create_access_token({
        "sub": str(seeded_org["user"].id),
        "org_id": seeded_org["org"].id,
    })
    return {"Authorization": f"Bearer {token}"}


def seed_customers_products_orders(db, store: Store):
    c1 = Customer(
        store_id=store.id, shopify_customer_id=5001,
        first_name="Alice", last_name="Smith", email="alice@example.com",
        phone="+1-555-0101", orders_count=2, total_spent=249.98,
        state="enabled", created_at_shopify=datetime(2025, 1, 1),
    )
    db.add(c1)
    p1 = Product(
        store_id=store.id, shopify_product_id=3001, title="Premium Widget",
        handle="premium-widget", vendor="WidgetCo", product_type="Widget",
        status="active", price_min=99.99, price_max=149.99, sku="W-001",
        created_at_shopify=datetime(2025, 1, 1),
    )
    db.add(p1); db.flush()
    o1 = Order(
        store_id=store.id, shopify_order_id=710492,
        shopify_customer_id=5001, customer_id=c1.id,
        name="#10492", order_number=10492,
        status=OrderStatus.paid, financial_status="paid", fulfillment_status="fulfilled",
        currency="USD", subtotal_price=199.98, total_price=219.98,
        total_tax=10.0, total_shipping=10.0, total_discounts=0,
        customer_email="alice@example.com", customer_phone="+1-555-0101",
        created_at_shopify=datetime(2026, 8, 1),
        processed_at=datetime(2026, 8, 1),
    )
    db.add(o1); db.flush()
    oi1 = OrderItem(
        store_id=store.id, order_id=o1.id, product_id=p1.id,
        shopify_line_item_id=9001, shopify_product_id=3001,
        title="Premium Widget", sku="W-001", quantity=2,
        price=99.99, total_discount=0, fulfillment_status="fulfilled",
    )
    db.add(oi1)
    f1 = Fulfillment(
        store_id=store.id, order_id=o1.id, shopify_fulfillment_id=2001,
        status=FulfillmentStatus.in_transit, status_display="in_transit",
        tracking_company="USPS", tracking_number="9400100000000000000001",
        tracking_urls_json=["https://tools.usps.com/go/TrackConfirmAction?tRef=fullpage&tLc=2&text28777=&tLabels=9400100000000000000001"],
        service="standard",
        created_at_shopify=datetime(2026, 8, 2),
    )
    db.add(f1); db.commit()
    return {"customer": c1, "product": p1, "order": o1}
