from .auth_service import register_user, login_user
from .shopify_auth import (
    build_install_url, verify_oauth_hmac, verify_webhook, normalize_domain,
    get_or_create_store, save_access_token, disconnect_store, get_access_token,
)
from .shopify_client import ShopifyClient
from .sync_service import (
    run_sync, sync_store_async,
    upsert_customer, upsert_product, upsert_order,
)
from .embeddings import (
    embed_texts, embed_single,
    clean_text, chunk_text, estimate_tokens, fetch_website_text,
)
from .knowledge_service import (
    create_document, process_document, delete_document,
)
from .tools import (
    validate_and_execute, tools_json_schema, TOOL_DEFINITIONS,
    get_customer_tool, get_order_tool, get_orders_tool, get_product_tool,
    get_tracking_tool, check_return_eligibility_tool,
)
from .ai_agent import run_ai_employee, LLMClient, _cosine_search, _safety_check
from .chatwoot_service import (
    ChatwootClient, handle_incoming_message, get_or_create_conversation,
    add_customer_message, add_ai_message, escalate_conversation,
)

__all__ = [
    "register_user", "login_user",
    "build_install_url", "verify_oauth_hmac", "verify_webhook",
    "normalize_domain", "get_or_create_store", "save_access_token",
    "disconnect_store", "get_access_token",
    "ShopifyClient",
    "run_sync", "sync_store_async", "upsert_customer", "upsert_product", "upsert_order",
    "embed_texts", "embed_single",
    "clean_text", "chunk_text", "estimate_tokens", "fetch_website_text",
    "create_document", "process_document", "delete_document",
    "validate_and_execute", "tools_json_schema", "TOOL_DEFINITIONS",
    "get_customer_tool", "get_order_tool", "get_orders_tool", "get_product_tool",
    "get_tracking_tool", "check_return_eligibility_tool",
    "run_ai_employee", "LLMClient", "_cosine_search", "_safety_check",
    "ChatwootClient", "handle_incoming_message", "get_or_create_conversation",
    "add_customer_message", "add_ai_message", "escalate_conversation",
]
