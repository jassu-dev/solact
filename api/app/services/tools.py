import logging
import re
from datetime import datetime, timedelta
from typing import Optional, Dict, Any, List, Tuple, Callable
from sqlalchemy.orm import Session
from sqlalchemy import select, or_, and_

from ..models import (
    Customer, Order, Product, Fulfillment, OrderItem, Store,
    OrderStatus,
)
from .shopify_client import ShopifyClient

logger = logging.getLogger(__name__)


class ToolError(Exception):
    pass


class ToolValidationError(ToolError):
    pass


class ToolExecutionError(ToolError):
    pass


class ToolDefinition:
    def __init__(self, name: str, description: str, parameters: dict,
                 fn: Callable):
        self.name = name
        self.description = description
        self.parameters = parameters
        self.fn = fn


def _json_schema_type(typ: str, description: str = "", required: bool = True, enum_values: Optional[List[str]] = None):
    s = {"type": typ, "description": description}
    if enum_values:
        s["enum"] = enum_values
    return s


TOOL_DEFINITIONS: Dict[str, ToolDefinition] = {}


def register_tool(name: str, description: str, parameters: dict):
    def decorator(fn):
        TOOL_DEFINITIONS[name] = ToolDefinition(name, description, parameters, fn)
        return fn
    return decorator


def _find_customer(
    db: Session, store_id: int,
    email: Optional[str] = None,
    phone: Optional[str] = None,
    customer_id: Optional[int] = None,
    shopify_customer_id: Optional[int] = None,
) -> Optional[Customer]:
    q = select(Customer).where(Customer.store_id == store_id)
    if customer_id:
        q = q.where(Customer.id == customer_id)
        return db.execute(q).scalar_one_or_none()
    if shopify_customer_id:
        q = q.where(Customer.shopify_customer_id == shopify_customer_id)
        return db.execute(q).scalar_one_or_none()
    conditions = []
    if email:
        conditions.append(Customer.email == email.lower())
    if phone:
        cleaned_phone = re.sub(r"\D", "", phone or "")
        if cleaned_phone:
            conditions.append(Customer.phone.op("~")(f"\\D*{cleaned_phone}\\D*"))
    if not conditions:
        return None
    return db.execute(q.where(or_(*conditions))).scalar_one_or_none()


def _find_order(
    db: Session, store_id: int,
    order_name: Optional[str] = None,
    order_id: Optional[int] = None,
    shopify_order_id: Optional[int] = None,
) -> Optional[Order]:
    q = select(Order).where(Order.store_id == store_id)
    if order_id:
        return db.get(Order, order_id)
    if shopify_order_id:
        q = q.where(Order.shopify_order_id == shopify_order_id)
        return db.execute(q).scalar_one_or_none()
    if order_name:
        name_norm = (order_name or "").strip().lstrip("#").strip()
        q_name = q.where(or_(
            Order.name.ilike(f"%{name_norm}%"),
            Order.order_number == (int(name_norm) if name_norm.isdigit() else None),
        ))
        return db.execute(q_name).scalar_one_or_none()
    return None


def _customer_to_dict(c: Customer) -> Dict[str, Any]:
    return {
        "id": c.id,
        "shopify_customer_id": c.shopify_customer_id,
        "first_name": c.first_name,
        "last_name": c.last_name,
        "name": f"{c.first_name or ''} {c.last_name or ''}".strip() or None,
        "email": c.email,
        "phone": c.phone,
        "orders_count": c.orders_count,
        "total_spent": str(c.total_spent) if c.total_spent is not None else None,
        "state": c.state,
        "tags": c.tags,
    }


def _product_to_dict(p: Product) -> Dict[str, Any]:
    return {
        "id": p.id,
        "shopify_product_id": p.shopify_product_id,
        "title": p.title,
        "handle": p.handle,
        "vendor": p.vendor,
        "product_type": p.product_type,
        "status": p.status,
        "price_min": str(p.price_min) if p.price_min else None,
        "price_max": str(p.price_max) if p.price_max else None,
        "sku": p.sku,
    }


def _order_to_dict(o: Order, include_items: bool = True, include_fulfillments: bool = True, db: Optional[Session] = None) -> Dict[str, Any]:
    data = {
        "id": o.id,
        "shopify_order_id": o.shopify_order_id,
        "name": o.name,
        "order_number": o.order_number,
        "status": o.status.value if o.status else None,
        "financial_status": o.financial_status,
        "fulfillment_status": o.fulfillment_status,
        "cancel_reason": o.cancel_reason,
        "cancelled_at": o.cancelled_at.isoformat() if o.cancelled_at else None,
        "closed_at": o.closed_at.isoformat() if o.closed_at else None,
        "currency": o.currency,
        "subtotal_price": str(o.subtotal_price) if o.subtotal_price else None,
        "total_price": str(o.total_price) if o.total_price else None,
        "total_tax": str(o.total_tax) if o.total_tax else None,
        "total_discounts": str(o.total_discounts) if o.total_discounts else None,
        "total_shipping": str(o.total_shipping) if o.total_shipping else None,
        "total_refunded": str(o.total_refunded) if o.total_refunded else None,
        "shipping_address": o.shipping_address_json,
        "billing_address": o.billing_address_json,
        "customer_email": o.customer_email,
        "customer_phone": o.customer_phone,
        "note": o.note,
        "tags": o.tags,
        "created_at": o.created_at_shopify.isoformat() if o.created_at_shopify else None,
        "updated_at": o.updated_at_shopify.isoformat() if o.updated_at_shopify else None,
        "processed_at": o.processed_at.isoformat() if o.processed_at else None,
    }
    if include_items and db is not None:
        items = db.execute(select(OrderItem).where(OrderItem.order_id == o.id)).scalars().all()
        data["items"] = [_item_to_dict(i) for i in items]
    if include_fulfillments and db is not None:
        fulfills = db.execute(select(Fulfillment).where(Fulfillment.order_id == o.id)).scalars().all()
        data["fulfillments"] = [_fulfillment_to_dict(f) for f in fulfills]
    return data


def _item_to_dict(i: OrderItem) -> Dict[str, Any]:
    return {
        "id": i.id,
        "shopify_line_item_id": i.shopify_line_item_id,
        "shopify_product_id": i.shopify_product_id,
        "shopify_variant_id": i.shopify_variant_id,
        "title": i.title,
        "variant_title": i.variant_title,
        "sku": i.sku,
        "quantity": i.quantity,
        "price": str(i.price) if i.price else None,
        "total_discount": str(i.total_discount) if i.total_discount else None,
        "fulfillment_status": i.fulfillment_status,
        "vendor": i.vendor,
        "image_url": i.image_url,
        "properties": i.properties_json,
    }


def _fulfillment_to_dict(f: Fulfillment) -> Dict[str, Any]:
    urls = None
    if f.tracking_urls_json and isinstance(f.tracking_urls_json, list):
        urls = f.tracking_urls_json
    return {
        "id": f.id,
        "shopify_fulfillment_id": f.shopify_fulfillment_id,
        "status": f.status.value if f.status else None,
        "status_display": f.status_display,
        "tracking_company": f.tracking_company,
        "tracking_number": f.tracking_number,
        "tracking_urls": urls,
        "service": f.service,
        "shipment_status": f.shipment_status,
        "created_at": f.created_at_shopify.isoformat() if f.created_at_shopify else None,
        "updated_at": f.updated_at_shopify.isoformat() if f.updated_at_shopify else None,
    }


@register_tool(
    "get_customer",
    "Retrieve customer profile and info by email, phone, or ID.",
    {
        "type": "object",
        "properties": {
            "email": {"type": "string", "description": "Customer email address"},
            "phone": {"type": "string", "description": "Customer phone number"},
            "customer_id": {"type": "integer", "description": "Internal Solact customer ID"},
            "shopify_customer_id": {"type": "integer", "description": "Shopify customer ID"},
        },
        "oneOf": [
            {"required": ["email"]},
            {"required": ["phone"]},
            {"required": ["customer_id"]},
            {"required": ["shopify_customer_id"]},
        ],
    },
)
def get_customer_tool(db: Session, store: Store, args: Dict[str, Any]) -> Dict[str, Any]:
    customer = _find_customer(
        db, store.id,
        email=args.get("email"),
        phone=args.get("phone"),
        customer_id=args.get("customer_id"),
        shopify_customer_id=args.get("shopify_customer_id"),
    )
    if not customer:
        return {"found": False, "message": "Customer not found in store records"}
    data = _customer_to_dict(customer)
    recent_orders = db.execute(
        select(Order).where(and_(
            Order.store_id == store.id,
            Order.customer_id == customer.id,
        )).order_by(Order.created_at_shopify.desc()).limit(5)
    ).scalars().all()
    data["recent_orders_count"] = len(recent_orders)
    data["recent_orders"] = [
        {"id": o.id, "name": o.name, "total_price": str(o.total_price), "status": o.financial_status}
        for o in recent_orders
    ]
    return {"found": True, "customer": data}


@register_tool(
    "get_order",
    "Get a specific order details (items, shipping, fulfillments, tracking) by order name (#10492) or ID.",
    {
        "type": "object",
        "properties": {
            "order_name": {"type": "string", "description": "Order name, e.g. #10492 or 10492"},
            "order_id": {"type": "integer", "description": "Internal Solact order ID"},
            "shopify_order_id": {"type": "integer", "description": "Shopify order ID"},
        },
        "oneOf": [
            {"required": ["order_name"]},
            {"required": ["order_id"]},
            {"required": ["shopify_order_id"]},
        ],
    },
)
def get_order_tool(db: Session, store: Store, args: Dict[str, Any]) -> Dict[str, Any]:
    order = _find_order(
        db, store.id,
        order_name=args.get("order_name"),
        order_id=args.get("order_id"),
        shopify_order_id=args.get("shopify_order_id"),
    )
    if not order:
        return {"found": False, "message": "Order not found"}
    return {"found": True, "order": _order_to_dict(order, include_items=True, include_fulfillments=True, db=db)}


@register_tool(
    "get_orders",
    "List orders for a customer, typically by customer email or ID, or most recent orders.",
    {
        "type": "object",
        "properties": {
            "customer_email": {"type": "string", "description": "Customer email"},
            "customer_id": {"type": "integer", "description": "Internal Solact customer ID"},
            "shopify_customer_id": {"type": "integer", "description": "Shopify customer ID"},
            "limit": {"type": "integer", "default": 10, "description": "Maximum number of orders to return (max 25)"},
        },
    },
)
def get_orders_tool(db: Session, store: Store, args: Dict[str, Any]) -> Dict[str, Any]:
    customer = None
    if args.get("customer_id") or args.get("shopify_customer_id") or args.get("customer_email"):
        customer = _find_customer(
            db, store.id,
            email=args.get("customer_email"),
            customer_id=args.get("customer_id"),
            shopify_customer_id=args.get("shopify_customer_id"),
        )
    limit = min(25, max(1, int(args.get("limit") or 10)))
    q = select(Order).where(Order.store_id == store.id)
    if customer:
        q = q.where(Order.customer_id == customer.id)
    q = q.order_by(Order.created_at_shopify.desc()).limit(limit)
    orders = db.execute(q).scalars().all()
    return {
        "count": len(orders),
        "customer_found": customer is not None,
        "orders": [_order_to_dict(o, include_items=False, include_fulfillments=False) for o in orders],
    }


@register_tool(
    "get_product",
    "Look up a product by name/handle/sku/ID to answer about price, availability, details.",
    {
        "type": "object",
        "properties": {
            "query": {"type": "string", "description": "Search query - product name, handle, or SKU"},
            "product_id": {"type": "integer", "description": "Internal Solact product ID"},
            "shopify_product_id": {"type": "integer", "description": "Shopify product ID"},
            "limit": {"type": "integer", "default": 5, "description": "Max search results (max 10)"},
        },
    },
)
def get_product_tool(db: Session, store: Store, args: Dict[str, Any]) -> Dict[str, Any]:
    limit = min(10, max(1, int(args.get("limit") or 5)))
    if args.get("product_id"):
        p = db.get(Product, args["product_id"])
        if p and p.store_id == store.id:
            return {"count": 1, "products": [_product_to_dict(p)]}
        return {"count": 0, "products": []}
    if args.get("shopify_product_id"):
        p = db.execute(
            select(Product).where(
                Product.store_id == store.id,
                Product.shopify_product_id == args["shopify_product_id"],
            )
        ).scalar_one_or_none()
        if p:
            return {"count": 1, "products": [_product_to_dict(p)]}
        return {"count": 0, "products": []}
    qs = (args.get("query") or "").strip()
    if not qs:
        return {"count": 0, "products": [], "message": "No search query provided"}
    like = f"%{qs}%"
    products = db.execute(
        select(Product).where(
            Product.store_id == store.id,
            or_(
                Product.title.ilike(like),
                Product.handle.ilike(like),
                Product.sku.ilike(like),
                Product.vendor.ilike(like),
            ),
        ).limit(limit)
    ).scalars().all()
    return {"count": len(products), "products": [_product_to_dict(p) for p in products]}


@register_tool(
    "get_tracking",
    "Get tracking and fulfillment details for a specific order. Includes tracking number, carrier, URLs, status.",
    {
        "type": "object",
        "properties": {
            "order_name": {"type": "string", "description": "Order name (#10492 or 10492)"},
            "order_id": {"type": "integer", "description": "Internal Solact order ID"},
            "shopify_order_id": {"type": "integer", "description": "Shopify order ID"},
        },
        "oneOf": [
            {"required": ["order_name"]},
            {"required": ["order_id"]},
            {"required": ["shopify_order_id"]},
        ],
    },
)
def get_tracking_tool(db: Session, store: Store, args: Dict[str, Any]) -> Dict[str, Any]:
    order = _find_order(
        db, store.id,
        order_name=args.get("order_name"),
        order_id=args.get("order_id"),
        shopify_order_id=args.get("shopify_order_id"),
    )
    if not order:
        return {"found": False, "message": "Order not found"}
    fulfills = db.execute(
        select(Fulfillment).where(Fulfillment.order_id == order.id)
    ).scalars().all()
    return {
        "found": True,
        "order_name": order.name,
        "order_number": order.order_number,
        "fulfillment_status": order.fulfillment_status,
        "fulfillments": [_fulfillment_to_dict(f) for f in fulfills],
        "items_shipped": len(fulfills),
    }


@register_tool(
    "check_return_eligibility",
    "Check whether an order/items may be eligible for return or refund. V1 does NOT issue refunds, this is informational only.",
    {
        "type": "object",
        "properties": {
            "order_name": {"type": "string", "description": "Order name (#10492 or 10492)"},
            "order_id": {"type": "integer", "description": "Internal Solact order ID"},
            "shopify_order_id": {"type": "integer", "description": "Shopify order ID"},
        },
        "oneOf": [
            {"required": ["order_name"]},
            {"required": ["order_id"]},
            {"required": ["shopify_order_id"]},
        ],
    },
)
def check_return_eligibility_tool(db: Session, store: Store, args: Dict[str, Any]) -> Dict[str, Any]:
    order = _find_order(
        db, store.id,
        order_name=args.get("order_name"),
        order_id=args.get("order_id"),
        shopify_order_id=args.get("shopify_order_id"),
    )
    if not order:
        return {"eligible": False, "message": "Order not found"}
    created = order.created_at_shopify or order.processed_at or order.created_at
    days_since = None
    if created:
        days_since = (datetime.utcnow() - created.replace(tzinfo=None)).days
    total_refunded = float(order.total_refunded or 0)
    total_price = float(order.total_price or 0)
    fully_refunded = total_price > 0 and total_refunded >= total_price
    status_ok = order.status not in (OrderStatus.refunded, OrderStatus.voided, OrderStatus.cancelled, OrderStatus.archived)
    window_ok = days_since is None or days_since <= 60
    eligible = status_ok and window_ok and not fully_refunded
    reasons = []
    if not status_ok:
        reasons.append(f"Order status is {order.status.value if order.status else 'unknown'}")
    if fully_refunded:
        reasons.append("Order is already fully refunded")
    if not window_ok:
        reasons.append(f"Order is {days_since} days old (typical window is 30-60 days)")
    return {
        "eligible": eligible,
        "order_name": order.name,
        "order_status": order.status.value if order.status else None,
        "days_since_order": days_since,
        "total_price": str(order.total_price),
        "total_refunded": str(order.total_refunded),
        "fully_refunded": fully_refunded,
        "notes": [
            "This is informational only. Actual refund/return policy is determined by store policy.",
            "To request a refund or return, a human agent must be consulted.",
        ],
        "reasons_why_not_eligible": reasons if not eligible else [],
    }


ESCALATE_TOOL = ToolDefinition(
    "escalate_to_human",
    "Escalate this conversation to a human support agent. Use when you cannot answer, the customer is frustrated, or a sensitive action (refund, cancel, discount) is requested.",
    {
        "type": "object",
        "properties": {
            "reason": {"type": "string", "description": "Reason for escalation (1-2 sentences) - what does the human need to help with?"},
        },
        "required": ["reason"],
    },
    lambda *a, **k: {"escalated": True, "note": "Escalation requested. Human will respond shortly."},
)


def validate_and_execute(
    db: Session,
    store: Store,
    tool_name: str,
    arguments: Dict[str, Any],
) -> Tuple[bool, str, Optional[Dict[str, Any]]]:
    if tool_name == "escalate_to_human":
        tool = ESCALATE_TOOL
    else:
        tool = TOOL_DEFINITIONS.get(tool_name)
        if not tool:
            return False, f"Unknown tool: {tool_name}", None
    if not isinstance(arguments, dict):
        return False, "Tool arguments must be a JSON object", None
    try:
        if tool_name == "escalate_to_human":
            result = tool.fn(db, store, arguments)
        else:
            result = tool.fn(db, store, arguments)
        return True, "", result
    except ToolValidationError as e:
        return False, str(e), None
    except Exception as e:
        logger.exception(f"Tool {tool_name} failed")
        return False, f"Execution error: {e}", None


def tools_json_schema(for_llm: bool = True) -> List[Dict[str, Any]]:
    schema = []
    for tool in list(TOOL_DEFINITIONS.values()) + [ESCALATE_TOOL]:
        schema.append({
            "type": "function",
            "function": {
                "name": tool.name,
                "description": tool.description,
                "parameters": tool.parameters,
            },
        })
    return schema
