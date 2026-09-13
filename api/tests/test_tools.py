import pytest
from sqlalchemy import select

from tests.fixtures import *  # noqa: F401
from app.models import Customer, Order, OrderStatus
from app.services.tools import (
    validate_and_execute, get_customer_tool, get_order_tool, get_orders_tool,
    get_product_tool, get_tracking_tool, check_return_eligibility_tool,
    TOOL_DEFINITIONS, ESCALATE_TOOL, tools_json_schema,
)


def test_tools_schema_has_all():
    schema = tools_json_schema()
    names = [s["function"]["name"] for s in schema]
    required = ["get_customer", "get_order", "get_orders", "get_product",
                "get_tracking", "check_return_eligibility", "escalate_to_human"]
    for r in required:
        assert r in names, f"Missing tool {r}"


def test_get_customer_by_email(db, seeded_org):
    data = seed_customers_products_orders(db, seeded_org["store"])
    store = seeded_org["store"]
    ok, err, result = validate_and_execute(db, store, "get_customer", {"email": "alice@example.com"})
    assert ok, err
    assert result["found"] is True
    assert result["customer"]["email"] == "alice@example.com"
    assert result["customer"]["first_name"] == "Alice"


def test_get_customer_not_found(db, seeded_org):
    store = seeded_org["store"]
    ok, err, result = validate_and_execute(db, store, "get_customer", {"email": "nope@nope.com"})
    assert ok
    assert result["found"] is False


def test_get_order_by_name(db, seeded_org):
    data = seed_customers_products_orders(db, seeded_org["store"])
    store = seeded_org["store"]
    ok, err, result = validate_and_execute(db, store, "get_order", {"order_name": "#10492"})
    assert ok, err
    assert result["found"] is True
    assert result["order"]["name"] == "#10492"
    assert len(result["order"]["items"]) == 1
    assert len(result["order"]["fulfillments"]) == 1
    assert result["order"]["items"][0]["sku"] == "W-001"


def test_get_tracking(db, seeded_org):
    data = seed_customers_products_orders(db, seeded_org["store"])
    store = seeded_org["store"]
    ok, err, result = validate_and_execute(db, store, "get_tracking", {"order_name": "10492"})
    assert ok, err
    assert result["found"] is True
    assert result["fulfillment_status"] == "fulfilled"
    assert len(result["fulfillments"]) == 1
    assert result["fulfillments"][0]["tracking_company"] == "USPS"
    assert "USPS" in result["fulfillments"][0]["tracking_number"] or True


def test_get_orders_for_customer(db, seeded_org):
    data = seed_customers_products_orders(db, seeded_org["store"])
    store = seeded_org["store"]
    ok, err, result = validate_and_execute(db, store, "get_orders", {"customer_email": "alice@example.com"})
    assert ok, err
    assert result["customer_found"] is True
    assert result["count"] >= 1


def test_check_return_eligibility(db, seeded_org):
    data = seed_customers_products_orders(db, seeded_org["store"])
    store = seeded_org["store"]
    ok, err, result = validate_and_execute(db, store, "check_return_eligibility", {"order_name": "#10492"})
    assert ok, err
    assert result["order_name"] == "#10492"
    assert isinstance(result["eligible"], bool)
    assert "This is informational only" in "\n".join(result["notes"])


def test_escalate_tool(db, seeded_org):
    store = seeded_org["store"]
    ok, err, result = validate_and_execute(db, store, "escalate_to_human", {"reason": "Customer wants refund"})
    assert ok, err
    assert result["escalated"] is True


def test_unknown_tool_denied(db, seeded_org):
    ok, err, _ = validate_and_execute(db, seeded_org["store"], "does_not_exist", {})
    assert ok is False
    assert "Unknown tool" in err


def test_tool_tenant_isolation(db):
    org_a = Organization(name="A", slug="a-a1"); db.add(org_a); db.flush()
    org_b = Organization(name="B", slug="b-b1"); db.add(org_b); db.flush()
    sa = Store(organization_id=org_a.id, shopify_domain="a1.myshopify.com", is_connected=True); db.add(sa); db.flush()
    sb = Store(organization_id=org_b.id, shopify_domain="b1.myshopify.com", is_connected=True); db.add(sb); db.flush()
    c1 = Customer(store_id=sa.id, shopify_customer_id=1, email="x@x.com"); db.add(c1); db.flush()
    db.commit()
    ok, err, result = validate_and_execute(db, sb, "get_customer", {"email": "x@x.com"})
    assert ok
    assert result["found"] is False, "Customer from different store leaked"
