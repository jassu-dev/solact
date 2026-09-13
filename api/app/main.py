import logging
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.middleware.trustedhost import TrustedHostMiddleware
from contextlib import asynccontextmanager

from .config import settings
from .database import Base, engine
from .routers import auth, shopify, knowledge, conversations, ai, chatwoot, health

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s %(levelname)s %(name)s: %(message)s",
)
logger = logging.getLogger("solact.api")


@asynccontextmanager
async def lifespan(app: FastAPI):
    logger.info("Starting Solact API - ensuring isolated database and tables...")
    try:
        from sqlalchemy import create_engine, text
        from .config import settings
        import re

        # Auto-create 'solact' database if it doesn't exist yet by connecting to postgres/shopify_ai
        if "/solact" in settings.DATABASE_URL:
            admin_db_url = re.sub(r"/solact(\?.*)?$", r"/shopify_ai\1", settings.DATABASE_URL)
            try:
                temp_engine = create_engine(admin_db_url, isolation_level="AUTOCOMMIT")
                with temp_engine.connect() as conn:
                    res = conn.execute(text("SELECT 1 FROM pg_database WHERE datname = 'solact'")).scalar()
                    if not res:
                        logger.info("Database 'solact' not found. Creating database 'solact'...")
                        conn.execute(text("CREATE DATABASE solact"))
                        logger.info("Database 'solact' created!")
                temp_engine.dispose()
            except Exception as e:
                logger.warning(f"Note on checking/creating solact database: {e}")

        # Connect to solact database, create extension and all Solact tables
        from .database import Base, engine, SessionLocal
        from . import models
        from .models import User, Organization
        from .security import get_password_hash

        with engine.connect() as conn:
            conn.execute(text("CREATE EXTENSION IF NOT EXISTS vector"))
            conn.commit()

        Base.metadata.create_all(bind=engine)
        logger.info("Isolated Solact database schema verified.")

        # Seed initial admin user if not exists
        db = SessionLocal()
        try:
            admin_user = db.query(User).filter(User.email == "admin@solact.in").first()
            if not admin_user:
                logger.info("Seeding initial admin user: admin@solact.in...")
                org = Organization(name="Solact Primary Store", slug="solact-primary")
                db.add(org)
                db.flush()
                admin_user = User(
                    organization_id=org.id,
                    email="admin@solact.in",
                    name="Solact Founder",
                    password_hash=get_password_hash("Password123!"),
                    role="owner",
                    is_active=True,
                    is_verified=True,
                )
                db.add(admin_user)
                db.commit()
                logger.info("Default admin user created: admin@solact.in / Password123!")
        finally:
            db.close()
    except Exception as db_err:
        logger.error(f"Database initialization error: {db_err}", exc_info=True)

    logger.info("Pre-warming embedding model in RAM...")
    try:
        from .services.embeddings import warmup_embeddings
        warmup_embeddings()
    except Exception as emb_err:
        logger.error(f"Embedding warmup warning: {emb_err}")

    yield
    logger.info("Stopping Solact API")


app = FastAPI(
    title="Solact API",
    description="AI Customer Support Employee for Shopify stores",
    version="1.0.0",
    lifespan=lifespan,
)

from fastapi.responses import JSONResponse

@app.exception_handler(Exception)
async def global_exception_handler(request, exc):
    import traceback
    tb = traceback.format_exc()
    logger.error(f"Global unhandled error: {tb}")
    return JSONResponse(
        status_code=500,
        content={"detail": f"Server Error: {str(exc)}", "type": exc.__class__.__name__}
    )

app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "https://solact.in",
        "https://www.solact.in",
        "https://app.solact.in",
        "https://api.solact.in",
        "https://chat.solact.in",
        "http://localhost:3000",
        "http://localhost:3001",
        "http://localhost:8000",
    ],
    allow_origin_regex=r"https://.*\.solact\.in",
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
    expose_headers=["*"],
)


from fastapi.responses import HTMLResponse

@app.get("/", tags=["meta"])
def root():
    return {"name": "Solact API", "version": "1.0.0", "status": "ok"}


@app.get("/chat", response_class=HTMLResponse, include_in_schema=False)
def chat_page():
    return """<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <title>Solact Live AI Chat Widget - Wower Store</title>
  <style>
    body {
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
      background: #0f172a;
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      height: 100vh;
      margin: 0;
      color: #f8fafc;
    }
    .card {
      background: #1e293b;
      padding: 2.5rem;
      border-radius: 1rem;
      box-shadow: 0 20px 25px -5px rgb(0 0 0 / 0.5);
      max-width: 540px;
      text-align: center;
      border: 1px solid #334155;
    }
    h1 { margin-top: 0; font-size: 1.5rem; color: #f8fafc; }
    p { color: #94a3b8; line-height: 1.6; font-size: 0.95rem; }
    .badge {
      display: inline-block;
      background: #064e3b;
      color: #34d399;
      border: 1px solid #059669;
      padding: 0.25rem 0.75rem;
      border-radius: 9999px;
      font-weight: 600;
      font-size: 0.8rem;
      margin-bottom: 1rem;
    }
    .hint {
      background: #0f172a;
      padding: 1rem;
      border-radius: 0.5rem;
      font-size: 0.85rem;
      color: #cbd5e1;
      margin-top: 1.5rem;
      text-align: left;
      border: 1px solid #334155;
    }
  </style>
</head>
<body>
  <div class="card">
    <span class="badge">● Solact AI Employee Live</span>
    <h1>Wower Shopify Storefront</h1>
    <p>The Chatwoot live chat widget is loaded below in the bottom-right corner.</p>
    <div class="hint">
      <strong>Click the blue chat bubble on the bottom right and test:</strong>
      <ul style="margin: 0.5rem 0 0 1.2rem; padding: 0; line-height: 1.8;">
        <li><em>"hi"</em></li>
        <li><em>"what can you do for me?"</em></li>
        <li><em>"what is your return policy?"</em></li>
        <li><em>"where is order #1001?"</em></li>
        <li><em>"I need to speak to a human"</em></li>
      </ul>
    </div>
  </div>

  <script>
    (function(d,t) {
      var BASE_URL="https://chat.solact.in";
      var g=d.createElement(t),s=d.getElementsByTagName(t)[0];
      g.src=BASE_URL+"/packs/js/sdk.js?v=" + new Date().getTime();
      g.defer = true;
      g.async = true;
      s.parentNode.insertBefore(g,s);
      g.onload=function(){
        window.chatwootSDK.run({
          websiteToken: '8MWAY8JRfmqwJVrnhyzxTECm',
          baseUrl: BASE_URL
        })
      }
    })(document,"script");
  </script>
</body>
</html>"""


app.include_router(auth.router, prefix=settings.API_V1_PREFIX)
app.include_router(shopify.router, prefix=settings.API_V1_PREFIX)
app.include_router(knowledge.router, prefix=settings.API_V1_PREFIX)
app.include_router(conversations.router, prefix=settings.API_V1_PREFIX)
app.include_router(ai.router, prefix=f"{settings.API_V1_PREFIX}/ai")
app.include_router(chatwoot.router, prefix=f"{settings.API_V1_PREFIX}/integrations")
app.include_router(health.router, prefix=settings.API_V1_PREFIX)
app.include_router(shopify.webhooks_router, prefix=settings.API_V1_PREFIX)
