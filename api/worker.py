import os
import logging
from celery import Celery
from celery.signals import worker_ready

from app.config import settings
from app.services.sync_service import run_sync
from app.services.knowledge_service import process_document

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s %(levelname)s %(name)s: %(message)s",
)

celery_app = Celery(
    "solact_worker",
    broker=settings.REDIS_URL,
    backend=settings.REDIS_URL,
)
celery_app.conf.update(
    task_serializer="json",
    accept_content=["json"],
    result_serializer="json",
    timezone="UTC",
    enable_utc=True,
    task_acks_late=True,
    worker_prefetch_multiplier=1,
    task_track_started=True,
    task_time_limit=60 * 60,
    task_soft_time_limit=55 * 60,
)


@celery_app.task(name="sync.store", bind=True, max_retries=2, default_retry_delay=60)
def task_sync_store(self, store_id: int, force: bool = False, entities=None):
    try:
        run_sync(store_id, force=force, entities=entities or ["customers", "products", "orders"])
    except Exception as e:
        logging.exception(f"Sync failed for store {store_id}")
        self.retry(exc=e)


@celery_app.task(name="knowledge.process_document")
def task_process_document(doc_id: int):
    from app.database import get_db_session
    db = get_db_session()
    try:
        process_document(db, doc_id)
    except Exception:
        logging.exception(f"Doc process failed id={doc_id}")
    finally:
        db.close()


@worker_ready.connect
def on_ready(**kwargs):
    logging.info("Solact worker ready")


if __name__ == "__main__":
    celery_app.start(argv=["worker", "-l", "info", "-c", 2, "-Q", "celery"])
