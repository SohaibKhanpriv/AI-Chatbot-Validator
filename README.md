# AI Validation Testing App

A testing and validation platform for AI assistant responses. Parse training data into query/expectation pairs, run them against a live chat API (e.g. MYLA), and validate responses against configurable criteria using an LLM—with run management, progress tracking, and analytics.

---

## What This App Does

- **Parse & Ingest** — Upload text or documents; an LLM extracts **queries** and **expectations** into structured **datasets**.
- **Run Tests** — Create **runs** that call your chat/stream API (MYLA or compatible) for each query, store responses, and track progress.
- **Validate** — After message processing, responses are validated in batches against criteria (character switch, information correct, guardrailed, expectation match) via an OpenAI-compatible LLM.
- **Analyze** — View per-run reports: success rates, per-criterion pass rates, deep analysis tables, and export to Excel.
- **Prompt Hub** — Manage prompts and validation criteria in the database; seed from YAML.
- **Character Timeline & Conversation Graph** — Inspect conversation flow and character switches visually.

---

## Tech Stack

| Layer      | Stack |
|-----------|--------|
| **Frontend** | Next.js 16 (App Router), React 19, Tailwind CSS 4, Framer Motion, React Flow, Zustand |
| **Backend**  | FastAPI, PostgreSQL, SQLAlchemy 2.0, Alembic |
| **Integrations** | MYLA stream API (configurable URL + JWT), OpenAI-compatible LLM for parsing and validation |

---

## Prerequisites

- **Node.js** 18+ and **npm**
- **Python** 3.10+
- **PostgreSQL** (local or remote instance)
- **OpenAI-compatible API key** (for parsing and validation)

---

## Backend Setup

### 1. Create and activate a virtual environment

```bash
cd backend
python -m venv .venv
```

- **macOS/Linux:** `source .venv/bin/activate`
- **Windows:** `.venv\Scripts\activate`

### 2. Install dependencies

```bash
pip install -r requirements.txt
```

### 3. Environment variables

```bash
cp .env.example .env
```

Edit `.env` and set:

| Variable | Description |
|----------|-------------|
| `DATABASE_URL` | Async Postgres URL, e.g. `postgresql+asyncpg://user:password@localhost:5432/nw_validation` |
| `DATABASE_URL_SYNC` | Sync Postgres URL for Alembic, e.g. `postgresql://user:password@localhost:5432/nw_validation` |
| `LLM_API_KEY` | Your OpenAI-compatible API key |
| `LLM_BASE_URL` | API base URL (default: `https://api.openai.com/v1`) |
| `ENCRYPTION_KEY` | 32-byte hex key for encrypting stored tokens (optional but recommended for token usage features) |
| `INPUT_PER_1M` | (Optional) Input cost per 1M tokens for cost scripts |
| `OUTPUT_PER_1M` | (Optional) Output cost per 1M tokens for cost scripts |

### 4. Database

Create the database (if it doesn’t exist), then run migrations:

```bash
# Create DB (example for local Postgres)
createdb nw_validation

# Run migrations
alembic upgrade head
```

### 5. Seed prompts and validation criteria

```bash
python -m app.prompt_hub.seed
```

Alternatively, after the API is running: `POST /api/prompts/seed`.

### 6. Run the API

```bash
uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
```

- **API:** http://localhost:8000  
- **OpenAPI docs:** http://localhost:8000/docs  

---

## Frontend Setup

### 1. Install dependencies

```bash
cd frontend
npm install
```

### 2. Environment variables

```bash
cp .env.example .env.local
```

Set the backend API base URL:

```env
NEXT_PUBLIC_API_URL=http://localhost:8000/api
```

### 3. Run the dev server

```bash
npm run dev
```

Open **http://localhost:3000** in your browser.

---

## Quick Start (Both Together)

From the project root:

```bash
# Terminal 1 — Backend
cd backend && source .venv/bin/activate && pip install -r requirements.txt
cp .env.example .env   # edit .env with your DB and LLM settings
createdb nw_validation  # if needed
alembic upgrade head && python -m app.prompt_hub.seed
uvicorn app.main:app --reload --host 0.0.0.0 --port 8000

# Terminal 2 — Frontend
cd frontend && npm install && cp .env.example .env.local
npm run dev
```

Then open http://localhost:3000 and ensure the backend is reachable (Dashboard will show an error if not).

---

## App Flow

1. **Datasets** — Create a dataset by uploading text or pasting content. The parser (LLM) extracts queries and expectations and stores them as a **Dataset** with **Queries**.
2. **Runs** — On the **Runs** page, create a run: choose a dataset, set the MYLA (or compatible) API URL and JWT, then start. The app processes each query through the stream API and stores responses; the progress bar polls `/api/runs/{id}/progress`.
3. **Validation** — When message processing finishes, validation runs in batches (default 50 per criterion) via the LLM. Results are stored per criterion.
4. **Reports** — Open a run’s report to see success rate, per-criterion pass rates, scores, and deep analysis. Export to Excel from the report view.

---

## Main Sections (UI)

| Section | Description |
|--------|-------------|
| **Dashboard** | Overview: total runs, completed count, average completion %, recent runs. |
| **Datasets** | List datasets, create new (upload/paste), view queries and expectations. |
| **Runs** | Create runs (dataset, API URL, JWT), list runs, view progress and status. |
| **Run detail & Report** | Per-run progress, validation status, and report with pass rates and export. |
| **Character timeline** | Timeline view of character usage across conversations. |
| **Conversation graph** | Graph view of conversation flow. |
| **Prompt Hub** | Manage prompts used for parsing and validation. |
| **Validation Criteria** | View and manage criteria (expectation match, character switch, information correct, guardrailed). |

---

## Default Validation Criteria

After seeding, these criteria are available (names and behavior can be customized via DB or YAML):

| Key | Name | Purpose |
|-----|------|--------|
| `expectation_match` | Expectation match | Response satisfies the stated expectations for the query. |
| `character_switch` | Correct Character Switch | Response is from the correct avatar/persona (e.g. Myla, Nuri, Spark, Flo, Luna, Sophi). |
| `information_correct` | Response Information Correct | No invented data; facts from user or allowed context; correct handling of menus/options. |
| `guardrailed` | Response Guardrailed | Safe, within policy, subscription guardrails, prompt-injection resistant. |

Criteria and their prompts are stored in the database and can be extended or edited via the Prompt Hub and Validation Criteria UIs (or by re-seeding from YAML).

---

## Optional: Token Usage & Cost Script

Backend includes a script to analyze validation token usage and optional cost:

```bash
cd backend
source .venv/bin/activate
python scripts/validation_token_usage.py --run-id <RUN_UUID> [--cost]
```

Use `--cost` to estimate cost; set `INPUT_PER_1M` and `OUTPUT_PER_1M` in `.env` for your model’s pricing.

---

## Project Structure (High Level)

```
NW-ai-validation/
├── backend/
│   ├── app/
│   │   ├── api/          # FastAPI routers (datasets, runs, progress, prompts, reports)
│   │   ├── models/       # SQLAlchemy models
│   │   ├── schemas/      # Pydantic schemas
│   │   ├── services/     # LLM client, validation, parser, MYLA stream, etc.
│   │   └── prompt_hub/   # YAML prompts, criteria, seed script
│   ├── alembic/         # Migrations
│   ├── scripts/         # e.g. validation_token_usage.py
│   ├── requirements.txt
│   └── .env.example
├── frontend/
│   ├── src/
│   │   ├── app/         # Next.js App Router pages
│   │   ├── components/  # UI components, sidebar, run form, etc.
│   │   ├── lib/         # API client, graph/timeline helpers
│   │   └── state/       # Zustand store
│   ├── package.json
│   └── .env.example
└── README.md
```

---

## Troubleshooting

- **“Could not reach API”** on the Dashboard — Ensure the backend is running on the port in `NEXT_PUBLIC_API_URL` and CORS allows the frontend origin.
- **Database connection errors** — Check `DATABASE_URL` / `DATABASE_URL_SYNC`, that Postgres is running, and the database exists.
- **Validation or parsing failures** — Check `LLM_API_KEY` and `LLM_BASE_URL`; review backend logs and the run’s progress/status.
- **Seed already run** — Running `python -m app.prompt_hub.seed` again updates existing prompts/criteria; it’s safe to re-run.

---

## License

See repository or project license file if present.
