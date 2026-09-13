import re
import logging
from sqlalchemy import create_engine, text
from sqlalchemy.orm import declarative_base, sessionmaker, Session
from .config import settings

logger = logging.getLogger("solact.db")


def _ensure_solact_db():
    target = settings.DATABASE_URL
    if "/solact" in target:
        for fallback_db in ["postgres", "shopify_ai", "template1"]:
            admin_url = re.sub(r"/solact(\?.*)?$", f"/{fallback_db}\\1", target)
            try:
                admin_engine = create_engine(admin_url, isolation_level="AUTOCOMMIT")
                with admin_engine.connect() as conn:
                    exists = conn.execute(text("SELECT 1 FROM pg_database WHERE datname='solact'")).scalar()
                    if not exists:
                        conn.execute(text("CREATE DATABASE solact"))
                        logger.info("Auto-created 'solact' database successfully.")
                admin_engine.dispose()
                break
            except Exception as e:
                logger.debug(f"Could not connect to {fallback_db}: {e}")
                continue


_ensure_solact_db()

engine = create_engine(
    settings.DATABASE_URL,
    pool_pre_ping=True,
    pool_size=10,
    max_overflow=20,
    echo=False,
)

SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

Base = declarative_base()


def get_db():
    db: Session = SessionLocal()
    try:
        yield db
    finally:
        db.close()


def get_db_session() -> Session:
    return SessionLocal()
