import hashlib
import hmac
import base64
import re
import urllib.parse
from typing import Optional, Tuple
from sqlalchemy.orm import Session
from datetime import datetime

from ..models import Store, AuditLog, AuditAction
from ..security import encrypt_value, decrypt_value
from ..config import settings


def _hmac_sign(query_string: str) -> str:
    digest = hmac.new(
        settings.SHOPIFY_API_SECRET.encode("utf-8"),
        msg=query_string.encode("utf-8"),
        digestmod=hashlib.sha256,
    ).digest()
    return base64.b64encode(digest).decode("utf-8")


def verify_webhook(data_bytes: bytes, hmac_header: str) -> bool:
    if not settings.SHOPIFY_API_SECRET or not hmac_header:
        return False
    digest = hmac.new(
        settings.SHOPIFY_API_SECRET.encode("utf-8"),
        msg=data_bytes,
        digestmod=hashlib.sha256,
    ).digest()
    computed = base64.b64encode(digest).decode("utf-8")
    return hmac.compare_digest(computed, hmac_header)


def verify_oauth_hmac(params: dict) -> bool:
    hmac_val = params.get("hmac")
    if not hmac_val or not settings.SHOPIFY_API_SECRET:
        return False
    keys = sorted([k for k in params.keys() if k != "hmac" and k != "signature"])
    qs = "&".join(f"{k}={urllib.parse.quote(str(params[k]), safe='')}" for k in keys)
    digest = hmac.new(
        settings.SHOPIFY_API_SECRET.encode("utf-8"),
        msg=qs.encode("utf-8"),
        digestmod=hashlib.sha256,
    ).hexdigest()
    return hmac.compare_digest(digest, hmac_val)


def normalize_domain(shop: str) -> str:
    shop = (shop or "").strip().lower()
    if not shop:
        raise ValueError("Shop domain is required")
    # strip protocol and trailing slashes the user may have pasted
    shop = re.sub(r"^https?://", "", shop).strip("/")
    if ".myshopify.com" not in shop:
        shop = f"{shop}.myshopify.com"
    return shop


def build_install_url(shop_domain: str, state: str) -> str:
    domain = normalize_domain(shop_domain)
    params = {
        "client_id": settings.SHOPIFY_API_KEY,
        "scope": settings.SHOPIFY_SCOPES,
        "redirect_uri": settings.SHOPIFY_REDIRECT_URI,
        "state": state,
    }
    qs = urllib.parse.urlencode(params)
    return f"https://{domain}/admin/oauth/authorize?{qs}"


def get_or_create_store(
    db: Session,
    organization_id: int,
    shop_domain: str,
) -> Store:
    domain = normalize_domain(shop_domain)
    store = db.query(Store).filter(
        (Store.organization_id == organization_id) & (Store.shopify_domain == domain)
    ).first()
    if store:
        return store
    store = Store(
        organization_id=organization_id,
        shopify_domain=domain,
        name=domain.replace(".myshopify.com", ""),
        is_connected=False,
    )
    db.add(store)
    db.commit()
    db.refresh(store)
    return store


def save_access_token(
    db: Session,
    store: Store,
    access_token: str,
    scope: str,
    shopify_store_id: Optional[int] = None,
    name: Optional[str] = None,
) -> Store:
    store.access_token_enc = encrypt_value(access_token)
    store.scope = scope
    store.is_connected = True
    if shopify_store_id:
        store.shopify_store_id = shopify_store_id
    if name:
        store.name = name
    db.add(store)
    db.commit()
    db.refresh(store)
    return store


def disconnect_store(db: Session, store: Store) -> Store:
    store.access_token_enc = None
    store.scope = None
    store.is_connected = False
    store.webhook_id_customers = None
    store.webhook_id_products = None
    store.webhook_id_orders = None
    db.add(store)
    db.commit()
    db.refresh(store)
    return store


def get_access_token(store: Store) -> str:
    return decrypt_value(store.access_token_enc or "")
