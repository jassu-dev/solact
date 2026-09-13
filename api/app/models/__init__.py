from datetime import datetime
from sqlalchemy import (
    Column, Integer, BigInteger, String, Text, DateTime, ForeignKey,
    Boolean, Numeric, JSON, Index, UniqueConstraint, Float, Enum,
)
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
from pgvector.sqlalchemy import Vector
import enum
from ..database import Base
from ..config import settings


class TenantMixin:
    organization_id = Column(BigInteger, ForeignKey("organizations.id", ondelete="CASCADE"), nullable=False, index=True)


class StoreScopedMixin:
    store_id = Column(BigInteger, ForeignKey("stores.id", ondelete="CASCADE"), nullable=False, index=True)


class Organization(Base):
    __tablename__ = "organizations"

    id = Column(BigInteger, primary_key=True, autoincrement=True)
    name = Column(String(255), nullable=False)
    slug = Column(String(128), nullable=False, unique=True, index=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())

    users = relationship("User", back_populates="organization", cascade="all, delete-orphan")
    stores = relationship("Store", back_populates="organization", cascade="all, delete-orphan")
    documents = relationship("Document", back_populates="organization", cascade="all, delete-orphan")
    audit_logs = relationship("AuditLog", back_populates="organization", cascade="all, delete-orphan")


class User(Base):
    __tablename__ = "users"

    id = Column(BigInteger, primary_key=True, autoincrement=True)
    organization_id = Column(BigInteger, ForeignKey("organizations.id", ondelete="CASCADE"), nullable=False, index=True)
    email = Column(String(255), nullable=False, unique=True, index=True)
    name = Column(String(255))
    password_hash = Column(Text, nullable=False)
    role = Column(String(32), default="owner")
    is_active = Column(Boolean, default=True, nullable=False)
    is_verified = Column(Boolean, default=False, nullable=False)
    last_login_at = Column(DateTime(timezone=True))
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())

    organization = relationship("Organization", back_populates="users")
    ai_runs = relationship("AIRun", back_populates="user")


class Store(Base):
    __tablename__ = "stores"

    id = Column(BigInteger, primary_key=True, autoincrement=True)
    organization_id = Column(BigInteger, ForeignKey("organizations.id", ondelete="CASCADE"), nullable=False, index=True)
    shopify_domain = Column(String(255), nullable=False, unique=True, index=True)
    shopify_store_id = Column(BigInteger, index=True)
    name = Column(String(255))
    access_token_enc = Column(Text)
    scope = Column(Text)
    is_connected = Column(Boolean, default=False, nullable=False)
    webhook_id_customers = Column(BigInteger)
    webhook_id_products = Column(BigInteger)
    webhook_id_orders = Column(BigInteger)
    last_sync_at = Column(DateTime(timezone=True))
    sync_status = Column(String(32), default="idle")
    sync_message = Column(Text)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())

    organization = relationship("Organization", back_populates="stores")
    customers = relationship("Customer", back_populates="store", cascade="all, delete-orphan")
    products = relationship("Product", back_populates="store", cascade="all, delete-orphan")
    orders = relationship("Order", back_populates="store", cascade="all, delete-orphan")
    conversations = relationship("Conversation", back_populates="store", cascade="all, delete-orphan")
    knowledge_chunks = relationship("KnowledgeChunk", back_populates="store", cascade="all, delete-orphan")


class Customer(Base, StoreScopedMixin):
    __tablename__ = "customers"
    __table_args__ = (
        UniqueConstraint("store_id", "shopify_customer_id", name="uq_customer_store_shopify_id"),
        Index("ix_customer_store_email", "store_id", "email"),
    )

    id = Column(BigInteger, primary_key=True, autoincrement=True)
    shopify_customer_id = Column(BigInteger, nullable=False, index=True)
    first_name = Column(String(255))
    last_name = Column(String(255))
    email = Column(String(255), index=True)
    phone = Column(String(64))
    orders_count = Column(Integer, default=0)
    total_spent = Column(Numeric(14, 2), default=0)
    state = Column(String(32))
    note = Column(Text)
    tags = Column(Text)
    addresses_json = Column(JSON)
    metafields_json = Column(JSON)
    last_order_id = Column(BigInteger)
    created_at_shopify = Column(DateTime(timezone=True))
    updated_at_shopify = Column(DateTime(timezone=True))
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())

    store = relationship("Store", back_populates="customers")
    orders = relationship("Order", back_populates="customer")


class Product(Base, StoreScopedMixin):
    __tablename__ = "products"
    __table_args__ = (
        UniqueConstraint("store_id", "shopify_product_id", name="uq_product_store_shopify_id"),
    )

    id = Column(BigInteger, primary_key=True, autoincrement=True)
    shopify_product_id = Column(BigInteger, nullable=False, index=True)
    title = Column(String(500), nullable=False)
    handle = Column(String(500))
    body_html = Column(Text)
    vendor = Column(String(255))
    product_type = Column(String(255))
    tags = Column(Text)
    status = Column(String(32))
    published_at = Column(DateTime(timezone=True))
    variants_json = Column(JSON)
    images_json = Column(JSON)
    options_json = Column(JSON)
    price_min = Column(Numeric(14, 2))
    price_max = Column(Numeric(14, 2))
    sku = Column(String(255))
    created_at_shopify = Column(DateTime(timezone=True))
    updated_at_shopify = Column(DateTime(timezone=True))
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())

    store = relationship("Store", back_populates="products")
    order_items = relationship("OrderItem", back_populates="product")


class OrderStatus(enum.Enum):
    pending = "pending"
    authorized = "authorized"
    partially_paid = "partially_paid"
    paid = "paid"
    partially_refunded = "partially_refunded"
    refunded = "refunded"
    voided = "voided"
    archived = "archived"
    cancelled = "cancelled"


class Order(Base, StoreScopedMixin):
    __tablename__ = "orders"
    __table_args__ = (
        UniqueConstraint("store_id", "shopify_order_id", name="uq_order_store_shopify_id"),
        Index("ix_order_store_customer_id", "store_id", "shopify_customer_id"),
        Index("ix_order_store_name", "store_id", "name"),
    )

    id = Column(BigInteger, primary_key=True, autoincrement=True)
    shopify_order_id = Column(BigInteger, nullable=False, index=True)
    shopify_customer_id = Column(BigInteger, index=True)
    customer_id = Column(BigInteger, ForeignKey("customers.id", ondelete="SET NULL"), index=True)
    name = Column(String(64), index=True)
    order_number = Column(Integer, index=True)
    token = Column(String(64))
    status = Column(Enum(OrderStatus), default=OrderStatus.pending)
    financial_status = Column(String(64))
    fulfillment_status = Column(String(64))
    cancel_reason = Column(String(255))
    cancelled_at = Column(DateTime(timezone=True))
    closed_at = Column(DateTime(timezone=True))
    currency = Column(String(16))
    subtotal_price = Column(Numeric(14, 2))
    total_price = Column(Numeric(14, 2))
    total_tax = Column(Numeric(14, 2))
    total_discounts = Column(Numeric(14, 2))
    total_shipping = Column(Numeric(14, 2))
    total_refunded = Column(Numeric(14, 2))
    shipping_address_json = Column(JSON)
    billing_address_json = Column(JSON)
    customer_email = Column(String(255))
    customer_phone = Column(String(64))
    line_items_json = Column(JSON)
    refunds_json = Column(JSON)
    discount_codes_json = Column(JSON)
    shipping_lines_json = Column(JSON)
    tax_lines_json = Column(JSON)
    note = Column(Text)
    tags = Column(Text)
    created_at_shopify = Column(DateTime(timezone=True))
    updated_at_shopify = Column(DateTime(timezone=True))
    processed_at = Column(DateTime(timezone=True))
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())

    store = relationship("Store", back_populates="orders")
    customer = relationship("Customer", back_populates="orders")
    order_items = relationship("OrderItem", back_populates="order", cascade="all, delete-orphan")
    fulfillments = relationship("Fulfillment", back_populates="order", cascade="all, delete-orphan")


class OrderItem(Base):
    __tablename__ = "order_items"

    id = Column(BigInteger, primary_key=True, autoincrement=True)
    store_id = Column(BigInteger, ForeignKey("stores.id", ondelete="CASCADE"), nullable=False, index=True)
    order_id = Column(BigInteger, ForeignKey("orders.id", ondelete="CASCADE"), nullable=False, index=True)
    product_id = Column(BigInteger, ForeignKey("products.id", ondelete="SET NULL"), index=True)
    shopify_line_item_id = Column(BigInteger, index=True)
    shopify_product_id = Column(BigInteger, index=True)
    shopify_variant_id = Column(BigInteger, index=True)
    title = Column(String(500))
    variant_title = Column(String(500))
    sku = Column(String(255))
    quantity = Column(Integer, default=1)
    price = Column(Numeric(14, 2))
    total_discount = Column(Numeric(14, 2))
    fulfillment_status = Column(String(64))
    vendor = Column(String(255))
    requires_shipping = Column(Boolean, default=True)
    taxable = Column(Boolean, default=True)
    image_url = Column(Text)
    properties_json = Column(JSON)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())

    __table_args__ = (
        UniqueConstraint("order_id", "shopify_line_item_id", name="uq_orderitem_order_lineitem"),
    )

    order = relationship("Order", back_populates="order_items")
    product = relationship("Product", back_populates="order_items")


class FulfillmentStatus(enum.Enum):
    pending = "pending"
    open = "open"
    in_transit = "in_transit"
    out_for_delivery = "out_for_delivery"
    delivered = "delivered"
    failure = "failure"
    cancelled = "cancelled"
    error = "error"


class Fulfillment(Base):
    __tablename__ = "fulfillments"

    id = Column(BigInteger, primary_key=True, autoincrement=True)
    store_id = Column(BigInteger, ForeignKey("stores.id", ondelete="CASCADE"), nullable=False, index=True)
    order_id = Column(BigInteger, ForeignKey("orders.id", ondelete="CASCADE"), nullable=False, index=True)
    shopify_fulfillment_id = Column(BigInteger, nullable=False, index=True)
    status = Column(Enum(FulfillmentStatus), default=FulfillmentStatus.pending)
    status_display = Column(String(64))
    tracking_company = Column(String(255))
    tracking_number = Column(String(255))
    tracking_urls_json = Column(JSON)
    tracking_info_json = Column(JSON)
    line_items_json = Column(JSON)
    service = Column(String(64))
    shipment_status = Column(String(64))
    notify_customer = Column(Boolean, default=False)
    created_at_shopify = Column(DateTime(timezone=True))
    updated_at_shopify = Column(DateTime(timezone=True))
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())

    __table_args__ = (
        UniqueConstraint("store_id", "shopify_fulfillment_id", name="uq_fulfillment_store_shopify_id"),
    )

    order = relationship("Order", back_populates="fulfillments")


class ConversationStatus(enum.IntEnum):
    open = 0
    resolved = 1
    pending = 2
    snoozed = 3
    ai_handling = 0
    awaiting_human = 2
    human_handling = 2
    closed = 1


class Conversation(Base, TenantMixin):
    __tablename__ = "conversations"

    id = Column(BigInteger, primary_key=True, autoincrement=True)
    store_id = Column(BigInteger, ForeignKey("stores.id", ondelete="CASCADE"), nullable=True, index=True)
    account_id = Column(Integer, default=1)
    inbox_id = Column(Integer, default=1)
    display_id = Column(Integer)
    conversation_key = Column(String(255), index=True)
    chatwoot_conversation_id = Column(BigInteger, index=True)
    chatwoot_inbox_id = Column(BigInteger)
    customer_id = Column(BigInteger, ForeignKey("customers.id", ondelete="SET NULL"), index=True)
    customer_identifier = Column(String(255), index=True)
    customer_name = Column(String(255))
    customer_email = Column(String(255))
    customer_phone = Column(String(64))
    status = Column(Integer, default=0)
    escalated = Column(Boolean, default=False)
    escalated_reason = Column(String(500))
    escalated_at = Column(DateTime(timezone=True))
    last_message_at = Column(DateTime(timezone=True))
    ai_reply_count = Column(Integer, default=0)
    human_reply_count = Column(Integer, default=0)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())

    store = relationship("Store", back_populates="conversations")
    messages = relationship("Message", back_populates="conversation", cascade="all, delete-orphan")
    ai_runs = relationship("AIRun", back_populates="conversation")


class MessageRole(enum.Enum):
    customer = "customer"
    ai = "ai"
    human = "human"
    system = "system"


class Message(Base):
    __tablename__ = "messages"

    id = Column(BigInteger, primary_key=True, autoincrement=True)
    account_id = Column(Integer, default=1)
    inbox_id = Column(Integer, default=1)
    message_type = Column(Integer, default=0)
    content_type = Column(Integer, default=0)
    private = Column(Boolean, default=False)
    organization_id = Column(BigInteger, ForeignKey("organizations.id", ondelete="CASCADE"), nullable=True, index=True)
    conversation_id = Column(BigInteger, ForeignKey("conversations.id", ondelete="CASCADE"), nullable=False, index=True)
    chatwoot_message_id = Column(BigInteger, index=True)
    role = Column(Enum(MessageRole), nullable=False)
    content = Column(Text, nullable=False)
    content_html = Column(Text)
    attachments_json = Column(JSON)
    external_id = Column(String(255), index=True)
    ai_run_id = Column(BigInteger, ForeignKey("ai_runs.id", ondelete="SET NULL"), index=True)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    conversation = relationship("Conversation", back_populates="messages")
    ai_run = relationship("AIRun", back_populates="messages")


class DocType(enum.Enum):
    website = "website"
    shipping_policy = "shipping_policy"
    return_policy = "return_policy"
    warranty = "warranty"
    faq = "faq"
    text = "text"


class Document(Base, TenantMixin):
    __tablename__ = "documents"

    id = Column(BigInteger, primary_key=True, autoincrement=True)
    store_id = Column(BigInteger, ForeignKey("stores.id", ondelete="CASCADE"), nullable=False, index=True)
    doc_type = Column(Enum(DocType), nullable=False)
    title = Column(String(500))
    source_url = Column(Text)
    content_raw = Column(Text)
    content_clean = Column(Text)
    status = Column(String(32), default="pending")
    error_message = Column(Text)
    metadata_json = Column(JSON)
    chunk_count = Column(Integer, default=0)
    last_chunked_at = Column(DateTime(timezone=True))
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())

    organization = relationship("Organization", back_populates="documents")
    chunks = relationship("KnowledgeChunk", back_populates="document", cascade="all, delete-orphan")


class KnowledgeChunk(Base):
    __tablename__ = "knowledge_chunks"

    id = Column(BigInteger, primary_key=True, autoincrement=True)
    organization_id = Column(BigInteger, ForeignKey("organizations.id", ondelete="CASCADE"), nullable=False, index=True)
    store_id = Column(BigInteger, ForeignKey("stores.id", ondelete="CASCADE"), nullable=False, index=True)
    document_id = Column(BigInteger, ForeignKey("documents.id", ondelete="CASCADE"), nullable=False, index=True)
    chunk_index = Column(Integer, default=0)
    chunk_text = Column(Text, nullable=False)
    embedding = Column(Vector(settings.EMBEDDING_DIM))
    metadata_json = Column(JSON)
    token_count = Column(Integer)
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    __table_args__ = (
        Index(
            "ix_knowledge_chunks_embedding",
            "embedding",
            postgresql_using="hnsw",
            postgresql_ops={"embedding": "vector_cosine_ops"},
        ),
    )

    store = relationship("Store", back_populates="knowledge_chunks")
    document = relationship("Document", back_populates="chunks")


class RunStatus(enum.Enum):
    pending = "pending"
    running = "running"
    completed = "completed"
    failed = "failed"
    escalated = "escalated"


class AIRun(Base):
    __tablename__ = "ai_runs"

    id = Column(BigInteger, primary_key=True, autoincrement=True)
    organization_id = Column(BigInteger, ForeignKey("organizations.id", ondelete="CASCADE"), nullable=False, index=True)
    store_id = Column(BigInteger, ForeignKey("stores.id", ondelete="CASCADE"), index=True)
    user_id = Column(BigInteger, ForeignKey("users.id", ondelete="SET NULL"), index=True)
    conversation_id = Column(BigInteger, ForeignKey("conversations.id", ondelete="CASCADE"), index=True)
    customer_query = Column(Text, nullable=False)
    cleaned_query = Column(Text)
    intent = Column(String(255))
    intent_confidence = Column(Float)
    identified_customer_id = Column(BigInteger, ForeignKey("customers.id", ondelete="SET NULL"), index=True)
    identified_customer_email = Column(String(255))
    identified_order_id = Column(BigInteger, ForeignKey("orders.id", ondelete="SET NULL"), index=True)
    shopify_context_json = Column(JSON)
    knowledge_chunks_json = Column(JSON)
    prompt_tokens = Column(Integer, default=0)
    completion_tokens = Column(Integer, default=0)
    total_tokens = Column(Integer, default=0)
    llm_model = Column(String(255))
    raw_llm_response = Column(Text)
    final_response = Column(Text)
    status = Column(Enum(RunStatus), default=RunStatus.pending)
    safety_passed = Column(Boolean, default=True)
    safety_reason = Column(String(500))
    escalated = Column(Boolean, default=False)
    escalation_reason = Column(String(500))
    is_test = Column(Boolean, default=False)
    error_message = Column(Text)
    started_at = Column(DateTime(timezone=True), server_default=func.now())
    completed_at = Column(DateTime(timezone=True))

    user = relationship("User", back_populates="ai_runs")
    conversation = relationship("Conversation", back_populates="ai_runs")
    tool_calls = relationship("ToolCall", back_populates="ai_run", cascade="all, delete-orphan")
    messages = relationship("Message", back_populates="ai_run")


class ToolStatus(enum.Enum):
    pending = "pending"
    approved = "approved"
    executing = "executing"
    completed = "completed"
    denied = "denied"
    failed = "failed"


class ToolCall(Base):
    __tablename__ = "tool_calls"

    id = Column(BigInteger, primary_key=True, autoincrement=True)
    organization_id = Column(BigInteger, ForeignKey("organizations.id", ondelete="CASCADE"), nullable=False, index=True)
    ai_run_id = Column(BigInteger, ForeignKey("ai_runs.id", ondelete="CASCADE"), nullable=False, index=True)
    tool_name = Column(String(128), nullable=False)
    arguments_json = Column(JSON)
    validated = Column(Boolean, default=False)
    validation_error = Column(String(500))
    status = Column(Enum(ToolStatus), default=ToolStatus.pending)
    result_json = Column(JSON)
    error_message = Column(Text)
    executed_at = Column(DateTime(timezone=True))
    completed_at = Column(DateTime(timezone=True))

    ai_run = relationship("AIRun", back_populates="tool_calls")


class AuditAction(enum.Enum):
    login = "login"
    logout = "logout"
    shopify_connect = "shopify_connect"
    shopify_disconnect = "shopify_disconnect"
    store_sync = "store_sync"
    document_create = "document_create"
    document_delete = "document_delete"
    ai_run = "ai_run"
    tool_execute = "tool_execute"
    escalate = "escalate"
    settings_change = "settings_change"


class AuditLog(Base, TenantMixin):
    __tablename__ = "audit_logs"

    id = Column(BigInteger, primary_key=True, autoincrement=True)
    user_id = Column(BigInteger, ForeignKey("users.id", ondelete="SET NULL"), index=True)
    store_id = Column(BigInteger, ForeignKey("stores.id", ondelete="SET NULL"), index=True)
    action = Column(Enum(AuditAction), nullable=False)
    target_type = Column(String(64))
    target_id = Column(BigInteger)
    metadata_json = Column(JSON)
    ip_address = Column(String(64))
    user_agent = Column(String(500))
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    organization = relationship("Organization", back_populates="audit_logs")
