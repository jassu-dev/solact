from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from sqlalchemy import text
from ..database import get_db, engine
from ..config import settings
from ..schemas.auth import HealthResponse
import redis as redis_lib

router = APIRouter(tags=["health"])


@router.get("/health", response_model=HealthResponse)
def health(db: Session = Depends(get_db)):
    pg_status = "unknown"
    try:
        db.execute(text("SELECT 1"))
        pg_status = "ok"
    except Exception as e:
        pg_status = f"error: {e}"
    redis_status = "unknown"
    try:
        r = redis_lib.Redis.from_url(settings.REDIS_URL)
        r.ping()
        redis_status = "ok"
    except Exception as e:
        redis_status = f"error: {e}"
    return HealthResponse(status="ok", postgres=pg_status, redis=redis_status)
