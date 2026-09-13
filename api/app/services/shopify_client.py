import httpx
from typing import Optional, List, Dict, Any, AsyncGenerator
from datetime import datetime

from ..config import settings
from ..models import Store
from .shopify_auth import get_access_token


class ShopifyClient:
    def __init__(self, store: Store, timeout: int = 30):
        self.store = store
        self.domain = store.shopify_domain
        self.token = get_access_token(store)
        self.version = settings.SHOPIFY_WEBHOOK_VERSION
        self.base_url = f"https://{self.domain}/admin/api/{self.version}"
        self.timeout = timeout

    def _headers(self) -> dict:
        return {
            "X-Shopify-Access-Token": self.token,
            "Accept": "application/json",
            "Content-Type": "application/json",
        }

    def _get(self, path: str, params: Optional[dict] = None) -> dict:
        url = f"{self.base_url}{path}"
        r = httpx.get(url, headers=self._headers(), params=params, timeout=self.timeout)
        r.raise_for_status()
        return r.json()

    def _post(self, path: str, json: dict) -> dict:
        url = f"{self.base_url}{path}"
        r = httpx.post(url, headers=self._headers(), json=json, timeout=self.timeout)
        r.raise_for_status()
        return r.json()

    def _delete(self, path: str) -> dict:
        url = f"{self.base_url}{path}"
        r = httpx.delete(url, headers=self._headers(), timeout=self.timeout)
        r.raise_for_status()
        return r.json() if r.content else {}

    def get_shop(self) -> dict:
        return self._get("/shop.json").get("shop", {})

    async def paginate(
        self,
        path: str,
        list_key: str,
        params: Optional[dict] = None,
        page_limit: int = 250,
    ) -> AsyncGenerator[List[dict], None]:
        url = f"{self.base_url}{path}"
        p = dict(params or {})
        p["limit"] = page_limit
        async with httpx.AsyncClient(timeout=self.timeout) as client:
            while url:
                r = await client.get(url, headers=self._headers(), params=p if url == f"{self.base_url}{path}" else None)
                r.raise_for_status()
                data = r.json()
                items = data.get(list_key, [])
                if items:
                    yield items
                link = r.headers.get("Link", "")
                next_url = None
                for part in link.split(","):
                    if 'rel="next"' in part:
                        start = part.find("<") + 1
                        end = part.find(">")
                        if start > 0 and end > start:
                            next_url = part[start:end]
                url = next_url
                p = None

    def list_customers(self, params: Optional[dict] = None) -> AsyncGenerator[List[dict], None]:
        return self.paginate("/customers.json", "customers", params)

    def list_products(self, params: Optional[dict] = None) -> AsyncGenerator[List[dict], None]:
        return self.paginate("/products.json", "products", params)

    def list_orders(self, params: Optional[dict] = None) -> AsyncGenerator[List[dict], None]:
        p = dict(params or {})
        p.setdefault("status", "any")
        return self.paginate("/orders.json", "orders", p)

    def get_order(self, order_id: int) -> Optional[dict]:
        try:
            return self._get(f"/orders/{order_id}.json").get("order")
        except httpx.HTTPStatusError as e:
            if e.response.status_code == 404:
                return None
            raise

    def get_order_by_name(self, name: str) -> Optional[dict]:
        try:
            r = self._get("/orders.json", params={"name": name, "status": "any"})
            orders = r.get("orders", [])
            return orders[0] if orders else None
        except Exception:
            return None

    def get_customer(self, customer_id: int) -> Optional[dict]:
        try:
            return self._get(f"/customers/{customer_id}.json").get("customer")
        except httpx.HTTPStatusError as e:
            if e.response.status_code == 404:
                return None
            raise

    def get_customer_by_email(self, email: str) -> Optional[dict]:
        try:
            r = self._get("/customers/search.json", params={"query": f"email:{email}"})
            custs = r.get("customers", [])
            return custs[0] if custs else None
        except Exception:
            return None

    def get_product(self, product_id: int) -> Optional[dict]:
        try:
            return self._get(f"/products/{product_id}.json").get("product")
        except httpx.HTTPStatusError as e:
            if e.response.status_code == 404:
                return None
            raise

    def list_fulfillments(self, order_id: int) -> List[dict]:
        try:
            data = self._get(f"/orders/{order_id}/fulfillments.json")
            return data.get("fulfillments", [])
        except Exception:
            return []

    def list_fulfillment_orders(self, order_id: int) -> List[dict]:
        try:
            data = self._get(f"/orders/{order_id}/fulfillment_orders.json")
            return data.get("fulfillment_orders", [])
        except Exception:
            return []

    def create_webhook(self, topic: str, address: str) -> Optional[dict]:
        payload = {
            "webhook": {
                "topic": topic,
                "address": address,
                "format": "json",
                "api_version": self.version,
            }
        }
        try:
            return self._post("/webhooks.json", payload).get("webhook")
        except Exception:
            return None

    def delete_webhook(self, webhook_id: int) -> bool:
        try:
            self._delete(f"/webhooks/{webhook_id}.json")
            return True
        except Exception:
            return False

    def list_webhooks(self) -> List[dict]:
        try:
            return self._get("/webhooks.json").get("webhooks", [])
        except Exception:
            return []
