# Risk Scoring & Leader UI — Design Spec

## Context

The support inbox (Kanban board) is used by a team leader to manage 8,000+ support tickets. Three problems were identified:

- **A (critical):** No quick way to identify which tickets need urgent attention. No ticket currently reaches score ≥ 70 — the URGENT zone is permanently empty.
- **B:** No visibility into whether ticket load is balanced across agents.
- **D:** No view of ticket volume trends over time.

This spec covers the redesign of the scoring system and the leader-facing UI to address all three.

---

## 1. Current State (what exists today)

### State machine (`backend/services/state_machine.py`)

Strict directed graph — only these transitions are valid:

```
NEW           → TRIAGED
TRIAGED       → IN_PROGRESS
IN_PROGRESS   → WAITING_CUSTOMER | ESCALATED | RESOLVED
WAITING_CUSTOMER → IN_PROGRESS
ESCALATED     → IN_PROGRESS | RESOLVED
RESOLVED      → CLOSED | IN_PROGRESS
CLOSED        → IN_PROGRESS
```

`REOPENED` exists as a status in the UI but has no outgoing transitions defined. It is out of scope for this spec.

### Scoring system (`backend/services/triage_rules.py`)

Five additive rules, score capped at 100, stored in `tickets.risk_score`:

| Rule | Condition | Points |
|------|-----------|--------|
| `SLA_BREACH` | ENT/MID, no first reply, age > 4h | +40 (ENT) / +25 (MID) |
| `CHURN_SIGNAL` | Churn keywords in subject/body | +35 |
| `URGENT_UNATTENDED` | Customer-set priority = URGENT, no reply, age > 4h | +20 |
| `MULTIPLE_OPEN` | Customer has ≥3 other open tickets | +15 |
| `STALE_IN_PROGRESS` | IN_PROGRESS, no activity for 72h | +15 |

**Root causes of the empty URGENT zone:**
- `URGENT_UNATTENDED` trusts customer-defined priority — unreliable signal
- SLA threshold is 4h — too late for premium clients
- No rule penalizes churn tickets without an assigned agent
- Maximum achievable score in practice: 60 (ENT SLA + CHURN)

### Priority field

`tickets.priority` (LOW / MEDIUM / HIGH / URGENT) is imported from the CSV — customer-defined. The system never writes to it. One scoring rule (`URGENT_UNATTENDED`) reads it, creating a dependency on an unreliable input.

---

## 2. New Scoring System

### Design principles

- Priority must be owned entirely by the system — customer input is ignored
- The two most dangerous situations for the business get direct paths to URGENT (score ≥ 70):
  1. Churn signal + no assigned agent
  2. Premium client (ENT) with no reply in 2h
- All other signals are secondary, contributing to HIGH/MEDIUM ordering
- Score continues to drive card sort order within columns

### New rules

| Rule | Condition | Points | Flag |
|------|-----------|--------|------|
| `CHURN_UNASSIGNED` | Churn keywords in subject/body **AND** `assigned_to IS NULL` | **+70** | `CHURN_UNASSIGNED` |
| `ENT_NO_REPLY_2H` | Segment = ENT, `last_reply_by IS NULL`, age > 2h | **+70** | `ENT_NO_REPLY_2H` |
| `CHURN_WITH_AGENT` | Churn keywords **AND** `assigned_to IS NOT NULL` | **+35** | `CHURN_SIGNAL` |
| `MID_NO_REPLY_2H` | Segment = MID, `last_reply_by IS NULL`, age > 2h | **+30** | `MID_NO_REPLY_2H` |
| `MULTIPLE_OPEN` | Customer has ≥3 other open tickets | **+15** | `MULTIPLE_OPEN` |
| `STALE_IN_PROGRESS` | Status = IN_PROGRESS, `last_reply_at` > 72h ago | **+15** | `STALE_IN_PROGRESS` |

Score is capped at 100. Rules are additive — a ticket can match multiple rules.

**Removed rules:**
- `SLA_BREACH` — replaced by `ENT_NO_REPLY_2H` and `MID_NO_REPLY_2H` with a 2h threshold
- `URGENT_UNATTENDED` — removes dependency on customer-defined priority

### Note on CHURN_UNASSIGNED vs CHURN_WITH_AGENT

These two rules are mutually exclusive by design — a ticket either has an agent or it doesn't. The `CHURN_SIGNAL` flag (used in both) signals the presence of churn keywords. `CHURN_UNASSIGNED` fires when there is no agent; `CHURN_WITH_AGENT` fires when there is one. Both cannot fire on the same ticket simultaneously.

### Priority derivation

After scoring, `priority` is written to the `tickets` table:

```
score ≥ 70  →  URGENT
score 40–69 →  HIGH
score 10–39 →  MEDIUM
score  < 10 →  LOW
```

This overwrites any previous value. Priority is now a derived field, not an input.

### Expected impact on real data (8,000 tickets)

- Tickets with `CHURN_UNASSIGNED` → URGENT on their own
- Tickets with `ENT_NO_REPLY_2H` → URGENT on their own
- `MID_NO_REPLY_2H` (30) + `CHURN_WITH_AGENT` (35) = 65 → HIGH
- `MID_NO_REPLY_2H` (30) + `CHURN_WITH_AGENT` (35) + `MULTIPLE_OPEN` (15) = 80 → URGENT
- SMB tickets reach URGENT only by accumulating multiple secondary signals

### Re-import requirement

`triage_flags` and `risk_score` are pre-computed at import time (see `CLAUDE.md`). After changing `triage_rules.py`, run:

```powershell
cd backend
venv\Scripts\Activate.ps1
python scripts/import_csv.py
```

The import script is idempotent (upsert). `priority` must also be written during import — see Section 4 (Data flow).

---

## 3. UI Changes

### 3.1 Kanban cards — priority color coding

Each card gets a left border and score badge reflecting system-calculated priority:

| Priority | Border color | Score badge color |
|----------|-------------|-------------------|
| URGENT | `#FF5252` (solid) | `#FF8080` |
| HIGH | `#FF8C00` (solid) | `#FFB347` |
| MEDIUM | `#333333` (default) | `#7A7A7A` |
| LOW | `#333333` (default, dimmed) | `#555555` |

The score is shown in the top-right corner of each card alongside priority label.

Cards without an assigned agent keep the existing dashed border treatment on top of the priority color.

### 3.2 Alert panel (right sidebar, 30% width)

A fixed right panel sits alongside the kanban (70% width). It has three tabs:

#### Tab 1 — ⚡ Alertas

- Lists all tickets with `risk_score ≥ 70` (status ≠ CLOSED/RESOLVED), ordered by score descending
- Each item shows: flag label (e.g. "CHURN · SEM AGENTE"), subject preview, segment, ticket ID suffix, time since creation
- Solid red border for score ≥ 80; dashed red border for score = 70–79
- Clicking any item opens the ticket side panel (same behavior as clicking a kanban card)
- Tab badge shows live count: "⚡ Alertas N"
- Empty state: "Nenhum ticket crítico no momento" with a green checkmark

#### Tab 2 — 👥 Agentes

- Table of all 11 agents showing open ticket counts broken down by priority: URGENT | HIGH | MEDIUM | Total
- Rows sorted by Total descending
- Row highlighted in red if agent has ≥ 15 total open tickets or ≥ 3 URGENT tickets (overload signal)
- Data source: `/tickets` filtered by `assigned_to` and `status NOT IN (CLOSED, RESOLVED)`

#### Tab 3 — 📈 Tendências

- Bar chart: weekly ticket volume for Jan–Mar 2026 (the data range)
- Three summary stats below the chart: peak week volume, week-over-week change (%), URGENT count this week
- Data source: `/tickets` grouped by `created_at` week
- Chart built with a lightweight inline SVG (no external charting library)

### 3.3 Layout change

Current layout: full-width kanban.

New layout:
```
┌─────────────────────────────────────────────┬──────────────────┐
│                                             │                  │
│           KANBAN  (~70%)                    │  SIDE PANEL(30%) │
│                                             │  ⚡ | 👥 | 📈   │
│                                             │                  │
└─────────────────────────────────────────────┴──────────────────┘
```

The panel is always visible — not a drawer. On screens narrower than 1200px the panel collapses to a tab bar at the bottom (out of scope for this iteration; mark with a TODO comment).

---

## 4. Data Flow

### Scoring + priority write path

`calculate_triage_flags(ticket)` in `triage_rules.py` currently returns `(flags, score)`. It needs to also return `priority`:

```python
def calculate_triage_flags(ticket: dict) -> tuple[list[str], int, str]:
    # ... rules ...
    capped = min(score, 100)
    priority = "URGENT" if capped >= 70 else "HIGH" if capped >= 40 else "MEDIUM" if capped >= 10 else "LOW"
    return flags, capped, priority
```

The import script (`scripts/import_csv.py`) already calls `calculate_triage_flags` and writes `triage_flags` and `risk_score` to the DB. It must also write `priority`.

No API endpoint needs to change — the classify endpoint (`PATCH /tickets/{id}/classify`) already accepts `priority` and can override it manually if a team leader needs to. The system-calculated value is the default; manual override remains possible.

### Alert panel data

The alert panel fetches from the existing `GET /tickets` endpoint with:
```
?sort_by=risk_score&sort_desc=true&limit=100
```
Then filters client-side for `risk_score >= 70` and `status NOT IN [CLOSED, RESOLVED]`. Using limit=100 sorted by score guarantees all URGENT tickets are captured (they float to the top) without a new endpoint.

No new backend endpoint needed.

### Agent workload data

Also uses `GET /tickets` with no status filter, grouped client-side by `assigned_to`. No new endpoint needed.

### Trends data

Uses `GET /tickets` with `limit=500` (enough for 8,000 tickets across the Jan–Mar window if batched, or a dedicated endpoint). To avoid a large fetch, a new endpoint is preferred:

```
GET /tickets/stats/weekly
→ [{ week: "2026-W01", total: 245, urgent: 12 }, ...]
```

This is the only new backend endpoint required.

---

## 5. Files to Change

### Backend
- `backend/services/triage_rules.py` — rewrite 6 rules, add priority return value
- `backend/scripts/import_csv.py` — write `priority` field during upsert
- `backend/routers/tickets.py` — add `GET /tickets/stats/weekly` endpoint
- `backend/models.py` — no changes needed (priority field already exists in `TicketOut`)

### Frontend
- `frontend/components/KanbanCard.tsx` — add priority border color + score badge
- `frontend/components/KanbanBoard.tsx` — split layout 70/30, add side panel
- `frontend/components/AlertPanel.tsx` — new component (3-tab side panel)
- `frontend/lib/api.ts` — add `getWeeklyStats()` call

---

## 6. Out of Scope

- `REOPENED` state machine transitions
- Mobile/responsive layout for the side panel
- Real-time websocket updates (panel refreshes on a polling interval or on page focus)
- Drag-and-drop assignment from the agent workload table
- Email/Slack notifications for URGENT tickets
