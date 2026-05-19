# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

### Backend (run from `backend/`)
```powershell
# Activate venv (Windows)
venv\Scripts\Activate.ps1

# Run dev server
uvicorn main:app --reload --port 8000

# Run tests
pytest

# Re-import CSV (idempotent upsert)
python scripts/import_csv.py
```

### Frontend (run from `frontend/`)
```powershell
# Node.js may not be in PATH — prefix commands with:
$env:PATH = "C:\Program Files\nodejs;$env:PATH"

npm run dev       # dev server on :3000
npx next build    # production build + type check
```

### API docs
FastAPI auto-generates docs at `http://localhost:8000/docs` while the backend is running.

## Architecture

```
frontend/ (Next.js, Vercel)
    app/inbox/page.tsx          → ticket list
    app/tickets/[id]/page.tsx   → ticket detail (server component)
    app/agent/page.tsx          → AI chat
    components/                 → TicketTable, ActionButtons, AuditLog,
                                   TicketDetailPanel, AgentChat, TriageBadge
    lib/api.ts                  → all fetch calls, single BASE constant
    types/index.ts              → shared TypeScript types
          ↕ HTTP (NEXT_PUBLIC_BACKEND_URL)
backend/ (FastAPI, Render)
    main.py                     → app setup, CORS (ALLOWED_ORIGINS from env)
    database.py                 → Supabase singleton (uses SERVICE_KEY always)
    models.py                   → Pydantic request/response models
    routers/
        tickets.py              → /tickets CRUD
        audit.py                → /tickets/{id}/audit
        agent.py                → /agent/chat
    services/
        triage_rules.py         → calculate_triage_flags(ticket) → (flags, score)
        state_machine.py        → can_transition(current, target) → (bool, msg)
        audit.py                → log_event(...)
        ai_agent.py             → run_agent(history, message, confirmed_tool_call)
          ↕ Supabase Python SDK
Supabase (PostgreSQL)
    tickets                     → main table; triage_flags (array), risk_score stored
    audit_log                   → every mutation logged with source USER|AGENT
    ticket_replies              → replies are a separate table
```

## Key Design Decisions

**Triage flags are pre-computed at import time** (`scripts/import_csv.py`) and stored in the `tickets` table. They are not recalculated on reads. If triage logic changes, re-run the import script.

**Route ordering matters in FastAPI** — `/tickets/flagged` is registered before `/tickets/{ticket_id}`. Moving it after would cause "flagged" to be matched as a ticket ID.

**All DB writes use the service role key** (`SUPABASE_SERVICE_KEY`), not the anon key. Supabase RLS blocks inserts with the anon key. `database.py` always prefers `SUPABASE_SERVICE_KEY`.

**Agent conversation history is stateless** — the entire `updated_history` array is sent back from the client on every turn. The backend does not store session state.

**Agent write-tool confirmation flow** — when the agent wants to call a write tool (`update_ticket_status`, `assign_ticket`, `classify_ticket`), it returns `pending_action` instead of executing. The frontend shows a confirmation banner; on confirm, the frontend sends `confirmed_action` back and the backend executes it. The `message` field is an empty string on confirm turns — the backend ignores it when `confirmed_action` is set.

**Invalid status transitions return HTTP 422**, not 400. The state machine (`services/state_machine.py`) defines the allowed transitions.

## Environment Variables

Backend (`.env` locally, Render dashboard in prod):
- `SUPABASE_URL`, `SUPABASE_SERVICE_KEY` — required
- `OPENAI_API_KEY` — required for AI agent
- `ALLOWED_ORIGINS` — comma-separated CORS origins; defaults to `*` if unset

Frontend (`.env.local` locally, Vercel dashboard in prod):
- `NEXT_PUBLIC_BACKEND_URL` — defaults to `http://localhost:8000`

## Next.js Version Note

> **From `frontend/AGENTS.md`:** This version has breaking changes — APIs, conventions, and file structure may differ from training data. Read `node_modules/next/dist/docs/` before writing code. In particular, `params` in dynamic routes is a `Promise` and must be `await`ed.
