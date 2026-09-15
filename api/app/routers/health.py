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

@router.get("/db-init")
def db_init(db: Session = Depends(get_db)):
    from ..database import Base, engine, SessionLocal
    from ..models import User, Organization
    from ..security import get_password_hash
    from sqlalchemy import text
    try:
        with engine.connect() as conn:
            conn.execute(text("CREATE EXTENSION IF NOT EXISTS vector"))
            conn.commit()
        Base.metadata.create_all(bind=engine)
        user = db.query(User).filter(User.email == "admin@solact.in").first()
        if not user:
            org = Organization(name="Solact Primary Store", slug="solact-primary")
            db.add(org)
            db.flush()
            user = User(
                organization_id=org.id,
                email="admin@solact.in",
                name="Solact Founder",
                password_hash=get_password_hash("Password123!"),
                role="admin",
                is_active=True,
                is_verified=True,
            )
            db.add(user)
            db.commit()
            return {"status": "ok", "message": "Tables created and admin user seeded with role='admin'!"}
        else:
            if user.role != "admin":
                user.role = "admin"
                db.commit()
        return {"status": "ok", "message": "Tables exist and admin user is verified with role='admin'!"}
    except Exception as e:
        import traceback
        return {"status": "error", "error": str(e), "trace": traceback.format_exc()}
