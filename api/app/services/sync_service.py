import asyncio
import logging
from typing import Optional, List, Dict, Any
from datetime import datetime
from decimal import Decimal
from sqlalchemy.orm import Session
from sqlalchemy import select

from ..database import get_db_session
from ..models import (
    Store, Customer, Product, Order, OrderItem, Fulfillment,
    OrderStatus, FulfillmentStatus,
)
from .shopify_client import ShopifyClient

logger = logging.getLogger(__name__)


def _parse_dt(s) -> Optional[datetime]:
    if not s:
        return None
    try:
        if isinstance(s, str):
            if s.endswith("Z"):
                s = s[:-1] + "+00:00"
            return datetime.fromisoformat(s)
    except Exception:
        pass
    return None


def _to_decimal(v) -> Optional[Decimal]:
    if v is None or v == "":
        return None
    try:
        return Decimal(str(v))
    except Exception:
        return None


def _status_to_enum(status: str) -> OrderStatus:
    mapping = {
        "pending": OrderStatus.pending,
        "authorized": OrderStatus.authorized,
        "partially_paid": OrderStatus.partially_paid,
        "paid": OrderStatus.paid,
        "partially_refunded": OrderStatus.partially_refunded,
        "refunded": OrderStatus.refunded,
        "voided": OrderStatus.voided,
        "archived": OrderStatus.archived,
        "cancelled": OrderStatus.cancelled,
    }
    return mapping.get((status or "").lower(), OrderStatus.pending)


def _fulfillment_status_enum(status: str) -> FulfillmentStatus:
    s = (status or "").lower()
    if "in_transit" in s or "in transit" in s:
        return FulfillmentStatus.in_transit
    if "out_for_delivery" in s or "out for delivery" in s:
        return FulfillmentStatus.out_for_delivery
    if s == "delivered":
        return FulfillmentStatus.delivered
    if s == "failure" or s == "failed":
        return FulfillmentStatus.failure
    if s == "cancelled":
        return FulfillmentStatus.cancelled
    if s == "error":
        return FulfillmentStatus.error
    if s == "open":
        return FulfillmentStatus.open
    return FulfillmentStatus.pending


def upsert_customer(db: Session, store_id: int, data: dict) -> Customer:
    shopify_id = int(data["id"])
    existing = db.execute(
        select(Customer).where(
            Customer.store_id == store_id,
            Customer.shopify_customer_id == shopify_id,
        )
    ).scalar_one_or_none()
    kwargs = dict(
        store_id=store_id,
        shopify_customer_id=shopify_id,
        first_name=data.get("first_name"),
        last_name=data.get("last_name"),
        email=(data.get("email") or "").lower() or None,
        phone=data.get("phone"),
        orders_count=int(data.get("orders_count") or 0),
        total_spent=_to_decimal(data.get("total_spent")),
        state=data.get("state"),
        note=data.get("note"),
        tags=data.get("tags"),
        addresses_json=data.get("addresses"),
        metafields_json=data.get("metafields"),
        last_order_id=data.get("last_order_id"),
        created_at_shopify=_parse_dt(data.get("created_at")),
        updated_at_shopify=_parse_dt(data.get("updated_at")),
    )
    if existing:
        for k, v in kwargs.items():
            setattr(existing, k, v)
        db.add(existing)
        return existing
    cust = Customer(**kwargs)
    db.add(cust)
    db.flush()
    return cust


def upsert_product(db: Session, store_id: int, data: dict) -> Product:
    shopify_id = int(data["id"])
    existing = db.execute(
        select(Product).where(
            Product.store_id == store_id,
            Product.shopify_product_id == shopify_id,
        )
    ).scalar_one_or_none()
    variants = data.get("variants") or []
    prices = [Decimal(str(v["price"])) for v in variants if v.get("price") not in (None, "")]
    sku = None
    if variants:
        sku = variants[0].get("sku")
    kwargs = dict(
        store_id=store_id,
        shopify_product_id=shopify_id,
        title=data.get("title", "")[:500],
        handle=data.get("handle"),
        body_html=data.get("body_html"),
        vendor=data.get("vendor"),
        product_type=data.get("product_type"),
        tags=data.get("tags"),
        status=data.get("status"),
        published_at=_parse_dt(data.get("published_at")),
        variants_json=variants,
        images_json=data.get("images"),
        options_json=data.get("options"),
        price_min=min(prices) if prices else None,
        price_max=max(prices) if prices else None,
        sku=sku,
        created_at_shopify=_parse_dt(data.get("created_at")),
        updated_at_shopify=_parse_dt(data.get("updated_at")),
    )
    if existing:
        for k, v in kwargs.items():
            setattr(existing, k, v)
        db.add(existing)
        return existing
    prod = Product(**kwargs)
    db.add(prod)
    db.flush()
    return prod


def upsert_order(db: Session, store_id: int, data: dict) -> Order:
    shopify_id = int(data["id"])
    existing = db.execute(
        select(Order).where(
            Order.store_id == store_id,
            Order.shopify_order_id == shopify_id,
        )
    ).scalar_one_or_none()
    scid = data.get("customer", {}).get("id") or data.get("customer_id")
    customer_id = None
    if scid:
        cust = db.execute(
            select(Customer.id).where(
                Customer.store_id == store_id,
                Customer.shopify_customer_id == int(scid),
            )
        ).scalar_one_or_none()
        customer_id = cust
    kwargs = dict(
        store_id=store_id,
        shopify_order_id=shopify_id,
        shopify_customer_id=int(scid) if scid else None,
        customer_id=customer_id,
        name=data.get("name"),
        order_number=data.get("order_number"),
        token=data.get("token"),
        status=_status_to_enum(data.get("financial_status")),
        financial_status=data.get("financial_status"),
        fulfillment_status=data.get("fulfillment_status"),
        cancel_reason=data.get("cancel_reason"),
        cancelled_at=_parse_dt(data.get("cancelled_at")),
        closed_at=_parse_dt(data.get("closed_at")),
        currency=data.get("currency"),
        subtotal_price=_to_decimal(data.get("subtotal_price")),
        total_price=_to_decimal(data.get("total_price")),
        total_tax=_to_decimal(data.get("total_tax")),
        total_discounts=_to_decimal(data.get("total_discounts")),
        total_shipping=_to_decimal(data.get("total_shipping_price_set", {}).get("shop_money", {}).get("amount") or data.get("shipping_lines", [{}])[0].get("price") if data.get("shipping_lines") else None),
        total_refunded=_to_decimal(data.get("total_refunded")),
        shipping_address_json=data.get("shipping_address"),
        billing_address_json=data.get("billing_address"),
        customer_email=data.get("customer", {}).get("email") or data.get("email"),
        customer_phone=data.get("customer", {}).get("phone") or data.get("phone"),
        line_items_json=data.get("line_items"),
        refunds_json=data.get("refunds"),
        discount_codes_json=data.get("discount_codes"),
        shipping_lines_json=data.get("shipping_lines"),
        tax_lines_json=data.get("tax_lines"),
        note=data.get("note"),
        tags=data.get("tags"),
        created_at_shopify=_parse_dt(data.get("created_at")),
        updated_at_shopify=_parse_dt(data.get("updated_at")),
        processed_at=_parse_dt(data.get("processed_at")),
    )
    if existing:
        for k, v in kwargs.items():
            setattr(existing, k, v)
        order = existing
    else:
        order = Order(**kwargs)
        db.add(order)
        db.flush()
    _upsert_order_items(db, store_id, order.id, data.get("line_items") or [])
    return order


def _upsert_order_items(db: Session, store_id: int, order_id: int, line_items: list):
    existing_items = {
        li.shopify_line_item_id: li for li in
        db.execute(select(OrderItem).where(OrderItem.order_id == order_id)).scalars().all()
    }
    processed_ids = set()
    for li in line_items:
        lid = int(li["id"])
        processed_ids.add(lid)
        variant_id = li.get("variant_id")
        product_id = None
        if li.get("product_id"):
            pid_row = db.execute(
                select(Product.id).where(
                    Product.store_id == store_id,
                    Product.shopify_product_id == int(li["product_id"]),
                )
            ).scalar_one_or_none()
            if pid_row:
                product_id = pid_row
        img = (li.get("properties") or [])
        image_url = None
        if li.get("image_url"):
            image_url = li["image_url"]
        kwargs = dict(
            store_id=store_id,
            order_id=order_id,
            product_id=product_id,
            shopify_line_item_id=lid,
            shopify_product_id=li.get("product_id"),
            shopify_variant_id=variant_id,
            title=li.get("title", "")[:500],
            variant_title=li.get("variant_title", "")[:500] if li.get("variant_title") else None,
            sku=li.get("sku"),
            quantity=int(li.get("quantity") or 0),
            price=_to_decimal(li.get("price")),
            total_discount=_to_decimal(li.get("total_discount")),
            fulfillment_status=li.get("fulfillment_status"),
            vendor=li.get("vendor"),
            requires_shipping=bool(li.get("requires_shipping", True)),
            taxable=bool(li.get("taxable", True)),
            image_url=image_url,
            properties_json=li.get("properties"),
        )
        if lid in existing_items:
            for k, v in kwargs.items():
                setattr(existing_items[lid], k, v)
            db.add(existing_items[lid])
        else:
            db.add(OrderItem(**kwargs))
    for lid, obj in existing_items.items():
        if lid not in processed_ids:
            db.delete(obj)


def upsert_fulfillments(db: Session, store_id: int, order: Order, fulfillments: list):
    for f in fulfillments:
        sfid = int(f["id"])
        existing = db.execute(
            select(Fulfillment).where(
                Fulfillment.store_id == store_id,
                Fulfillment.shopify_fulfillment_id == sfid,
            )
        ).scalar_one_or_none()
        trackings = f.get("tracking_info") or f.get("tracking_infos") or []
        kwargs = dict(
            store_id=store_id,
            order_id=order.id,
            shopify_fulfillment_id=sfid,
            status=_fulfillment_status_enum(f.get("status") or f.get("shipment_status")),
            status_display=f.get("status") or f.get("shipment_status"),
            tracking_company=f.get("tracking_company") or (trackings[0].get("company") if trackings else None),
            tracking_number=f.get("tracking_number") or (trackings[0].get("number") if trackings else None),
            tracking_urls_json=f.get("tracking_urls") or ([t.get("url") for t in trackings] if trackings else None),
            tracking_info_json=trackings or None,
            line_items_json=f.get("line_items"),
            service=f.get("service"),
            shipment_status=f.get("shipment_status"),
            notify_customer=bool(f.get("notify_customer", False)),
            created_at_shopify=_parse_dt(f.get("created_at")),
            updated_at_shopify=_parse_dt(f.get("updated_at")),
        )
        if existing:
            for k, v in kwargs.items():
                setattr(existing, k, v)
            db.add(existing)
        else:
            db.add(Fulfillment(**kwargs))


async def sync_store_async(
    store_id: int,
    force: bool = False,
    entities: Optional[List[str]] = None,
) -> Dict[str, Any]:
    db = get_db_session()
    result = {
        "customers": 0,
        "products": 0,
        "orders": 0,
        "fulfillments": 0,
        "errors": [],
    }
    try:
        store = db.get(Store, store_id)
        if not store or not store.is_connected:
            raise Exception("Store not connected")
        store.sync_status = "running"
        store.sync_message = "Starting sync..."
        db.add(store)
        db.commit()
        client = ShopifyClient(store)
        entities = entities or ["customers", "products", "orders"]

        if "customers" in entities:
            store.sync_message = "Syncing customers..."
            db.add(store); db.commit()
            try:
                async for batch in client.list_customers():
                    for c in batch:
                        try:
                            upsert_customer(db, store.id, c)
                            result["customers"] += 1
                        except Exception as e:
                            result["errors"].append(f"customer {c.get('id')}: {e}")
                    db.commit()
            except Exception as e:
                result["errors"].append(f"customers fetch: {e}")

        if "products" in entities:
            store.sync_message = "Syncing products..."
            db.add(store); db.commit()
            try:
                async for batch in client.list_products():
                    for p in batch:
                        try:
                            upsert_product(db, store.id, p)
                            result["products"] += 1
                        except Exception as e:
                            result["errors"].append(f"product {p.get('id')}: {e}")
                    db.commit()
            except Exception as e:
                result["errors"].append(f"products fetch: {e}")

        if "orders" in entities:
            store.sync_message = "Syncing orders..."
            db.add(store); db.commit()
            try:
                async for batch in client.list_orders():
                    for o in batch:
                        try:
                            order = upsert_order(db, store.id, o)
                            result["orders"] += 1
                            try:
                                fulfills = client.list_fulfillments(int(o["id"]))
                                upsert_fulfillments(db, store.id, order, fulfills)
                                result["fulfillments"] += len(fulfills)
                            except Exception:
                                pass
                        except Exception as e:
                            result["errors"].append(f"order {o.get('id')}: {e}")
                    db.commit()
            except Exception as e:
                result["errors"].append(f"orders fetch: {e}")

        store.sync_status = "completed"
        msg = f"Synced {result['customers']} customers, {result['products']} products, {result['orders']} orders"
        if result["errors"]:
            err_str = " ".join(str(e) for e in result["errors"])
            if "403" in err_str:
                msg += " (Shopify returned 403 for customers/orders: requires Protected Customer Data approval in Shopify App Settings)"
        store.sync_message = msg
        store.last_sync_at = datetime.utcnow()
        db.add(store)
        db.commit()
        try:
            from .ai_agent import invalidate_store_cache
            invalidate_store_cache(store.id)
        except Exception:
            pass
    except Exception as e:
        logger.exception("Sync failed")
        result["errors"].append(str(e))
        try:
            store.sync_status = "failed"
            store.sync_message = str(e)[:500]
            db.add(store)
            db.commit()
        except Exception:
            pass
    finally:
        db.close()
    return result


def run_sync(store_id: int, force: bool = False, entities: Optional[List[str]] = None):
    asyncio.run(sync_store_async(store_id, force, entities))
