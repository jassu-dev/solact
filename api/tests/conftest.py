import os
import sys
import json
from pathlib import Path
from datetime import datetime, timedelta

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT))
os.environ.setdefault("DATABASE_URL", "postgresql+psycopg2://solact_founder:Solact123@localhost:5432/shopify_ai_test")
os.environ.setdefault("REDIS_URL", "redis://localhost:6379/1")
os.environ.setdefault("JWT_SECRET", "test-secret-please-change-1234567890abcdef")
os.environ.setdefault("ENCRYPTION_KEY", "test-encryption-key-123456789012345")
os.environ.setdefault("SHOPIFY_API_KEY", "test_key")
os.environ.setdefault("SHOPIFY_API_SECRET", "test_secret")
os.environ.setdefault("LLM_API_KEY", "")
os.environ.setdefault("LLM_MODEL", "mock")
