from pydantic_settings import BaseSettings, SettingsConfigDict
from typing import Optional


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

    DATABASE_URL: str = "postgresql+psycopg2://solact_founder:Solact123@localhost:5432/shopify_ai"
    REDIS_URL: str = "redis://localhost:6379/0"
    JWT_SECRET: str = "dev-secret-change-me-please-1234567890"
    JWT_ALGORITHM: str = "HS256"
    JWT_EXPIRE_MINUTES: int = 1440

    SHOPIFY_API_KEY: str = ""
    SHOPIFY_API_SECRET: str = ""
    SHOPIFY_REDIRECT_URI: str = "http://localhost:8000/api/v1/shopify/callback"
    SHOPIFY_SCOPES: str = "read_customers,read_products,read_orders,read_assigned_fulfillment_orders,read_merchant_managed_fulfillment_orders"
    SHOPIFY_WEBHOOK_VERSION: str = "2024-10"

    LLM_API_BASE: str = "https://api.openai.com/v1"
    LLM_API_KEY: str = ""
    LLM_MODEL: str = "gpt-4o-mini"
    LLM_TEMPERATURE: float = 0.2
    LLM_MAX_TOKENS: int = 2048

    CHATWOOT_URL: str = "http://localhost:3000"
    CHATWOOT_API_TOKEN: str = ""
    CHATWOOT_ACCOUNT_ID: str = "1"

    ENCRYPTION_KEY: str = "01234567890123456789012345678901"
    EMBEDDING_MODEL: str = "BAAI/bge-small-en-v1.5"
    EMBEDDING_DIM: int = 384

    API_V1_PREFIX: str = "/api/v1"
    CORS_ORIGINS: list = ["http://localhost:3001", "http://localhost:3000"]


settings = Settings()
