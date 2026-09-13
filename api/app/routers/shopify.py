from fastapi import APIRouter, Depends, HTTPException, status, Request, Query, BackgroundTasks
from fastapi.responses import RedirectResponse, JSONResponse
from sqlalchemy.orm import Session
from typing import Optional, List
import secrets
import httpx
import json

from ..database import get_db
from ..config import settings
from ..models import User, Store, AuditLog, AuditAction
from ..dependencies.auth import get_current_user, get_client_ip
from ..schemas.store import StoreResponse, StoreListResponse, ShopifyInstallUrl, SyncRequest, SyncStatusResponse
from ..services import (
    build_install_url, verify_oauth_hmac, normalize_domain,
    get_or_create_store, save_access_token, disconnect_store,
    ShopifyClient, run_sync,
)

router = APIRouter(prefix="/shopify", tags=["shopify"])
webhooks_router = APIRouter(prefix="/webhooks", tags=["webhooks"])

_STATES: dict = {}


def _audit(db: Session, user: User, action: AuditAction, store_id: Optional[int] = None, meta: Optional[dict] = None):
    try:
        db.add(AuditLog(
            organization_id=user.organization_id,
            user_id=user.id,
            store_id=store_id,
            action=action,
            metadata_json=meta,
        ))
        db.commit()
    except Exception:
        db.rollback()


@router.get("/install-url", response_model=ShopifyInstallUrl)
def get_install_url(
    shop: str = Query(..., description="Shopify store domain, e.g. mystore.myshopify.com"),
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    try:
        domain = normalize_domain(shop)
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))
    state = secrets.token_urlsafe(24)
    _STATES[state] = {"org_id": user.organization_id, "user_id": user.id, "ts": __import__("time").time()}
    return ShopifyInstallUrl(install_url=build_install_url(domain, state))


@router.get("/callback", include_in_schema=False)
def oauth_callback(
    request: Request,
    code: str = Query(...),
    hmac: str = Query(...),
    shop: str = Query(...),
    state: Optional[str] = Query(None),
    timestamp: Optional[str] = Query(None),
    db: Session = Depends(get_db),
):
    params = dict(request.query_params)
    if not verify_oauth_hmac(params):
        raise HTTPException(status_code=400, detail="Invalid HMAC signature")
    if state and state not in _STATES:
        raise HTTPException(status_code=400, detail="Invalid or expired state")
    state_data = _STATES.pop(state, None) or {}
    try:
        domain = normalize_domain(shop)
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))
    token_url = f"https://{domain}/admin/oauth/access_token"
    try:
        r = httpx.post(token_url, data={
            "client_id": settings.SHOPIFY_API_KEY,
            "client_secret": settings.SHOPIFY_API_SECRET,
            "code": code,
        }, timeout=30)
        r.raise_for_status()
        token_data = r.json()
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to exchange token: {e}")
    access_token = token_data.get("access_token")
    scope = token_data.get("scope", "")
    if not access_token:
        raise HTTPException(status_code=500, detail="No access_token received")
    org_id = state_data.get("org_id")
    if not org_id:
        raise HTTPException(status_code=400, detail="Missing org from state; login via dashboard first")
    user = db.get(User, state_data.get("user_id"))
    store = get_or_create_store(db, org_id, domain)
    client = ShopifyClient(Store(shopify_domain=domain, access_token_enc=__import__("base64").b64encode(b"").decode()))
    from ..services.shopify_auth import encrypt_value
    real_client = ShopifyClient.__new__(ShopifyClient)
    real_client.store = store
    real_client.domain = domain
    real_client.token = access_token
    real_client.version = settings.SHOPIFY_WEBHOOK_VERSION
    real_client.base_url = f"https://{domain}/admin/api/{real_client.version}"
    real_client.timeout = 30
    shop_info = {}
    shopify_store_id = None
    store_name = None
    try:
        shop_info = real_client.get_shop()
        shopify_store_id = shop_info.get("id")
        store_name = shop_info.get("name")
    except Exception:
        pass
    store = save_access_token(db, store, access_token, scope, shopify_store_id, store_name)
    if user:
        _audit(db, user, AuditAction.shopify_connect, store.id, {
            "domain": domain,
            "shopify_store_id": shopify_store_id,
        })
    webhook_base = settings.SHOPIFY_REDIRECT_URI.rsplit("/", 2)[0] + "/webhooks/shopify"
    webhook_topics = [
        ("customers/create", "webhook_id_customers"),
        ("customers/update", "webhook_id_customers"),
        ("products/create", "webhook_id_products"),
        ("products/update", "webhook_id_products"),
        ("orders/create", "webhook_id_orders"),
        ("orders/updated", "webhook_id_orders"),
    ]
    for topic, attr in webhook_topics:
        try:
            wh = real_client.create_webhook(topic, f"{webhook_base}?store_id={store.id}")
            if wh and wh.get("id"):
                setattr(store, attr, int(wh["id"]))
        except Exception:
            pass
    db.add(store)
    db.commit()
    dashboard_redirect = f"https://app.solact.in/onboarding?store_id={store.id}&connected=1"
    return RedirectResponse(url=dashboard_redirect)


@router.get("/stores", response_model=StoreListResponse)
def list_stores(db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    from sqlalchemy import select
    stores = db.execute(
        select(Store).where(Store.organization_id == user.organization_id)
    ).scalars().all()
    return StoreListResponse(stores=stores, total=len(stores))


@router.get("/stores/{store_id}", response_model=StoreResponse)
def get_store(store_id: int, db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    from sqlalchemy import select
    store = db.execute(
        select(Store).where(
            Store.id == store_id,
            Store.organization_id == user.organization_id,
        )
    ).scalar_one_or_none()
    if not store:
        raise HTTPException(status_code=404, detail="Store not found")
    return store


@router.post("/stores/{store_id}/disconnect", response_model=StoreResponse)
def disconnect(store_id: int, bt: BackgroundTasks, db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    from sqlalchemy import select
    store = db.execute(
        select(Store).where(
            Store.id == store_id,
            Store.organization_id == user.organization_id,
        )
    ).scalar_one_or_none()
    if not store:
        raise HTTPException(status_code=404, detail="Store not found")
    for attr in ["webhook_id_customers", "webhook_id_products", "webhook_id_orders"]:
        wid = getattr(store, attr)
        if wid:
            try:
                client = ShopifyClient(store)
                client.delete_webhook(int(wid))
            except Exception:
                pass
    store = disconnect_store(db, store)
    _audit(db, user, AuditAction.shopify_disconnect, store.id)
    return store


@router.post("/stores/{store_id}/sync", response_model=SyncStatusResponse)
def trigger_sync(store_id: int, payload: SyncRequest, bt: BackgroundTasks, db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    from sqlalchemy import select
    store = db.execute(
        select(Store).where(
            Store.id == store_id,
            Store.organization_id == user.organization_id,
        )
    ).scalar_one_or_none()
    if not store:
        raise HTTPException(status_code=404, detail="Store not found")
    if not store.is_connected:
        raise HTTPException(status_code=400, detail="Store not connected")
    if store.sync_status == "running":
        raise HTTPException(status_code=409, detail="Sync already in progress")
    store.sync_status = "queued"
    store.sync_message = "Sync queued"
    db.add(store); db.commit(); db.refresh(store)
    _audit(db, user, AuditAction.store_sync, store.id, {
        "force": payload.force, "entities": payload.entities,
    })
    bt.add_task(run_sync, store.id, payload.force, payload.entities)
    return _sync_status(db, store)


@router.get("/stores/{store_id}/sync-status", response_model=SyncStatusResponse)
def sync_status(store_id: int, db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    from sqlalchemy import select, func
    from ..models import Customer, Product, Order
    store = db.execute(
        select(Store).where(
            Store.id == store_id,
            Store.organization_id == user.organization_id,
        )
    ).scalar_one_or_none()
    if not store:
        raise HTTPException(status_code=404, detail="Store not found")
    return _sync_status(db, store)


def _sync_status(db: Session, store: Store) -> SyncStatusResponse:
    from ..models import Customer, Product, Order
    from sqlalchemy import func, select
    cc = db.execute(select(func.count(Customer.id)).where(Customer.store_id == store.id)).scalar() or 0
    pc = db.execute(select(func.count(Product.id)).where(Product.store_id == store.id)).scalar() or 0
    oc = db.execute(select(func.count(Order.id)).where(Order.store_id == store.id)).scalar() or 0
    return SyncStatusResponse(
        sync_status=store.sync_status,
        sync_message=store.sync_message,
        last_sync_at=store.last_sync_at,
        customers_count=cc,
        products_count=pc,
        orders_count=oc,
    )


@webhooks_router.post("/shopify", include_in_schema=False)
@router.post("/webhooks/shopify", include_in_schema=False)
async def shopify_webhook(
    request: Request,
    store_id: Optional[int] = Query(None),
    db: Session = Depends(get_db),
):
    from ..services import verify_webhook
    from ..services.sync_service import upsert_customer, upsert_product, upsert_order
    body_bytes = await request.body()
    hmac_header = request.headers.get("X-Shopify-Hmac-Sha256", "")
    topic = request.headers.get("X-Shopify-Topic", "")
    shop_domain = request.headers.get("X-Shopify-Shop-Domain", "")
    webhook_id = request.headers.get("X-Shopify-Webhook-Id", "")
    if not verify_webhook(body_bytes, hmac_header):
        raise HTTPException(status_code=401, detail="Invalid webhook signature")
    try:
        domain = normalize_domain(shop_domain) if shop_domain else None
    except Exception:
        domain = None
    from sqlalchemy import select
    store = None
    if store_id:
        store = db.get(Store, store_id)
    if not store and domain:
        store = db.execute(select(Store).where(Store.shopify_domain == domain)).scalar_one_or_none()
    if not store:
        return JSONResponse({"status": "ok", "note": "no store matched"}, status_code=200)
    from .. import redis_client as rc
    dedup_key = f"wh:shopify:{webhook_id or request.headers.get('X-Shopify-Event-Id') or abs(hash(f'{topic}:{hmac_header}'))}"
    try:
        import redis as r
        rd = r.Redis.from_url(settings.REDIS_URL)
        if rd.setnx(dedup_key, "1"):
            rd.expire(dedup_key, 60 * 60 * 24)
        else:
            return JSONResponse({"status": "duplicate"}, status_code=200)
    except Exception:
        pass
    try:
        payload = json.loads(body_bytes or "{}")
    except Exception:
        return JSONResponse({"status": "bad_json"}, status_code=400)
    try:
        if topic in ("customers/create", "customers/update") and payload:
            upsert_customer(db, store.id, payload); db.commit()
        elif topic in ("products/create", "products/update") and payload:
            upsert_product(db, store.id, payload); db.commit()
        elif topic in ("orders/create", "orders/updated") and payload:
            upsert_order(db, store.id, payload); db.commit()
    except Exception as e:
        db.rollback()
        return JSONResponse({"status": "error", "error": str(e)}, status_code=500)
    return JSONResponse({"status": "ok", "topic": topic})
