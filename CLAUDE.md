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

# Re-import CSV (idempotent upsert; LLM results cached in scripts/churn_cache.json)
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
    app/inbox/page.tsx          → ticket list (KanbanBoard)
    app/tickets/[id]/page.tsx   → ticket detail (server component)
    app/agent/page.tsx          → AI chat
    components/                 → KanbanBoard, KanbanColumn, KanbanCard,
                                   TicketDetailPanel, ActionButtons, AuditLog,
                                   AgentChat, TriageBadge,
                                   AlertPanel (AlertsSidebar + StatsBottomBar),
                                   MorningBriefingModal
    lib/api.ts                  → all fetch calls, single BASE constant
    types/index.ts              → shared TypeScript types
          ↕ HTTP (NEXT_PUBLIC_BACKEND_URL)
backend/ (FastAPI, Render)
    main.py                     → app setup, CORS (ALLOWED_ORIGINS from env)
    database.py                 → Supabase singleton (uses SERVICE_KEY always)
    models.py                   → Pydantic request/response models
    routers/
        tickets.py              → /tickets CRUD + /tickets/stats/* endpoints
        audit.py                → /tickets/{id}/audit
        agent.py                → /agent/chat
    services/
        triage_rules.py         → calculate_triage_flags(ticket, has_churn?) → (flags, score, priority)
        churn_classifier.py     → classify_churn_batch(tickets) → {ticket_id: bool} via GPT-4o-mini
        morning_briefing.py     → generate_morning_briefing(created_after, created_before) → dict
        state_machine.py        → can_transition(current, target) → (bool, msg)
        audit.py                → log_event(...)
        ai_agent.py             → run_agent(history, message, confirmed_tool_call)
    scripts/
        import_csv.py           → bulk import with LLM churn classification + cache
          ↕ Supabase Python SDK
Supabase (PostgreSQL)
    tickets                     → main table; triage_flags (array), risk_score stored
    audit_log                   → every mutation logged with source USER|AGENT
    ticket_replies              → replies are a separate table
```

## Key Design Decisions

**Triage flags and priority are pre-computed at import time** (`scripts/import_csv.py`) and stored in the `tickets` table. They are not recalculated on reads. If triage logic changes, re-run the import script.

**Priority is system-calculated — never trust the customer-supplied value.** `calculate_triage_flags()` returns `(flags, score, priority)`. Priority is derived from score: `≥70 → URGENT`, `40–69 → HIGH`, `10–39 → MEDIUM`, `<10 → LOW`. The import script overwrites `priority` with the system value on every run.

**Churn detection uses LLM, not keywords.** `services/churn_classifier.py` calls GPT-4o-mini in batches of 25 tickets. The import script caches results in `scripts/churn_cache.json`; subsequent runs load from cache and skip the API call. `calculate_triage_flags()` accepts an optional `has_churn: bool | None` parameter — when `None`, it falls back to keyword matching (useful for single-ticket runtime triage without LLM cost). The LLM approach reduced false-positive churn flags by 32% compared to keyword matching (663 → 450 tickets flagged).

**Triage rules (6 active rules):**
- `CHURN_UNASSIGNED` — LLM detects churn intent + no agent assigned → **+70**
- `ENT_NO_REPLY_2H` — ENT segment, no reply, age > 2h → **+70**
- `CHURN_SIGNAL` — LLM detects churn intent + agent assigned → **+35**
- `MID_NO_REPLY_2H` — MID segment, no reply, age > 2h → **+30**
- `MULTIPLE_OPEN` — customer has ≥3 other open tickets → **+15**
- `STALE_IN_PROGRESS` — IN_PROGRESS, no activity for 72h → **+15**

**Stats endpoints return aggregated data, not raw tickets.** Three endpoints under `/tickets/stats/`:
- `GET /tickets/stats/agents` — open ticket count per agent broken down by priority (excludes CLOSED/RESOLVED)
- `GET /tickets/stats/volume-by-segment` — total/open/closed count per segment (ENT/MID/SMB)
- `GET /tickets/stats/risk-by-segment` — average risk score per segment
- `GET /tickets/stats/morning-briefing` — AI-generated briefing for a period of ≤3 days (see Morning Briefing section below)
All four accept `created_after` and `created_before` date filters.

**Morning Briefing** — endpoint `GET /tickets/stats/morning-briefing?created_after=...&created_before=...` validates that both params are present and that the range is ≤3 days (400 otherwise). The service `services/morning_briefing.py` runs two Supabase queries: (1) tickets created in the period (period-scoped) to count by segment and detect unassigned urgent tickets; (2) all open assigned tickets (not period-scoped) to compute current agent overload. It then calls GPT-4o-mini with `response_format={"type":"json_object"}` to generate `narrative` (1-2 sentences in Portuguese) and `next_steps` (3-5 action items in Portuguese starting with an infinitive verb). On parse failure the service returns `narrative=""` and `next_steps=[]` without crashing.

**Morning Briefing frontend caching** — `StatsBottomBar` caches the last generated `MorningBriefingData` in state. A `useEffect` on `[createdAfter, createdBefore]` clears the cache when the date range changes. First click → calls API, sets data, opens modal, button label becomes "Ver Morning Briefing". Subsequent clicks → opens modal directly without calling the API. This means one API call per date range per session.

**Alert panel layout** — the inbox page uses a layout with kanban on the left, `AlertsSidebar` on the right (fixed 320px), and `StatsBottomBar` below. `AlertsSidebar` shows tickets with `risk_score ≥ 70`. `StatsBottomBar` has three panels: Balanceamento de agentes · Volume por segmento · Score de risco médio por segmento. All panels respect the active date filter via `createdAfter`/`createdBefore` props and a `refreshKey` counter that increments on ticket mutations.

**StatsBottomBar uses stale-while-revalidate** via a `hasData` ref. On re-fetch (date filter change or refreshKey bump), existing data stays visible and a pulse dot appears instead of a full loading screen.

**Route ordering matters in FastAPI** — `/tickets/flagged`, `/tickets/agents`, and all `/tickets/stats/*` routes are registered before `/tickets/{ticket_id}`. Moving them after would cause their path segments to be matched as ticket IDs.

**All DB writes use the service role key** (`SUPABASE_SERVICE_KEY`), not the anon key. Supabase RLS blocks inserts with the anon key. `database.py` always prefers `SUPABASE_SERVICE_KEY`.

**Agent conversation history is stateless** — the entire `updated_history` array is sent back from the client on every turn. The backend does not store session state.

**Agent write-tool confirmation flow** — when the agent wants to call a write tool (`update_ticket_status`, `assign_ticket`, `classify_ticket`), it returns `pending_action` instead of executing. The frontend shows a confirmation banner; on confirm, the frontend sends `confirmed_action` back and the backend executes it. The `message` field is an empty string on confirm turns — the backend ignores it when `confirmed_action` is set.

**Invalid status transitions return HTTP 422**, not 400. The state machine (`services/state_machine.py`) defines the allowed transitions.

**tsconfig.json excludes test files from Next.js type check.** `vitest.config.mts`, `vitest.setup.ts`, `__tests__/`, `e2e/`, and `playwright.config.ts` are in the `exclude` list. Without this, Next.js's type checker picks up `vitest.config.mts` via the `**/*.mts` include pattern and fails due to a Vite version conflict between Next.js and vitest's bundled Vite.

**Design specs** live in `docs/superpowers/specs/`. See `2026-05-20-risk-scoring-and-leader-ui-design.md` for the full scoring + UI redesign spec.

## Environment Variables

Backend (`.env` locally, Render dashboard in prod):
- `SUPABASE_URL`, `SUPABASE_SERVICE_KEY` — required
- `OPENAI_API_KEY` — required for LLM churn classifier and AI agent
- `ALLOWED_ORIGINS` — comma-separated CORS origins; defaults to `*` if unset

Frontend (`.env.local` locally, Vercel dashboard in prod):
- `NEXT_PUBLIC_BACKEND_URL` — defaults to `http://localhost:8000`

## Next.js Version Note

> **From `frontend/AGENTS.md`:** This version has breaking changes — APIs, conventions, and file structure may differ from training data. Read `node_modules/next/dist/docs/` before writing code. In particular, `params` in dynamic routes is a `Promise` and must be `await`ed.
