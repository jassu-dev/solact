# ===== Windows dev setup (PowerShell) =====
# 1. Install prerequisites:
#    - Python 3.11+ from https://www.python.org/
#    - Node.js 20+ LTS from https://nodejs.org/
#    - Docker Desktop: https://www.docker.com/products/docker-desktop/
#    - Git: https://git-scm.com/

# 2. Start PostgreSQL + Redis:
# (Run in project root)
docker-compose up -d postgres redis

# 3. Setup Python environment (API):
cd api
py -3.11 -m venv .venv
.\.venv\Scripts\Activate.ps1
python -m pip install --upgrade pip
pip install -r requirements.txt
pip install -r requirements-dev.txt

# 4. Configure environment:
Copy-Item .env.example .env
# Edit: JWT_SECRET, ENCRYPTION_KEY, SHOPIFY_API_KEY, SHOPIFY_API_SECRET, LLM_API_KEY, CHATWOOT_URL / TOKEN

# 5. Initialize DB tables (run once):
$env:DATABASE_URL = "postgresql+psycopg2://solact_founder:Solact123@localhost:5432/shopify_ai"
python -c "
from app.database import Base, engine
from app import models
from sqlalchemy import text
with engine.connect() as c:
    c.execute(text('CREATE EXTENSION IF NOT EXISTS vector'));
    c.commit()
Base.metadata.create_all(bind=engine)
print('Created tables')
"
# Or using Alembic:
alembic revision --autogenerate -m "initial"
alembic upgrade head

# 6. Start the API:
python run.py
# Check health: http://localhost:8000/api/v1/health
# Swagger docs: http://localhost:8000/docs

# 7. Setup the dashboard (new terminal):
cd ..\dashboard
npm install
Copy-Item .env.example .env
# edit if needed
npm run dev
# Open: http://localhost:3001

# 8. Run the test suite:
cd ..\api
.\.venv\Scripts\Activate.ps1
# Start a temporary test DB (or use main DB - tests clean tables each run)
pytest tests

# 9. (Optional) Start Celery worker for background jobs:
cd api
.\.venv\Scripts\Activate.ps1
celery -A worker.celery_app worker -l info -c 2 --pool=solo

# ===== Docker full stack =====
# See DOCKER section below.
