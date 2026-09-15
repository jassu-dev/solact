import json
import logging
from typing import Optional, Dict, Any
from pydantic import BaseModel
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
import redis

from ..database import get_db
from ..models import User, Store
from ..dependencies.auth import get_current_user
from ..config import settings

logger = logging.getLogger("solact.store_settings")
router = APIRouter(prefix="/stores", tags=["stores"])


def _get_redis():
    try:
        return redis.Redis.from_url(settings.REDIS_URL, decode_responses=True)
    except Exception:
        return None


class StoreAIConfig(BaseModel):
    bot_name: Optional[str] = "Solact AI"
    bot_tone: Optional[str] = "friendly"  # "friendly" | "concise" | "luxury"
    custom_instructions: Optional[str] = ""
    auto_escalate_refunds: bool = True
    auto_escalate_sentiment: bool = True
    business_hours: Optional[str] = "24/7 AI Coverage"
    welcome_message: Optional[str] = "Hi! How can I help you today?"
    support_hours_enabled: bool = True
    support_hours_start: Optional[str] = "09:00"
    support_hours_end: Optional[str] = "18:00"
    support_timezone: Optional[str] = "UTC"
    support_days: Optional[list] = [1, 2, 3, 4, 5]
    offline_escalation_message: Optional[str] = "Our human support team is currently offline. Operating hours: Mon–Fri 9am–6pm. We have logged your ticket and our team will follow up as soon as we reopen!"


def get_store_settings_dict(store_id: int) -> Dict[str, Any]:
    defaults = {
        "bot_name": "Solact AI",
        "bot_tone": "friendly",
        "custom_instructions": "",
        "auto_escalate_refunds": True,
        "auto_escalate_sentiment": True,
        "business_hours": "24/7 AI Coverage",
        "welcome_message": "Hi! How can I help you today?",
        "support_hours_enabled": True,
        "support_hours_start": "09:00",
        "support_hours_end": "18:00",
        "support_timezone": "UTC",
        "support_days": [1, 2, 3, 4, 5],
        "offline_escalation_message": "Our human support team is currently offline. Operating hours: Mon–Fri 9am–6pm. We have logged your ticket and our team will follow up as soon as we reopen!",
    }
    r = _get_redis()
    if not r:
        return defaults
    try:
        val = r.get(f"solact:store_settings:{store_id}")
        if val:
            parsed = json.loads(val)
            defaults.update(parsed)
    except Exception as e:
        logger.debug(f"Failed to read store settings from Redis: {e}")
    return defaults


@router.get("/{store_id}/settings")
def get_store_ai_settings(
    store_id: int,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    store = db.query(Store).filter(Store.id == store_id).first()
    if not store:
        raise HTTPException(status_code=404, detail="Store not found")
    # Verify ownership unless platform admin
    if user.role != "admin" and user.email != "admin@solact.in" and store.organization_id != user.organization_id:
        raise HTTPException(status_code=403, detail="Not authorized for this store")

    cfg = get_store_settings_dict(store_id)
    return {
        "store_id": store_id,
        "store_name": store.name or store.shopify_domain,
        "shopify_domain": store.shopify_domain,
        "is_connected": store.is_connected,
        "config": cfg,
        "managed_infrastructure": {
            "engine": "Solact Gemini Cloud Router",
            "tier": "Dual-Tier Gemini 2.5 Flash / Pro (Enterprise Managed)",
            "status": "active",
        }
    }


@router.put("/{store_id}/settings")
def update_store_ai_settings(
    store_id: int,
    payload: StoreAIConfig,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    store = db.query(Store).filter(Store.id == store_id).first()
    if not store:
        raise HTTPException(status_code=404, detail="Store not found")
    if user.role != "admin" and user.email != "admin@solact.in" and store.organization_id != user.organization_id:
        raise HTTPException(status_code=403, detail="Not authorized for this store")

    data = payload.model_dump()
    r = _get_redis()
    if r:
        try:
            r.set(f"solact:store_settings:{store_id}", json.dumps(data))
        except Exception as e:
            logger.error(f"Failed to persist store settings in Redis: {e}")

    return {
        "status": "saved",
        "store_id": store_id,
        "config": data,
    }
