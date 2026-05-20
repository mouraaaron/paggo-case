# Risk Scoring & Leader UI Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the broken risk scoring system with 6 new rules that produce URGENT tickets, add auto-calculated priority, and add a 3-tab side panel (alerts / agent workload / trends) to the Kanban board.

**Architecture:** Backend `triage_rules.py` is rewritten with new rules and now returns `(flags, score, priority)`. The import script writes `priority` to the DB. Two new backend endpoints provide stats. On the frontend, `KanbanBoard` gains a fixed 320px right panel (`AlertPanel`) with three tabs; `KanbanCard` gains priority-based border colors.

**Tech Stack:** FastAPI + Supabase Python SDK (backend), Next.js App Router + Tailwind CSS v4 with `@theme {}` brand tokens (frontend). No new dependencies required.

---

## Codebase Context (read before starting any task)

**Brand tokens** (defined in `frontend/app/globals.css` via `@theme {}`):
- `brand-black` = `#0A0A0A`, `brand-surface` = `#1A1A1A`, `brand-mid` = `#2E2E2E`
- `brand-muted` = `#7A7A7A`, `brand-border` = `#333333`
- `brand-green` = `#C8FF00`, `brand-error` = `#FF5252`, `brand-success` = `#4CAF50`

**Tailwind v4 note:** There is no `tailwind.config.ts`. Colors are defined with `@theme {}` in CSS. Use `text-brand-green`, `bg-brand-mid`, etc. directly in JSX.

**Supabase note:** All DB writes use the service role key. `database.py` exposes `get_db()` which returns a Supabase client.

**Route ordering:** In `backend/routers/tickets.py`, all static routes (e.g. `/flagged`, `/agents`) must be declared BEFORE `/{ticket_id}` to prevent FastAPI from matching a literal string as a ticket ID. New stat routes follow the same rule.

**Score pre-computation:** `triage_flags`, `risk_score`, and `priority` are computed at import time by running `python scripts/import_csv.py`. They are stored in the `tickets` table. They are NOT recalculated on reads. After changing `triage_rules.py`, you MUST re-run the import script.

**Test runner:** From `backend/` with venv activated: `pytest` or `pytest tests/test_triage_rules.py -v`.

---

## File Map

| File | Action | Responsibility |
|------|--------|----------------|
| `backend/services/triage_rules.py` | Modify | 6 new rules + priority return value |
| `backend/tests/test_triage_rules.py` | Modify | Replace old tests with new ones |
| `backend/scripts/import_csv.py` | Modify | Unpack 3-tuple; write `priority` to DB |
| `backend/routers/tickets.py` | Modify | Add `GET /tickets/stats/weekly` and `GET /tickets/stats/agents` |
| `frontend/types/index.ts` | Modify | Update `TriageFlag` union type |
| `frontend/components/TriageBadge.tsx` | Modify | Update `FLAG_CONFIG` for new flag names |
| `frontend/lib/api.ts` | Modify | Add `getWeeklyStats()` and `getAgentStats()` |
| `frontend/components/KanbanCard.tsx` | Modify | Priority-based border color + priority badge colors |
| `frontend/components/AlertPanel.tsx` | Create | 3-tab side panel (alerts / agents / trends) |
| `frontend/components/KanbanBoard.tsx` | Modify | 70/30 flex layout + import AlertPanel |

---

## Task 1: Rewrite triage_rules.py

**Files:**
- Modify: `backend/services/triage_rules.py`
- Modify: `backend/tests/test_triage_rules.py`

- [ ] **Step 1: Replace test_triage_rules.py with new tests**

Overwrite the entire file:

```python
# backend/tests/test_triage_rules.py
from datetime import datetime, timezone, timedelta
import sys, os
sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))
from services.triage_rules import calculate_triage_flags

def make_ticket(**overrides):
    now = datetime.now(timezone.utc)
    base = {
        "ticket_id": "T001",
        "customer_segment": "SMB",
        "plan": "FREE",
        "status": "NEW",
        "subject": "help with login",
        "body_preview": "I can not log in",
        "created_at": now - timedelta(hours=1),
        "last_reply_at": None,
        "last_reply_by": None,
        "assigned_to": None,
        "previous_open_tickets_for_customer": 0,
    }
    return {**base, **overrides}

def test_no_flags_smb_normal():
    flags, score, priority = calculate_triage_flags(make_ticket())
    assert flags == []
    assert score == 0
    assert priority == "LOW"

def test_churn_unassigned_is_urgent():
    ticket = make_ticket(subject="pensando em cancelar", assigned_to=None)
    flags, score, priority = calculate_triage_flags(ticket)
    assert "CHURN_UNASSIGNED" in flags
    assert "CHURN_SIGNAL" not in flags
    assert score == 70
    assert priority == "URGENT"

def test_churn_with_agent_is_medium():
    ticket = make_ticket(subject="pensando em cancelar", assigned_to="Ana Souza")
    flags, score, priority = calculate_triage_flags(ticket)
    assert "CHURN_SIGNAL" in flags
    assert "CHURN_UNASSIGNED" not in flags
    assert score == 35
    assert priority == "MEDIUM"

def test_ent_no_reply_2h_is_urgent():
    now = datetime.now(timezone.utc)
    ticket = make_ticket(
        customer_segment="ENT",
        created_at=now - timedelta(hours=3),
        last_reply_by=None,
    )
    flags, score, priority = calculate_triage_flags(ticket)
    assert "ENT_NO_REPLY_2H" in flags
    assert score == 70
    assert priority == "URGENT"

def test_ent_replied_no_flag():
    now = datetime.now(timezone.utc)
    ticket = make_ticket(
        customer_segment="ENT",
        created_at=now - timedelta(hours=3),
        last_reply_by="AGENT",
    )
    flags, _, _ = calculate_triage_flags(ticket)
    assert "ENT_NO_REPLY_2H" not in flags

def test_ent_under_2h_no_flag():
    now = datetime.now(timezone.utc)
    ticket = make_ticket(
        customer_segment="ENT",
        created_at=now - timedelta(hours=1),
        last_reply_by=None,
    )
    flags, _, _ = calculate_triage_flags(ticket)
    assert "ENT_NO_REPLY_2H" not in flags

def test_mid_no_reply_2h_is_medium():
    now = datetime.now(timezone.utc)
    ticket = make_ticket(
        customer_segment="MID",
        created_at=now - timedelta(hours=3),
        last_reply_by=None,
    )
    flags, score, priority = calculate_triage_flags(ticket)
    assert "MID_NO_REPLY_2H" in flags
    assert score == 30
    assert priority == "MEDIUM"

def test_mid_churn_with_agent_is_high():
    now = datetime.now(timezone.utc)
    ticket = make_ticket(
        customer_segment="MID",
        created_at=now - timedelta(hours=3),
        last_reply_by=None,
        subject="pensando em cancelar",
        assigned_to="Ana Souza",
    )
    flags, score, priority = calculate_triage_flags(ticket)
    assert "MID_NO_REPLY_2H" in flags
    assert "CHURN_SIGNAL" in flags
    assert score == 65
    assert priority == "HIGH"

def test_multiple_open():
    ticket = make_ticket(previous_open_tickets_for_customer=3)
    flags, score, _ = calculate_triage_flags(ticket)
    assert "MULTIPLE_OPEN" in flags
    assert score == 15

def test_stale_in_progress():
    now = datetime.now(timezone.utc)
    ticket = make_ticket(
        status="IN_PROGRESS",
        last_reply_at=now - timedelta(hours=73),
    )
    flags, _, _ = calculate_triage_flags(ticket)
    assert "STALE_IN_PROGRESS" in flags

def test_score_capped_at_100():
    now = datetime.now(timezone.utc)
    ticket = make_ticket(
        customer_segment="ENT",
        created_at=now - timedelta(hours=5),
        last_reply_by=None,
        assigned_to=None,
        subject="pensando em cancelar",
        previous_open_tickets_for_customer=5,
        status="IN_PROGRESS",
        last_reply_at=now - timedelta(hours=80),
    )
    _, score, _ = calculate_triage_flags(ticket)
    assert score <= 100

def test_priority_thresholds():
    now = datetime.now(timezone.utc)
    # HIGH: MID no reply + churn with agent = 65
    ticket_high = make_ticket(
        customer_segment="MID",
        created_at=now - timedelta(hours=3),
        last_reply_by=None,
        subject="pensando em cancelar",
        assigned_to="Ana Souza",
    )
    _, score_high, priority_high = calculate_triage_flags(ticket_high)
    assert score_high == 65
    assert priority_high == "HIGH"

    # LOW: score 0
    _, _, priority_low = calculate_triage_flags(make_ticket())
    assert priority_low == "LOW"
```

- [ ] **Step 2: Run tests — confirm all fail**

```powershell
cd backend
venv\Scripts\Activate.ps1
pytest tests/test_triage_rules.py -v
```

Expected: most tests FAIL (old implementation returns 2-tuple, new tests unpack 3-tuple; old flags are gone).

- [ ] **Step 3: Rewrite triage_rules.py**

Overwrite the entire file:

```python
# backend/services/triage_rules.py
from datetime import datetime, timezone

CHURN_KEYWORDS = [
    "cancelar", "cancel", "trocar", "switch", "reembolso", "refund",
    "concorrente", "competitor", "desativar", "encerrar conta",
    "pensando em", "outro fornecedor", "outra solução", "deixar de usar",
    "pensando em mudar", "avaliando alternativas",
]

def _parse_dt(value) -> datetime | None:
    if value is None:
        return None
    if isinstance(value, datetime):
        return value
    try:
        return datetime.fromisoformat(str(value).replace("Z", "+00:00"))
    except ValueError:
        return None

def _age_hours(dt: datetime | None) -> float:
    if dt is None:
        return 0.0
    now = datetime.now(timezone.utc)
    if dt.tzinfo is None:
        dt = dt.replace(tzinfo=timezone.utc)
    return (now - dt).total_seconds() / 3600

def calculate_triage_flags(ticket: dict) -> tuple[list[str], int, str]:
    """
    Returns (flags, risk_score 0-100, priority) for a ticket dict.
    Rules are additive; score is capped at 100.
    Priority derived from score: >=70=URGENT, 40-69=HIGH, 10-39=MEDIUM, <10=LOW.
    """
    flags: list[str] = []
    score = 0

    created_at = _parse_dt(ticket.get("created_at"))
    last_reply_at = _parse_dt(ticket.get("last_reply_at"))
    last_reply_by = ticket.get("last_reply_by")
    age_h = _age_hours(created_at)
    segment = ticket.get("customer_segment", "")
    status = ticket.get("status", "")
    assigned_to = ticket.get("assigned_to")
    prev_open = ticket.get("previous_open_tickets_for_customer", 0) or 0

    text = f"{ticket.get('subject', '')} {ticket.get('body_preview', '')}".lower()
    has_churn = any(kw in text for kw in CHURN_KEYWORDS)

    # Rule 1: CHURN_UNASSIGNED — churn signal + no agent assigned
    if has_churn and not assigned_to:
        flags.append("CHURN_UNASSIGNED")
        score += 70

    # Rule 2: ENT_NO_REPLY_2H — ENT client, no first reply, open > 2h
    if segment == "ENT" and last_reply_by is None and age_h > 2:
        flags.append("ENT_NO_REPLY_2H")
        score += 70

    # Rule 3: CHURN_WITH_AGENT — churn signal + agent is assigned (flag stored as CHURN_SIGNAL)
    if has_churn and assigned_to:
        flags.append("CHURN_SIGNAL")
        score += 35

    # Rule 4: MID_NO_REPLY_2H — MID client, no first reply, open > 2h
    if segment == "MID" and last_reply_by is None and age_h > 2:
        flags.append("MID_NO_REPLY_2H")
        score += 30

    # Rule 5: MULTIPLE_OPEN — customer has 3+ other open tickets
    if int(prev_open) >= 3:
        flags.append("MULTIPLE_OPEN")
        score += 15

    # Rule 6: STALE_IN_PROGRESS — IN_PROGRESS with no activity for 72h
    if status == "IN_PROGRESS" and last_reply_at is not None:
        if _age_hours(last_reply_at) > 72:
            flags.append("STALE_IN_PROGRESS")
            score += 15

    capped = min(score, 100)
    priority = "URGENT" if capped >= 70 else "HIGH" if capped >= 40 else "MEDIUM" if capped >= 10 else "LOW"
    return flags, capped, priority
```

- [ ] **Step 4: Run tests — confirm all pass**

```powershell
pytest tests/test_triage_rules.py -v
```

Expected: all 14 tests PASS.

- [ ] **Step 5: Commit**

```powershell
git add backend/services/triage_rules.py backend/tests/test_triage_rules.py
git commit -m "feat: rewrite triage rules — 6 new rules, auto-calculated priority"
```

---

## Task 2: Update import_csv.py to write priority

**Files:**
- Modify: `backend/scripts/import_csv.py` (line 60)

- [ ] **Step 1: Update the tuple unpack and add priority to DB row**

Find this block in `import_csv.py` (currently around line 60):

```python
            flags, score = calculate_triage_flags(ticket)
            ticket["triage_flags"] = flags
            ticket["risk_score"] = score
```

Replace it with:

```python
            flags, score, priority = calculate_triage_flags(ticket)
            ticket["triage_flags"] = flags
            ticket["risk_score"] = score
            ticket["priority"] = priority
```

- [ ] **Step 2: Re-run the import to recalculate all 8,000 tickets**

```powershell
cd backend
python scripts/import_csv.py
```

Expected output ends with: `Import complete. Total: 8000 tickets.`

This overwrites `triage_flags`, `risk_score`, and `priority` for every ticket. It is idempotent — safe to run multiple times.

- [ ] **Step 3: Commit**

```powershell
git add backend/scripts/import_csv.py
git commit -m "feat: import script writes system-calculated priority to DB"
```

---

## Task 3: Add backend stats endpoints

**Files:**
- Modify: `backend/routers/tickets.py`

These two endpoints must be placed **before** the `@router.get("/{ticket_id}")` route to avoid FastAPI matching `"stats"` as a ticket ID.

- [ ] **Step 1: Add imports at the top of tickets.py**

`tickets.py` currently does not import `datetime` or `defaultdict`. Add them after the existing imports:

```python
from datetime import datetime
from collections import defaultdict
```

- [ ] **Step 2: Add GET /tickets/stats/weekly**

Insert this route after the existing `GET /agents` route and before `GET /{ticket_id}`:

```python
@router.get("/stats/weekly")
def get_weekly_stats():
    db = get_db()
    result = db.table("tickets").select("created_at,risk_score").execute()

    week_data: dict[str, dict] = defaultdict(lambda: {"total": 0, "urgent": 0})
    for row in result.data:
        if not row.get("created_at"):
            continue
        try:
            dt = datetime.fromisoformat(row["created_at"].replace("Z", "+00:00"))
        except ValueError:
            continue
        week = dt.strftime("%G-W%V")
        week_data[week]["total"] += 1
        if (row.get("risk_score") or 0) >= 70:
            week_data[week]["urgent"] += 1

    return [
        {"week": w, "total": d["total"], "urgent": d["urgent"]}
        for w, d in sorted(week_data.items())
    ]
```

- [ ] **Step 3: Add GET /tickets/stats/agents**

Insert this route immediately after the weekly stats route:

```python
@router.get("/stats/agents")
def get_agent_stats():
    db = get_db()
    result = (
        db.table("tickets")
        .select("assigned_to,priority,status")
        .neq("assigned_to", None)
        .execute()
    )

    rows = [
        r for r in result.data
        if r.get("status") not in ("CLOSED", "RESOLVED")
    ]

    agent_data: dict[str, dict] = defaultdict(
        lambda: {"urgent": 0, "high": 0, "medium": 0, "low": 0, "total": 0}
    )
    for row in rows:
        agent = row.get("assigned_to")
        if not agent:
            continue
        p = (row.get("priority") or "LOW").lower()
        if p not in ("urgent", "high", "medium", "low"):
            p = "low"
        agent_data[agent][p] += 1
        agent_data[agent]["total"] += 1

    return [
        {"agent": a, **d}
        for a, d in sorted(agent_data.items(), key=lambda x: -x[1]["total"])
    ]
```

- [ ] **Step 4: Verify endpoints via FastAPI docs**

Start the backend (if not running):
```powershell
cd backend
uvicorn main:app --reload --port 8000
```

Open `http://localhost:8000/docs`. You should see:
- `GET /tickets/stats/weekly`
- `GET /tickets/stats/agents`

Try `GET /tickets/stats/agents` — expect a JSON array like:
```json
[{"agent": "Ana Souza", "urgent": 2, "high": 5, "medium": 8, "low": 1, "total": 16}, ...]
```

- [ ] **Step 5: Commit**

```powershell
git add backend/routers/tickets.py
git commit -m "feat: add /tickets/stats/weekly and /tickets/stats/agents endpoints"
```

---

## Task 4: Update TypeScript types and TriageBadge

**Files:**
- Modify: `frontend/types/index.ts` (line 5)
- Modify: `frontend/components/TriageBadge.tsx`

- [ ] **Step 1: Update TriageFlag type in types/index.ts**

Find line 5:
```typescript
export type TriageFlag = 'SLA_BREACH' | 'CHURN_SIGNAL' | 'URGENT_UNATTENDED' | 'MULTIPLE_OPEN' | 'STALE_IN_PROGRESS'
```

Replace with:
```typescript
export type TriageFlag =
  | 'CHURN_UNASSIGNED'
  | 'ENT_NO_REPLY_2H'
  | 'CHURN_SIGNAL'
  | 'MID_NO_REPLY_2H'
  | 'MULTIPLE_OPEN'
  | 'STALE_IN_PROGRESS'
```

- [ ] **Step 2: Rewrite TriageBadge.tsx**

Overwrite the entire file:

```tsx
// frontend/components/TriageBadge.tsx
import { TriageFlag } from '@/types'

const FLAG_CONFIG: Record<TriageFlag, { label: string; color: string }> = {
  CHURN_UNASSIGNED: { label: 'Churn s/ agente', color: 'bg-red-500/15 text-red-400 border border-red-500/20' },
  ENT_NO_REPLY_2H:  { label: 'ENT sem reply',   color: 'bg-orange-500/15 text-orange-400 border border-orange-500/20' },
  CHURN_SIGNAL:     { label: 'Churn',            color: 'bg-pink-500/15 text-pink-400 border border-pink-500/20' },
  MID_NO_REPLY_2H:  { label: 'MID sem reply',    color: 'bg-blue-500/15 text-blue-400 border border-blue-500/20' },
  MULTIPLE_OPEN:    { label: '3+ tickets',        color: 'bg-violet-500/15 text-violet-400 border border-violet-500/20' },
  STALE_IN_PROGRESS:{ label: 'Parado',            color: 'bg-brand-mid text-brand-muted border border-brand-border' },
}

export function TriageBadge({ flag }: { flag: TriageFlag }) {
  const config = FLAG_CONFIG[flag]
  if (!config) return null
  return (
    <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded ${config.color}`}>
      {config.label}
    </span>
  )
}
```

- [ ] **Step 3: Confirm TypeScript compiles**

```powershell
cd frontend
$env:PATH = "C:\Program Files\nodejs;$env:PATH"
npx next build 2>&1 | Select-String -Pattern "error|Error" | Select-Object -First 20
```

Expected: no TypeScript errors related to TriageFlag.

- [ ] **Step 4: Commit**

```powershell
git add frontend/types/index.ts frontend/components/TriageBadge.tsx
git commit -m "feat: update TriageFlag type and TriageBadge for new scoring rules"
```

---

## Task 5: Update KanbanCard priority borders and badges

**Files:**
- Modify: `frontend/components/KanbanCard.tsx`

- [ ] **Step 1: Update cardBorderClass to use priority field**

Find the `cardBorderClass` function (lines 21-28) and replace it:

```typescript
function cardBorderClass(ticket: Ticket): string {
  const unassigned = !ticket.assigned_to
  if (ticket.priority === 'URGENT') {
    return unassigned
      ? 'border-2 border-dashed border-red-500'
      : 'border-2 border-red-500'
  }
  if (ticket.priority === 'HIGH') {
    return unassigned
      ? 'border-2 border-dashed border-orange-500'
      : 'border-2 border-orange-500'
  }
  return unassigned ? 'border border-dashed border-brand-border' : 'border border-brand-border'
}
```

- [ ] **Step 2: Update riskBarColor and riskTextColor to match priority thresholds**

Find `riskBarColor` (lines 30-34) and `riskTextColor` (lines 36-40) and replace both:

```typescript
function riskBarColor(score: number): string {
  if (score >= 70) return 'bg-red-500'
  if (score >= 40) return 'bg-orange-400'
  if (score >= 10) return 'bg-brand-muted'
  return 'bg-[#333333]'
}

function riskTextColor(score: number): string {
  if (score >= 70) return 'text-red-400'
  if (score >= 40) return 'text-orange-400'
  if (score >= 10) return 'text-brand-muted'
  return 'text-[#555555]'
}
```

- [ ] **Step 3: Update Row 1 priority badges (remove emoji, add HIGH orange)**

Find the priority badge section in the JSX (lines 76-85):

```tsx
        {ticket.priority && ticket.priority !== 'URGENT' && (
          <span className="text-[9px] px-1.5 py-0.5 rounded bg-brand-mid text-brand-muted">{ticket.priority}</span>
        )}
        {ticket.priority === 'URGENT' && (
          <span className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-red-500/15 text-red-400">URGENT 🔥</span>
        )}
```

Replace with:

```tsx
        {ticket.priority === 'URGENT' && (
          <span className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-red-500/15 text-red-400">URGENT</span>
        )}
        {ticket.priority === 'HIGH' && (
          <span className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-orange-500/15 text-orange-400">HIGH</span>
        )}
        {ticket.priority === 'MEDIUM' && (
          <span className="text-[9px] px-1.5 py-0.5 rounded bg-brand-mid text-brand-muted">MEDIUM</span>
        )}
        {ticket.priority === 'LOW' && (
          <span className="text-[9px] px-1.5 py-0.5 rounded bg-brand-mid text-[#555555]">LOW</span>
        )}
```

- [ ] **Step 4: Commit**

```powershell
git add frontend/components/KanbanCard.tsx
git commit -m "feat: KanbanCard priority-based border colors and badges"
```

---

## Task 6: Add api.ts functions for stats endpoints

**Files:**
- Modify: `frontend/lib/api.ts`

- [ ] **Step 1: Add WeeklyStat and AgentStat interfaces**

Add after the existing `AgentHistoryEntry` interface at the bottom of `api.ts`:

```typescript
export interface WeeklyStat {
  week: string
  total: number
  urgent: number
}

export interface AgentStat {
  agent: string
  urgent: number
  high: number
  medium: number
  low: number
  total: number
}
```

- [ ] **Step 2: Add getWeeklyStats and getAgentStats functions**

Add these after `mergeTickets`:

```typescript
export function getWeeklyStats(): Promise<WeeklyStat[]> {
  return req<WeeklyStat[]>('/tickets/stats/weekly')
}

export function getAgentStats(): Promise<AgentStat[]> {
  return req<AgentStat[]>('/tickets/stats/agents')
}
```

- [ ] **Step 3: Commit**

```powershell
git add frontend/lib/api.ts
git commit -m "feat: add getWeeklyStats and getAgentStats to api.ts"
```

---

## Task 7: Build AlertPanel component

**Files:**
- Create: `frontend/components/AlertPanel.tsx`

- [ ] **Step 1: Create the file**

Create `frontend/components/AlertPanel.tsx` with this full content:

```tsx
'use client'

import { useState, useEffect } from 'react'
import { Ticket } from '@/types'
import { getTickets, getWeeklyStats, getAgentStats } from '@/lib/api'
import type { WeeklyStat, AgentStat } from '@/lib/api'

interface AlertPanelProps {
  onTicketClick: (ticket: Ticket) => void
}

type Tab = 'alerts' | 'agents' | 'trends'

function timeAgo(dateStr: string | null): string {
  if (!dateStr) return '—'
  const diff = (Date.now() - new Date(dateStr).getTime()) / 1000
  if (diff < 3600) return `${Math.floor(diff / 60)}m`
  if (diff < 86400) return `${Math.floor(diff / 3600)}h`
  return `${Math.floor(diff / 86400)}d`
}

function flagLabel(flags: string[]): string {
  if (flags.includes('CHURN_UNASSIGNED')) return 'CHURN · SEM AGENTE'
  if (flags.includes('ENT_NO_REPLY_2H')) return 'ENT · SEM REPLY'
  if (flags.includes('CHURN_SIGNAL')) return 'CHURN · COM AGENTE'
  if (flags.includes('MID_NO_REPLY_2H')) return 'MID · SEM REPLY'
  if (flags.includes('MULTIPLE_OPEN')) return 'MÚLTIPLOS ABERTOS'
  if (flags.includes('STALE_IN_PROGRESS')) return 'PARADO'
  return 'RISCO ALTO'
}

function TrendsChart({ stats }: { stats: WeeklyStat[] }) {
  if (stats.length === 0) return <p className="text-xs text-brand-muted text-center py-4">Sem dados</p>

  const maxTotal = Math.max(...stats.map(s => s.total), 1)
  const chartH = 72
  const totalWidth = 272
  const barW = Math.max(4, Math.floor((totalWidth - stats.length * 2) / stats.length))
  const gap = 2

  const thisWeek = stats[stats.length - 1]
  const lastWeek = stats[stats.length - 2]
  const weekChange = lastWeek && lastWeek.total > 0
    ? Math.round(((thisWeek?.total ?? 0) - lastWeek.total) / lastWeek.total * 100)
    : 0
  const peakTotal = Math.max(...stats.map(s => s.total))

  return (
    <div>
      <svg
        width="100%"
        height={chartH}
        viewBox={`0 0 ${stats.length * (barW + gap)} ${chartH}`}
        preserveAspectRatio="none"
      >
        {stats.map((s, i) => {
          const h = Math.max(2, Math.round((s.total / maxTotal) * (chartH - 4)))
          return (
            <rect
              key={s.week}
              x={i * (barW + gap)}
              y={chartH - h}
              width={barW}
              height={h}
              fill="#C8FF0050"
              rx={1}
            />
          )
        })}
      </svg>
      <div className="flex justify-between text-[8px] text-brand-muted mt-1 mb-3">
        <span>{stats[0]?.week}</span>
        <span>{stats[stats.length - 1]?.week}</span>
      </div>
      <div className="grid grid-cols-3 gap-1 text-center">
        <div>
          <p className="text-brand-green text-sm font-bold">{peakTotal}</p>
          <p className="text-[9px] text-brand-muted">pico/semana</p>
        </div>
        <div>
          <p className={`text-sm font-bold ${weekChange > 0 ? 'text-brand-error' : 'text-brand-success'}`}>
            {weekChange > 0 ? '+' : ''}{weekChange}%
          </p>
          <p className="text-[9px] text-brand-muted">vs anterior</p>
        </div>
        <div>
          <p className="text-brand-error text-sm font-bold">{thisWeek?.urgent ?? 0}</p>
          <p className="text-[9px] text-brand-muted">URGENT/sem.</p>
        </div>
      </div>
    </div>
  )
}

export function AlertPanel({ onTicketClick }: AlertPanelProps) {
  const [tab, setTab] = useState<Tab>('alerts')
  const [urgentTickets, setUrgentTickets] = useState<Ticket[]>([])
  const [agentStats, setAgentStats] = useState<AgentStat[]>([])
  const [weeklyStats, setWeeklyStats] = useState<WeeklyStat[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let cancelled = false
    async function load() {
      setLoading(true)
      const [tickets, agents, weekly] = await Promise.all([
        getTickets({ sort_by: 'risk_score', sort_desc: true, limit: 100 }),
        getAgentStats(),
        getWeeklyStats(),
      ])
      if (cancelled) return
      setUrgentTickets(
        tickets.filter(t => t.risk_score >= 70 && t.status !== 'CLOSED' && t.status !== 'RESOLVED')
      )
      setAgentStats(agents)
      setWeeklyStats(weekly)
      setLoading(false)
    }
    load()
    return () => { cancelled = true }
  }, [])

  const tabClass = (t: Tab) =>
    `flex-1 py-2 text-[10px] font-bold text-center cursor-pointer transition-colors ${
      tab === t
        ? 'border-b-2 border-brand-green text-brand-green'
        : 'text-brand-muted hover:text-white border-b border-brand-border'
    }`

  return (
    <div className="flex flex-col h-full bg-brand-black">
      {/* Tab bar */}
      <div className="flex shrink-0">
        <button className={tabClass('alerts')} onClick={() => setTab('alerts')}>
          ⚡ Alertas{urgentTickets.length > 0 ? ` ${urgentTickets.length}` : ''}
        </button>
        <button className={tabClass('agents')} onClick={() => setTab('agents')}>
          Agentes
        </button>
        <button className={tabClass('trends')} onClick={() => setTab('trends')}>
          Tendências
        </button>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto">
        {loading ? (
          <p className="text-xs text-brand-muted text-center py-6">Carregando...</p>
        ) : (
          <>
            {/* Tab: Alertas */}
            {tab === 'alerts' && (
              <div className="flex flex-col gap-2 p-3">
                {urgentTickets.length === 0 ? (
                  <div className="flex flex-col items-center py-8 gap-2">
                    <span className="text-brand-green text-2xl">✓</span>
                    <p className="text-xs text-brand-muted text-center">Nenhum ticket crítico no momento</p>
                  </div>
                ) : (
                  urgentTickets.map(t => (
                    <button
                      key={t.ticket_id}
                      onClick={() => onTicketClick(t)}
                      className={`w-full text-left rounded-lg p-3 cursor-pointer transition-colors hover:brightness-110 ${
                        t.risk_score >= 80
                          ? 'bg-red-500/10 border border-red-500'
                          : 'bg-red-500/8 border border-dashed border-red-500/60'
                      }`}
                    >
                      <div className="flex justify-between items-start mb-1">
                        <span className="text-[9px] font-bold text-red-400 uppercase tracking-wide">
                          {flagLabel(t.triage_flags)}
                        </span>
                        <span className="text-[10px] font-bold text-red-400">{t.risk_score}</span>
                      </div>
                      <p className="text-[11px] text-white line-clamp-1 mb-1">{t.subject}</p>
                      <div className="flex justify-between">
                        <span className="text-[9px] text-brand-muted">
                          {t.customer_segment} · #{t.ticket_id.slice(-5)}
                        </span>
                        <span className="text-[9px] text-red-400">
                          {timeAgo(t.created_at)}
                        </span>
                      </div>
                    </button>
                  ))
                )}
              </div>
            )}

            {/* Tab: Agentes */}
            {tab === 'agents' && (
              <div className="p-3">
                <p className="text-[9px] text-brand-muted uppercase tracking-wider mb-3">
                  Tickets abertos por agente
                </p>
                {agentStats.length === 0 ? (
                  <p className="text-xs text-brand-muted text-center py-4">Sem dados</p>
                ) : (
                  <table className="w-full text-[10px]">
                    <thead>
                      <tr className="text-brand-muted text-[9px] uppercase">
                        <th className="text-left pb-2 font-semibold">Agente</th>
                        <th className="text-center pb-2 font-semibold text-red-400">URG</th>
                        <th className="text-center pb-2 font-semibold text-orange-400">HI</th>
                        <th className="text-center pb-2 font-semibold text-brand-muted">MED</th>
                        <th className="text-right pb-2 font-semibold text-white">Tot</th>
                      </tr>
                    </thead>
                    <tbody>
                      {agentStats.map(a => {
                        const overloaded = a.total >= 15 || a.urgent >= 3
                        return (
                          <tr
                            key={a.agent}
                            className={`border-t border-brand-border ${overloaded ? 'bg-red-500/5' : ''}`}
                          >
                            <td className="py-1.5 text-brand-muted truncate max-w-[80px]">
                              {a.agent.split(' ')[0]}
                            </td>
                            <td className={`py-1.5 text-center ${a.urgent > 0 ? 'text-red-400 font-bold' : 'text-brand-border'}`}>
                              {a.urgent || '—'}
                            </td>
                            <td className={`py-1.5 text-center ${a.high > 0 ? 'text-orange-400' : 'text-brand-border'}`}>
                              {a.high || '—'}
                            </td>
                            <td className="py-1.5 text-center text-brand-muted">{a.medium || '—'}</td>
                            <td className={`py-1.5 text-right font-bold ${overloaded ? 'text-red-400' : 'text-white'}`}>
                              {a.total}{overloaded ? ' ⚠' : ''}
                            </td>
                          </tr>
                        )
                      })}
                    </tbody>
                  </table>
                )}
              </div>
            )}

            {/* Tab: Tendências */}
            {tab === 'trends' && (
              <div className="p-3">
                <p className="text-[9px] text-brand-muted uppercase tracking-wider mb-3">
                  Volume semanal — Jan a Mar 2026
                </p>
                <TrendsChart stats={weeklyStats} />
              </div>
            )}
          </>
        )}
      </div>
    </div>
  )
}
```

- [ ] **Step 2: Commit**

```powershell
git add frontend/components/AlertPanel.tsx
git commit -m "feat: add AlertPanel component with alerts, agents, and trends tabs"
```

---

## Task 8: Update KanbanBoard layout to 70/30 split

**Files:**
- Modify: `frontend/components/KanbanBoard.tsx`

- [ ] **Step 1: Add AlertPanel import**

At the top of `KanbanBoard.tsx`, add the import after the existing component imports:

```tsx
import { AlertPanel } from './AlertPanel'
```

- [ ] **Step 2: Replace the DndContext block with the 70/30 layout**

Find the existing `DndContext` block and the closing of the main content div (approximately lines 278–303 in the original file):

```tsx
      <DndContext
        sensors={sensors}
        collisionDetection={closestCenter}
        onDragStart={handleDragStart}
        onDragEnd={handleDragEnd}
      >
        <div className="flex gap-3 overflow-x-auto flex-1 px-5 py-4">
          {COLUMNS.filter(col => visibleStatuses.has(col.status)).map(col => (
            <KanbanColumn
              key={col.status}
              status={col.status}
              label={col.label}
              tickets={columns[col.status] ?? []}
              onCardClick={setSelectedTicket}
            />
          ))}
        </div>

        <DragOverlay>
          {draggingTicket && (
            <div className="rotate-1 opacity-80 scale-105">
              <KanbanCard ticket={draggingTicket} onClick={() => {}} />
            </div>
          )}
        </DragOverlay>
      </DndContext>
```

Replace with:

```tsx
      <div className="flex flex-1 overflow-hidden">
        <DndContext
          sensors={sensors}
          collisionDetection={closestCenter}
          onDragStart={handleDragStart}
          onDragEnd={handleDragEnd}
        >
          <div className="flex gap-3 overflow-x-auto flex-1 px-5 py-4">
            {COLUMNS.filter(col => visibleStatuses.has(col.status)).map(col => (
              <KanbanColumn
                key={col.status}
                status={col.status}
                label={col.label}
                tickets={columns[col.status] ?? []}
                onCardClick={setSelectedTicket}
              />
            ))}
          </div>

          <DragOverlay>
            {draggingTicket && (
              <div className="rotate-1 opacity-80 scale-105">
                <KanbanCard ticket={draggingTicket} onClick={() => {}} />
              </div>
            )}
          </DragOverlay>
        </DndContext>

        {/* Alert panel — fixed 320px sidebar */}
        {/* TODO: collapse to bottom tab bar on screens < 1200px */}
        <div className="w-80 shrink-0 border-l border-brand-border flex flex-col overflow-hidden">
          <AlertPanel onTicketClick={setSelectedTicket} />
        </div>
      </div>
```

- [ ] **Step 3: Run the dev server and verify visually**

```powershell
cd frontend
$env:PATH = "C:\Program Files\nodejs;$env:PATH"
npm run dev
```

Open `http://localhost:3000`. Verify:
1. The kanban takes ~70% of the screen width
2. A right panel appears with three tabs: ⚡ Alertas, Agentes, Tendências
3. Alertas tab shows tickets with score ≥ 70 (after re-import these should exist)
4. Clicking an alert item opens the ticket side panel
5. Agentes tab shows a workload table
6. Tendências tab shows a bar chart

- [ ] **Step 4: Build to confirm no TypeScript errors**

```powershell
npx next build 2>&1 | Select-String -Pattern "error TS|Error:" | Select-Object -First 20
```

Expected: zero TypeScript errors.

- [ ] **Step 5: Commit**

```powershell
git add frontend/components/KanbanBoard.tsx
git commit -m "feat: KanbanBoard 70/30 layout with AlertPanel sidebar"
```
