from pydantic import field_validator
from pydantic_settings import BaseSettings, SettingsConfigDict
from typing import Optional


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

    DATABASE_URL: str = "postgresql+psycopg2://solact_founder:Solact123@postgres:5432/solact"
    REDIS_URL: str = "redis://localhost:6379/0"
    JWT_SECRET: str = "dev-secret-change-me-please-1234567890"

    @field_validator("DATABASE_URL", mode="after")
    @classmethod
    def sanitize_database_url(cls, v: str) -> str:
        if v and "/shopify_ai" in v:
            v = v.replace("/shopify_ai", "/solact")
        return v

    @property
    def clean_database_url(self) -> str:
        url = self.DATABASE_URL
        if "/shopify_ai" in url:
            url = url.replace("/shopify_ai", "/solact")
        return url
    JWT_ALGORITHM: str = "HS256"
    JWT_EXPIRE_MINUTES: int = 1440

    SHOPIFY_API_KEY: str = ""
    SHOPIFY_API_SECRET: str = ""
    SHOPIFY_REDIRECT_URI: str = "https://api.solact.in/api/v1/shopify/callback"
    SHOPIFY_SCOPES: str = "read_customers,read_products,read_orders,read_assigned_fulfillment_orders,read_merchant_managed_fulfillment_orders"
    SHOPIFY_WEBHOOK_VERSION: str = "2024-10"

    # Gemini LLM & Router Configuration (Centrally managed by Solact Platform)
    LLM_ROUTER_ENABLED: bool = True
    ROUTER_STRATEGY: str = "auto_optimize"  # auto_optimize | cost_saver | max_intelligence
    LLM_API_BASE: str = "https://generativelanguage.googleapis.com/v1beta/openai"
    LLM_API_KEY: str = ""
    GEMINI_API_KEY: str = ""
    LLM_MODEL: str = "gemini-2.5-flash"
    LLM_FAST_MODEL: str = "gemini-2.5-flash"
    LLM_REASONING_MODEL: str = "gemini-2.5-pro"
    LLM_FALLBACK_MODEL: str = "gemini-2.0-flash"
    LLM_TEMPERATURE: float = 0.2
    LLM_MAX_TOKENS: int = 2048

    CHATWOOT_URL: str = "https://chat.solact.in"
    CHATWOOT_API_TOKEN: str = ""
    CHATWOOT_ACCOUNT_ID: str = "1"

    ENCRYPTION_KEY: str = "01234567890123456789012345678901"
    EMBEDDING_MODEL: str = "BAAI/bge-small-en-v1.5"
    EMBEDDING_DIM: int = 384

    API_V1_PREFIX: str = "/api/v1"
    CORS_ORIGINS: list = ["http://localhost:3001", "http://localhost:3000", "https://solact.in", "https://www.solact.in", "https://app.solact.in", "https://api.solact.in", "https://chat.solact.in"]


settings = Settings()
