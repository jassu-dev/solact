from datetime import datetime
from typing import Optional, List, Any
from pydantic import BaseModel, ConfigDict
from decimal import Decimal


class ORMBase(BaseModel):
    model_config = ConfigDict(from_attributes=True)


class StoreResponse(ORMBase):
    id: int
    organization_id: int
    shopify_domain: str
    shopify_store_id: Optional[int] = None
    name: Optional[str] = None
    is_connected: bool
    sync_status: Optional[str] = None
    sync_message: Optional[str] = None
    last_sync_at: Optional[datetime] = None
    created_at: datetime


class ShopifyInstallUrl(BaseModel):
    install_url: str


class StoreListResponse(BaseModel):
    stores: List[StoreResponse]
    total: int


class CustomerResponse(ORMBase):
    id: int
    store_id: int
    shopify_customer_id: int
    first_name: Optional[str] = None
    last_name: Optional[str] = None
    email: Optional[str] = None
    phone: Optional[str] = None
    orders_count: int = 0
    total_spent: Optional[Decimal] = None
    state: Optional[str] = None
    tags: Optional[str] = None
    created_at_shopify: Optional[datetime] = None
    updated_at_shopify: Optional[datetime] = None
    created_at: datetime


class ProductResponse(ORMBase):
    id: int
    store_id: int
    shopify_product_id: int
    title: str
    handle: Optional[str] = None
    vendor: Optional[str] = None
    product_type: Optional[str] = None
    status: Optional[str] = None
    tags: Optional[str] = None
    price_min: Optional[Decimal] = None
    price_max: Optional[Decimal] = None
    sku: Optional[str] = None
    created_at_shopify: Optional[datetime] = None
    updated_at_shopify: Optional[datetime] = None


class OrderItemResponse(ORMBase):
    id: int
    order_id: int
    product_id: Optional[int] = None
    shopify_product_id: Optional[int] = None
    shopify_variant_id: Optional[int] = None
    title: Optional[str] = None
    variant_title: Optional[str] = None
    sku: Optional[str] = None
    quantity: int = 1
    price: Optional[Decimal] = None
    total_discount: Optional[Decimal] = None
    fulfillment_status: Optional[str] = None
    vendor: Optional[str] = None
    image_url: Optional[str] = None


class FulfillmentResponse(ORMBase):
    id: int
    order_id: int
    shopify_fulfillment_id: int
    status: Optional[str] = None
    status_display: Optional[str] = None
    tracking_company: Optional[str] = None
    tracking_number: Optional[str] = None
    tracking_urls_json: Optional[Any] = None
    service: Optional[str] = None


class OrderResponse(ORMBase):
    id: int
    store_id: int
    shopify_order_id: int
    shopify_customer_id: Optional[int] = None
    customer_id: Optional[int] = None
    name: Optional[str] = None
    order_number: Optional[int] = None
    status: Optional[str] = None
    financial_status: Optional[str] = None
    fulfillment_status: Optional[str] = None
    cancel_reason: Optional[str] = None
    cancelled_at: Optional[datetime] = None
    currency: Optional[str] = None
    subtotal_price: Optional[Decimal] = None
    total_price: Optional[Decimal] = None
    total_tax: Optional[Decimal] = None
    total_discounts: Optional[Decimal] = None
    total_shipping: Optional[Decimal] = None
    total_refunded: Optional[Decimal] = None
    shipping_address_json: Optional[Any] = None
    customer_email: Optional[str] = None
    customer_phone: Optional[str] = None
    tags: Optional[str] = None
    note: Optional[str] = None
    created_at_shopify: Optional[datetime] = None
    updated_at_shopify: Optional[datetime] = None
    created_at: datetime
    items: Optional[List[OrderItemResponse]] = None
    fulfillments: Optional[List[FulfillmentResponse]] = None


class SyncRequest(BaseModel):
    force: bool = False
    entities: Optional[List[str]] = None


class SyncStatusResponse(BaseModel):
    sync_status: str
    sync_message: Optional[str] = None
    last_sync_at: Optional[datetime] = None
    customers_count: int = 0
    products_count: int = 0
    orders_count: int = 0
