import pytest
from sqlalchemy import select, func

from tests.fixtures import *  # noqa: F401
from app.models import Customer, Product, Order, Organization, Store
from app.services.sync_service import (
    upsert_customer, upsert_product, upsert_order,
)


def test_tenant_isolation_customer_cross_store(db):
    org_a = Organization(name="OrgA", slug="org-a-aaa111"); db.add(org_a); db.flush()
    org_b = Organization(name="OrgB", slug="org-b-bbb222"); db.add(org_b); db.flush()
    store_a = Store(organization_id=org_a.id, shopify_domain="a.myshopify.com", is_connected=True); db.add(store_a); db.flush()
    store_b = Store(organization_id=org_b.id, shopify_domain="b.myshopify.com", is_connected=True); db.add(store_b); db.flush()
    db.commit()
    upsert_customer(db, store_a.id, {"id": 1, "email": "x@x.com", "first_name": "X"})
    upsert_customer(db, store_b.id, {"id": 1, "email": "x@x.com", "first_name": "Y"})
    db.commit()
    c_a = db.execute(select(Customer).where(Customer.store_id == store_a.id)).scalar_one()
    c_b = db.execute(select(Customer).where(Customer.store_id == store_b.id)).scalar_one()
    assert c_a.first_name == "X"
    assert c_b.first_name == "Y"
    assert c_a.id != c_b.id


def test_upsert_customer_idempotent(db, seeded_org):
    store = seeded_org["store"]
    data = {
        "id": 4444, "email": "cust@example.com",
        "first_name": "Jane", "last_name": "Doe",
        "orders_count": 1, "total_spent": "50.00", "state": "enabled",
        "tags": "vip", "created_at": "2026-01-01T00:00:00Z",
        "updated_at": "2026-01-02T00:00:00Z",
    }
    c1 = upsert_customer(db, store.id, data); db.commit()
    c2 = upsert_customer(db, store.id, data); db.commit()
    assert c1.id == c2.id
    count = db.execute(select(func.count(Customer.id)).where(Customer.shopify_customer_id == 4444)).scalar()
    assert count == 1


def test_upsert_product_and_order(db, seeded_org):
    store = seeded_org["store"]
    p = upsert_product(db, store.id, {
        "id": 8001, "title": "Hat", "handle": "hat",
        "vendor": "Hats Inc", "product_type": "Apparel",
        "status": "active", "variants": [{"sku": "HAT-1", "price": "25.00"}],
        "created_at": "2026-01-01T00:00:00Z",
        "updated_at": "2026-01-01T00:00:00Z",
    })
    db.commit()
    assert p.title == "Hat"
    assert p.price_min == 25.00
    o = upsert_order(db, store.id, {
        "id": 900001, "name": "#1001", "order_number": 1001,
        "email": "buyer@example.com",
        "financial_status": "paid", "fulfillment_status": None,
        "currency": "USD", "subtotal_price": "25.00", "total_price": "30.00",
        "total_tax": "2.50", "total_shipping_price_set": {"shop_money": {"amount": "2.50"}},
        "customer": {"id": 777, "email": "buyer@example.com"},
        "line_items": [
            {
                "id": 1111, "product_id": 8001,
                "title": "Hat", "sku": "HAT-1", "quantity": 1,
                "price": "25.00", "total_discount": "0", "fulfillment_status": None,
            }
        ],
        "created_at": "2026-08-01T00:00:00Z",
    })
    db.commit()
    assert o.name == "#1001"
    assert o.order_number == 1001
    items = list(o.order_items)
    assert len(items) == 1
    assert items[0].sku == "HAT-1"
    assert items[0].product_id == p.id
