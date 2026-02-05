# AI Validation Website

Validate AI assistant responses against criteria (character switch, information correct, guardrailed), with run management and analytics.

## Stack

- **Frontend**: Next.js (App Router), crystallization theme (glassmorphism, cyan/purple), sidebar nav
- **Backend**: FastAPI, Postgres (SQLAlchemy 2.0, Alembic)
- **Integrations**: MYLA stream API (configurable URL + JWT), OpenAI-compatible LLM for parsing and validation

## Backend

### Setup

```bash
cd backend
python -m venv .venv
source .venv/bin/activate   # or .venv\Scripts\activate on Windows
pip install -r requirements.txt
cp .env.example .env
# Edit .env: DATABASE_URL, DATABASE_URL_SYNC, LLM_API_KEY, LLM_BASE_URL
```

### Database

```bash
# Create DB (e.g. createdb nw_validation)
alembic upgrade head
# Seed prompts and validation criteria
python -m app.prompt_hub.seed
# Or after starting API: POST /api/prompts/seed
```

### Run

```bash
uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
```

API: `http://localhost:8000`. Docs: `http://localhost:8000/docs`.

## Frontend

### Setup

```bash
cd frontend
npm install
cp .env.example .env.local
# Set NEXT_PUBLIC_API_URL=http://localhost:8000/api
```

### Run

```bash
npm run dev
```

Open `http://localhost:3000`.

## Flow

1. **Parser**: Upload text/file → LLM parses queries and expectations → saved as Dataset + Queries.
2. **Run**: Select dataset, set API URL and JWT, create run → message processing calls MYLA stream per query, stores responses; progress bar polls `/api/runs/{id}/progress`.
3. **Validation**: After message processing, responses are validated in batches of 50 per criterion via LLM; results stored.
4. **Report**: Per-run analytics (success rate, per-criterion pass rate and scores).

## Criteria (default)

- **character_switch**: Correct character/persona in response
- **information_correct**: Response information matches expectations
- **guardrailed**: Response is safe and within guardrails

Criteria and prompts are extendable via DB and Prompt Hub; seed loads defaults.
