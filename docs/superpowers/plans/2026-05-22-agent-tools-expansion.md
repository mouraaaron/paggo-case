# Agent Tools Expansion Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Expand the AI agent with three missing capabilities required by the spec: richer `list_tickets` filters, `close_ticket` and `merge_tickets` write tools, and a `draft_reply` tool that generates personalized replies for review before sending.

**Architecture:** All changes are confined to `backend/services/ai_agent.py`. The backend REST endpoints for close and merge already exist (`POST /{ticket_id}/close`, `POST /merge`); the agent just needs tools wired to them via `_execute_tool`. `draft_reply` is special: it generates a GPT draft _before_ showing the pending_action, so the user sees the full draft for review rather than a raw tool-call preview. On confirmation, it calls `POST /{ticket_id}/reply` with `source="AGENT"`.

**Tech Stack:** Python 3.13, OpenAI `gpt-4o-mini`, Supabase Python SDK, pytest + unittest.mock

---

## File Structure

| File | Change |
|---|---|
| `backend/services/ai_agent.py` | Modify: expand `list_tickets` tool, add `close_ticket` + `merge_tickets` + `draft_reply` tools, update `_execute_tool` and `run_agent` |
| `backend/tests/test_agent_tools.py` | Create: unit tests for the four modified/new tool executions |

---

### Task 1: Expand `list_tickets` agent tool

**Files:**
- Modify: `backend/services/ai_agent.py`
- Create: `backend/tests/test_agent_tools.py`

The backend `GET /tickets` already supports `assigned_to`, `category`, `created_after`, `created_before`, `sort_by`, `sort_desc`, `has_flag` — the agent tool just exposes `status`, `priority`, `customer_segment`, `limit`. This task exposes the full filter set so queries like "10 ENT tickets sem resposta mais antigos" work.

- [ ] **Step 1: Write the failing test**

Create `backend/tests/test_agent_tools.py`:

```python
import sys, os
sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))

from unittest.mock import MagicMock, patch
import services.ai_agent as agent_module


def _make_db(rows):
    """Return a db mock whose execute().data == rows. Supports full query chain."""
    q = MagicMock()
    for m in ("select", "eq", "neq", "gte", "lte", "order", "limit", "range",
              "update", "insert", "single", "contains"):
        getattr(q, m).return_value = q
    result = MagicMock()
    result.data = rows
    q.execute.return_value = result
    db = MagicMock()
    db.table.return_value = q
    return db, q


# ── list_tickets ──────────────────────────────────────────────────────────────

def test_list_tickets_passes_all_filters(monkeypatch):
    db, q = _make_db([{"ticket_id": "T1", "subject": "hi"}])
    monkeypatch.setattr(agent_module, "get_db", lambda: db)

    result = agent_module._execute_tool("list_tickets", {
        "status": "NEW",
        "priority": "HIGH",
        "customer_segment": "ENT",
        "assigned_to": "alice",
        "category": "CHURN_SIGNAL",
        "no_reply": True,
        "created_after": "2026-01-01",
        "created_before": "2026-03-31",
        "sort_by": "created_at",
        "sort_desc": False,
        "limit": 5,
    })
    import json
    data = json.loads(result)
    assert isinstance(data, list)
    # Verify key filters were applied on the query chain
    q.eq.assert_any_call("status", "NEW")
    q.eq.assert_any_call("customer_segment", "ENT")
    q.eq.assert_any_call("assigned_to", "alice")
    q.eq.assert_any_call("category", "CHURN_SIGNAL")
    q.is_.assert_called_with("last_reply_at", "null")


def test_list_tickets_no_reply_false_skips_filter(monkeypatch):
    db, q = _make_db([])
    monkeypatch.setattr(agent_module, "get_db", lambda: db)

    agent_module._execute_tool("list_tickets", {"no_reply": False})
    # is_ should NOT have been called
    q.is_.assert_not_called()
```

- [ ] **Step 2: Run to verify it fails**

```powershell
cd C:\Users\aaron\paggo-case\backend
venv\Scripts\python.exe -m pytest tests/test_agent_tools.py -v 2>&1 | Select-Object -Last 15
```

Expected: `AttributeError` or `AssertionError` — `q.is_` not called because the tool doesn't support those params yet.

- [ ] **Step 3: Expand the `list_tickets` tool definition in `ai_agent.py`**

Replace the existing `list_tickets` entry in `TOOLS` (lines 30–44) with:

```python
    {
        "type": "function",
        "function": {
            "name": "list_tickets",
            "description": (
                "List tickets with optional filters. Use no_reply=true to find tickets "
                "with no agent response yet. Use sort_by='created_at' + sort_desc=false "
                "to get oldest first."
            ),
            "parameters": {
                "type": "object",
                "properties": {
                    "status":           {"type": "string", "description": "e.g. NEW, IN_PROGRESS, ESCALATED"},
                    "priority":         {"type": "string", "description": "LOW, MEDIUM, HIGH, URGENT"},
                    "customer_segment": {"type": "string", "description": "SMB, MID, ENT"},
                    "assigned_to":      {"type": "string", "description": "agent name, or 'unassigned' to filter unassigned"},
                    "category":         {"type": "string", "description": "BILLING, BUG, FEATURE_REQUEST, HOW_TO, CHURN_SIGNAL, OTHER"},
                    "no_reply":         {"type": "boolean", "description": "If true, return only tickets with no reply yet (last_reply_at IS NULL)"},
                    "created_after":    {"type": "string", "description": "ISO date string, e.g. 2026-01-15"},
                    "created_before":   {"type": "string", "description": "ISO date string, e.g. 2026-03-31"},
                    "sort_by":          {"type": "string", "description": "Field to sort by: risk_score (default), created_at, last_reply_at"},
                    "sort_desc":        {"type": "boolean", "description": "Sort descending (default true). Pass false for oldest-first."},
                    "limit":            {"type": "integer", "description": "Max results, default 10, max 50"}
                }
            }
        }
    },
```

- [ ] **Step 4: Update the `list_tickets` branch in `_execute_tool`**

Replace the `elif name == "list_tickets":` block (lines 103–113) with:

```python
        elif name == "list_tickets":
            query = db.table("tickets").select(
                "ticket_id,subject,status,priority,customer_name,customer_segment,"
                "assigned_to,category,risk_score,created_at,last_reply_at,triage_flags"
            )
            if args.get("status"):
                query = query.eq("status", args["status"])
            if args.get("priority"):
                query = query.eq("priority", args["priority"])
            if args.get("customer_segment"):
                query = query.eq("customer_segment", args["customer_segment"])
            if args.get("assigned_to"):
                if args["assigned_to"] == "unassigned":
                    query = query.is_("assigned_to", "null")
                else:
                    query = query.eq("assigned_to", args["assigned_to"])
            if args.get("category"):
                query = query.eq("category", args["category"])
            if args.get("no_reply"):
                query = query.is_("last_reply_at", "null")
            if args.get("created_after"):
                query = query.gte("created_at", args["created_after"])
            if args.get("created_before"):
                query = query.lte("created_at", f"{args['created_before']}T23:59:59.999999")
            sort_field = args.get("sort_by", "risk_score")
            sort_desc = args.get("sort_desc", True)
            limit = min(int(args.get("limit", 10)), 50)
            query = query.order(sort_field, desc=sort_desc).limit(limit)
            result = query.execute()
            return json.dumps(result.data)
```

- [ ] **Step 5: Run tests to verify they pass**

```powershell
venv\Scripts\python.exe -m pytest tests/test_agent_tools.py -v 2>&1 | Select-Object -Last 15
```

Expected: `2 passed`.

- [ ] **Step 6: Run full suite**

```powershell
venv\Scripts\python.exe -m pytest -q 2>&1 | Select-Object -Last 5
```

Expected: all passing.

- [ ] **Step 7: Commit**

```bash
git add backend/services/ai_agent.py backend/tests/test_agent_tools.py
git commit -m "feat: expand list_tickets agent tool with full filter set"
```

---

### Task 2: Add `close_ticket` and `merge_tickets` tools

**Files:**
- Modify: `backend/services/ai_agent.py`
- Modify: `backend/tests/test_agent_tools.py`

Backend endpoints already exist. This task wires them into the agent. Both are WRITE_TOOLS (require confirmation before commit).

- [ ] **Step 1: Write failing tests**

Append to `backend/tests/test_agent_tools.py`:

```python
# ── close_ticket ──────────────────────────────────────────────────────────────

def test_close_ticket_executes_and_logs(monkeypatch):
    ticket_row = {
        "ticket_id": "T1", "status": "RESOLVED", "customer_id": "C1",
        "customer_name": "Acme", "customer_segment": "ENT", "plan": "ENTERPRISE",
        "channel": "EMAIL", "subject": "bug", "body_preview": "...",
        "created_at": "2026-01-01T00:00:00", "last_reply_at": None,
        "last_reply_by": None, "reply_count": 0, "priority": "HIGH",
        "assigned_to": "alice", "category": "BUG",
        "previous_open_tickets_for_customer": 0, "triage_flags": [],
        "risk_score": 50, "close_reason": None, "merged_into": None, "is_faq": False,
    }
    db, q = _make_db(ticket_row)
    # single() returns the ticket row; update + second select also return it
    q.single.return_value = q
    monkeypatch.setattr(agent_module, "get_db", lambda: db)

    result = agent_module._execute_tool("close_ticket", {
        "ticket_id": "T1",
        "close_reason": "RESOLVED_FIXED",
    })
    import json
    data = json.loads(result)
    assert data.get("success") is True
    # audit log insert was called
    q.insert.assert_called()


def test_close_ticket_rejects_invalid_transition(monkeypatch):
    # NEW cannot transition to CLOSED
    db, q = _make_db({"status": "NEW"})
    q.single.return_value = q
    monkeypatch.setattr(agent_module, "get_db", lambda: db)

    result = agent_module._execute_tool("close_ticket", {
        "ticket_id": "T1",
        "close_reason": "RESOLVED_FIXED",
    })
    import json
    data = json.loads(result)
    assert "error" in data


def test_close_ticket_rejects_invalid_reason(monkeypatch):
    db, q = _make_db({"status": "RESOLVED"})
    q.single.return_value = q
    monkeypatch.setattr(agent_module, "get_db", lambda: db)

    result = agent_module._execute_tool("close_ticket", {
        "ticket_id": "T1",
        "close_reason": "INVALID_REASON",
    })
    import json
    data = json.loads(result)
    assert "error" in data


# ── merge_tickets ─────────────────────────────────────────────────────────────

def test_merge_tickets_executes_and_logs(monkeypatch):
    primary = {"ticket_id": "T1", "customer_id": "C1"}
    secondary = {"ticket_id": "T2", "customer_id": "C1"}

    call_count = [0]
    def fake_execute():
        r = MagicMock()
        if call_count[0] == 0:
            r.data = [primary]
        elif call_count[0] == 1:
            r.data = [secondary]
        else:
            r.data = [primary]
        call_count[0] += 1
        return r

    q = MagicMock()
    for m in ("select", "eq", "neq", "gte", "lte", "order", "limit", "range",
              "update", "insert", "single", "contains"):
        getattr(q, m).return_value = q
    q.execute.side_effect = fake_execute
    db = MagicMock()
    db.table.return_value = q
    monkeypatch.setattr(agent_module, "get_db", lambda: db)

    result = agent_module._execute_tool("merge_tickets", {
        "primary_ticket_id": "T1",
        "secondary_ticket_id": "T2",
    })
    import json
    data = json.loads(result)
    assert data.get("success") is True


def test_merge_tickets_rejects_different_customers(monkeypatch):
    primary = {"ticket_id": "T1", "customer_id": "C1"}
    secondary = {"ticket_id": "T2", "customer_id": "C2"}  # different customer

    call_count = [0]
    def fake_execute():
        r = MagicMock()
        r.data = [primary] if call_count[0] == 0 else [secondary]
        call_count[0] += 1
        return r

    q = MagicMock()
    for m in ("select", "eq", "neq", "gte", "lte", "order", "limit", "range",
              "update", "insert", "single", "contains"):
        getattr(q, m).return_value = q
    q.execute.side_effect = fake_execute
    db = MagicMock()
    db.table.return_value = q
    monkeypatch.setattr(agent_module, "get_db", lambda: db)

    result = agent_module._execute_tool("merge_tickets", {
        "primary_ticket_id": "T1",
        "secondary_ticket_id": "T2",
    })
    import json
    data = json.loads(result)
    assert "error" in data
```

- [ ] **Step 2: Run to verify tests fail**

```powershell
venv\Scripts\python.exe -m pytest tests/test_agent_tools.py::test_close_ticket_executes_and_logs tests/test_agent_tools.py::test_merge_tickets_executes_and_logs -v 2>&1 | Select-Object -Last 10
```

Expected: FAIL — `_execute_tool("close_ticket", ...)` returns `{"error": "unknown tool"}`.

- [ ] **Step 3: Add `close_ticket` and `merge_tickets` to `TOOLS` in `ai_agent.py`**

After the `classify_ticket` tool definition (before the closing `]` of TOOLS), add:

```python
    {
        "type": "function",
        "function": {
            "name": "close_ticket",
            "description": "Close a ticket with a required close reason. Valid reasons: RESOLVED_FIXED, RESOLVED_INFO, DUPLICATE, NOT_REPRODUCIBLE, WONT_FIX, CUSTOMER_NO_RESPONSE. Ticket must be in RESOLVED status to close.",
            "parameters": {
                "type": "object",
                "properties": {
                    "ticket_id":    {"type": "string"},
                    "close_reason": {
                        "type": "string",
                        "enum": ["RESOLVED_FIXED", "RESOLVED_INFO", "DUPLICATE",
                                 "NOT_REPRODUCIBLE", "WONT_FIX", "CUSTOMER_NO_RESPONSE"]
                    }
                },
                "required": ["ticket_id", "close_reason"]
            }
        }
    },
    {
        "type": "function",
        "function": {
            "name": "merge_tickets",
            "description": "Merge a duplicate ticket into a primary ticket. Both tickets must belong to the same customer. The secondary ticket is closed as DUPLICATE; its replies are moved to the primary.",
            "parameters": {
                "type": "object",
                "properties": {
                    "primary_ticket_id":   {"type": "string", "description": "The ticket to keep"},
                    "secondary_ticket_id": {"type": "string", "description": "The duplicate ticket to close"}
                },
                "required": ["primary_ticket_id", "secondary_ticket_id"]
            }
        }
    },
```

- [ ] **Step 4: Add `close_ticket` and `merge_tickets` to `WRITE_TOOLS`**

Replace:
```python
WRITE_TOOLS = {"update_ticket_status", "assign_ticket", "classify_ticket"}
```

With:
```python
WRITE_TOOLS = {"update_ticket_status", "assign_ticket", "classify_ticket",
               "close_ticket", "merge_tickets", "draft_reply"}
```

(Adding `draft_reply` now so Task 3 doesn't need to touch this line again.)

- [ ] **Step 5: Add `close_ticket` and `merge_tickets` execution in `_execute_tool`**

Add these two branches before the final `return json.dumps({"error": "unknown tool"})` line:

```python
        elif name == "close_ticket":
            VALID_REASONS = {
                "RESOLVED_FIXED", "RESOLVED_INFO", "DUPLICATE",
                "NOT_REPRODUCIBLE", "WONT_FIX", "CUSTOMER_NO_RESPONSE"
            }
            if args["close_reason"] not in VALID_REASONS:
                return json.dumps({"error": f"Invalid close_reason '{args['close_reason']}'. Must be one of {sorted(VALID_REASONS)}"})
            ticket = db.table("tickets").select("status").eq("ticket_id", args["ticket_id"]).single().execute()
            current = ticket.data["status"]
            ok, msg = can_transition(current, "CLOSED")
            if not ok:
                return json.dumps({"error": msg})
            db.table("tickets").update({
                "status": "CLOSED",
                "close_reason": args["close_reason"],
            }).eq("ticket_id", args["ticket_id"]).execute()
            db.table("audit_log").insert({
                "ticket_id": args["ticket_id"],
                "action": "CLOSED",
                "actor": "AI Agent",
                "source": "AGENT",
                "old_value": current,
                "new_value": "CLOSED",
                "reason": args["close_reason"],
            }).execute()
            return json.dumps({"success": True, "close_reason": args["close_reason"]})

        elif name == "merge_tickets":
            primary = db.table("tickets").select("ticket_id,customer_id").eq("ticket_id", args["primary_ticket_id"]).execute()
            secondary = db.table("tickets").select("ticket_id,customer_id").eq("ticket_id", args["secondary_ticket_id"]).execute()
            if not primary.data or not secondary.data:
                return json.dumps({"error": "One or both tickets not found"})
            if primary.data[0]["customer_id"] != secondary.data[0]["customer_id"]:
                return json.dumps({"error": "Cannot merge tickets from different customers"})
            db.table("ticket_replies").update({"ticket_id": args["primary_ticket_id"]}).eq("ticket_id", args["secondary_ticket_id"]).execute()
            db.table("tickets").update({
                "status": "CLOSED",
                "merged_into": args["primary_ticket_id"],
                "close_reason": "DUPLICATE",
            }).eq("ticket_id", args["secondary_ticket_id"]).execute()
            db.table("audit_log").insert({
                "ticket_id": args["primary_ticket_id"],
                "action": "MERGED",
                "actor": "AI Agent",
                "source": "AGENT",
                "new_value": args["secondary_ticket_id"],
            }).execute()
            db.table("audit_log").insert({
                "ticket_id": args["secondary_ticket_id"],
                "action": "MERGED_INTO",
                "actor": "AI Agent",
                "source": "AGENT",
                "new_value": args["primary_ticket_id"],
            }).execute()
            return json.dumps({"success": True, "primary": args["primary_ticket_id"], "merged": args["secondary_ticket_id"]})
```

- [ ] **Step 6: Run tests**

```powershell
venv\Scripts\python.exe -m pytest tests/test_agent_tools.py -v 2>&1 | Select-Object -Last 15
```

Expected: all 6 tests pass (2 from Task 1 + 4 new).

- [ ] **Step 7: Run full suite**

```powershell
venv\Scripts\python.exe -m pytest -q 2>&1 | Select-Object -Last 5
```

Expected: all passing.

- [ ] **Step 8: Commit**

```bash
git add backend/services/ai_agent.py backend/tests/test_agent_tools.py
git commit -m "feat: add close_ticket and merge_tickets tools to AI agent"
```

---

### Task 3: Add `draft_reply` tool

**Files:**
- Modify: `backend/services/ai_agent.py`
- Modify: `backend/tests/test_agent_tools.py`

`draft_reply` is the most important missing capability. When the agent calls this tool, the system:
1. Fetches the ticket + its replies from the DB
2. Calls GPT-4o-mini to generate a contextual reply (tone adjusted by segment: ENT=formal, MID=professional, SMB=direct)
3. Returns `pending_action` with the **generated draft text** visible in the chat — not just a raw `{"ticket_id": "T1"}` preview
4. On user confirmation, posts the draft to `POST /{ticket_id}/reply` with `source="AGENT"`

The draft generation happens BEFORE the pending_action is returned, so the user sees the full reply before confirming.

- [ ] **Step 1: Write failing tests**

Append to `backend/tests/test_agent_tools.py`:

```python
# ── draft_reply ───────────────────────────────────────────────────────────────

def test_generate_draft_builds_prompt_from_ticket(monkeypatch):
    """_generate_draft returns a non-empty string using ticket context."""
    ticket = {
        "ticket_id": "T1",
        "subject": "Cannot export invoices",
        "body_preview": "I have been trying to export my invoices for three days.",
        "customer_name": "Acme Corp",
        "customer_segment": "ENT",
        "plan": "ENTERPRISE",
        "previous_open_tickets_for_customer": 2,
    }
    replies = [
        {"author": "CUSTOMER", "body": "Still waiting for a response."},
    ]

    fake_completion = MagicMock()
    fake_completion.choices[0].message.content = "Dear Acme Corp, we apologize for the delay."

    with patch("services.ai_agent.client.chat.completions.create", return_value=fake_completion):
        draft = agent_module._generate_draft(ticket, replies)

    assert isinstance(draft, str)
    assert len(draft) > 10


def test_execute_tool_draft_reply_sends_on_confirm(monkeypatch):
    """_execute_tool('draft_reply') posts reply to DB and logs audit event."""
    ticket_row = {
        "ticket_id": "T1", "subject": "bug", "body_preview": "help",
        "customer_name": "Acme", "customer_segment": "SMB", "plan": "STARTER",
        "previous_open_tickets_for_customer": 0,
    }
    replies_rows = []

    call_count = [0]
    def fake_execute():
        r = MagicMock()
        if call_count[0] == 0:
            r.data = ticket_row        # get_ticket
        elif call_count[0] == 1:
            r.data = replies_rows      # get replies
        else:
            r.data = [{"id": "R1", "ticket_id": "T1", "body": "drafted",
                       "author": "AI Agent", "created_at": "2026-01-01T00:00:00",
                       "is_draft": False, "source": "AGENT"}]
        call_count[0] += 1
        return r

    q = MagicMock()
    for m in ("select", "eq", "neq", "gte", "lte", "order", "limit", "range",
              "update", "insert", "single", "contains"):
        getattr(q, m).return_value = q
    q.execute.side_effect = fake_execute
    db = MagicMock()
    db.table.return_value = q
    monkeypatch.setattr(agent_module, "get_db", lambda: db)

    fake_completion = MagicMock()
    fake_completion.choices[0].message.content = "Here is your answer."

    with patch("services.ai_agent.client.chat.completions.create", return_value=fake_completion):
        result = agent_module._execute_tool("draft_reply", {
            "ticket_id": "T1",
            "draft_body": "Here is your answer.",
        })

    import json
    data = json.loads(result)
    assert data.get("success") is True
    assert "draft_body" in data
    # reply was inserted
    q.insert.assert_called()
```

- [ ] **Step 2: Run to verify they fail**

```powershell
venv\Scripts\python.exe -m pytest tests/test_agent_tools.py::test_generate_draft_builds_prompt_from_ticket tests/test_agent_tools.py::test_execute_tool_draft_reply_sends_on_confirm -v 2>&1 | Select-Object -Last 10
```

Expected: `AttributeError: module 'services.ai_agent' has no attribute '_generate_draft'`.

- [ ] **Step 3: Add `_generate_draft` helper to `ai_agent.py`**

Add this function before `_execute_tool`:

```python
SEGMENT_TONE = {
    "ENT":  "formal and professional, using polite language appropriate for enterprise clients",
    "MID":  "professional and clear, balancing warmth with efficiency",
    "SMB":  "direct and friendly, keeping the response concise",
    None:   "professional and helpful",
}


def _generate_draft(ticket: dict, replies: list[dict]) -> str:
    """Generate a reply draft using GPT-4o-mini based on ticket context."""
    segment = ticket.get("customer_segment")
    tone = SEGMENT_TONE.get(segment, SEGMENT_TONE[None])

    history_lines = []
    for r in replies[-5:]:  # last 5 replies for context
        history_lines.append(f"[{r['author']}]: {r['body']}")
    history_text = "\n".join(history_lines) if history_lines else "(no previous replies)"

    prompt = (
        f"You are a support agent at Paggo. Write a reply to the following support ticket.\n\n"
        f"Customer: {ticket.get('customer_name')} ({segment or 'unknown segment'}, "
        f"{ticket.get('plan', 'unknown plan')} plan)\n"
        f"Open tickets from this customer: {ticket.get('previous_open_tickets_for_customer', 0)}\n"
        f"Subject: {ticket.get('subject')}\n"
        f"Original message: {ticket.get('body_preview')}\n\n"
        f"Recent conversation:\n{history_text}\n\n"
        f"Write a reply in Portuguese. Tone: {tone}. "
        f"Use the real context of the ticket — do not use generic templates. "
        f"Do not invent facts about bugs or resolutions you don't know. "
        f"Keep it under 150 words."
    )

    response = client.chat.completions.create(
        model="gpt-4o-mini",
        messages=[{"role": "user", "content": prompt}],
        temperature=0.4,
    )
    return response.choices[0].message.content.strip()
```

- [ ] **Step 4: Add `draft_reply` tool definition to `TOOLS`**

Add after the `merge_tickets` tool entry (before the closing `]`):

```python
    {
        "type": "function",
        "function": {
            "name": "draft_reply",
            "description": (
                "Generate a personalized reply draft for a ticket based on its real content, "
                "customer segment, plan, and conversation history. "
                "The draft will be shown to the leader for review before sending. "
                "Use this whenever the leader wants to reply to a ticket."
            ),
            "parameters": {
                "type": "object",
                "properties": {
                    "ticket_id": {"type": "string", "description": "The ticket to draft a reply for"}
                },
                "required": ["ticket_id"]
            }
        }
    },
```

- [ ] **Step 5: Add `draft_reply` execution in `_execute_tool`**

Add before the final `return json.dumps({"error": "unknown tool"})`:

```python
        elif name == "draft_reply":
            # If draft_body already provided (confirmation path), just send it
            if args.get("draft_body"):
                db.table("ticket_replies").insert({
                    "ticket_id": args["ticket_id"],
                    "body": args["draft_body"],
                    "author": "AI Agent",
                    "source": "AGENT",
                    "is_draft": False,
                }).execute()
                db.table("tickets").update({
                    "last_reply_by": "AGENT"
                }).eq("ticket_id", args["ticket_id"]).execute()
                db.table("audit_log").insert({
                    "ticket_id": args["ticket_id"],
                    "action": "REPLY_ADDED",
                    "actor": "AI Agent",
                    "source": "AGENT",
                    "new_value": args["draft_body"][:200],
                }).execute()
                return json.dumps({"success": True, "draft_body": args["draft_body"]})
            # Generation path: fetch context, generate draft, return (caller shows preview)
            ticket_result = db.table("tickets").select("*").eq("ticket_id", args["ticket_id"]).single().execute()
            replies_result = db.table("ticket_replies").select("author,body").eq("ticket_id", args["ticket_id"]).order("created_at", desc=False).execute()
            draft = _generate_draft(ticket_result.data, replies_result.data)
            return json.dumps({"draft_body": draft, "ticket_id": args["ticket_id"]})
```

- [ ] **Step 6: Update `run_agent` to handle `draft_reply` as a special WRITE_TOOL**

In `run_agent`, the `if name in WRITE_TOOLS:` block currently returns a generic pending_action message. For `draft_reply`, we must first generate the draft, then show it. Replace the `if name in WRITE_TOOLS:` block with:

```python
        if name in WRITE_TOOLS:
            if name == "draft_reply":
                # Generate draft first, then show for review
                gen_result = _execute_tool("draft_reply", args)
                try:
                    gen_data = json.loads(gen_result)
                except json.JSONDecodeError:
                    gen_data = {}
                draft_body = gen_data.get("draft_body", "")
                if not draft_body:
                    return {
                        "reply": "Não consegui gerar um rascunho para este ticket. Verifique se o ticket_id está correto.",
                        "pending_action": None,
                        "updated_history": messages[1:],
                    }
                args["draft_body"] = draft_body
                return {
                    "reply": (
                        f"Rascunho gerado para **{args['ticket_id']}**:\n\n"
                        f"---\n{draft_body}\n---\n\n"
                        f"Enviar esta resposta?"
                    ),
                    "pending_action": {"name": "draft_reply", "args": args, "tool_call_id": tool_call.id},
                    "updated_history": messages[1:],
                }
            return {
                "reply": f"I'd like to call **{name}** with: {json.dumps(args, indent=2)}. Shall I proceed?",
                "pending_action": {"name": name, "args": args, "tool_call_id": tool_call.id},
                "updated_history": messages[1:],
            }
```

- [ ] **Step 7: Run all agent tests**

```powershell
venv\Scripts\python.exe -m pytest tests/test_agent_tools.py -v 2>&1 | Select-Object -Last 20
```

Expected: all 9 tests pass.

- [ ] **Step 8: Run full suite**

```powershell
venv\Scripts\python.exe -m pytest -q 2>&1 | Select-Object -Last 5
```

Expected: all passing (59 existing + 9 new = 68).

- [ ] **Step 9: Update the system prompt to mention new capabilities**

In `SYSTEM_PROMPT`, replace the existing string with:

```python
SYSTEM_PROMPT = """You are a support triage assistant for Paggo.
You help support leaders understand and act on support tickets.

Available actions:
- list_tickets: query tickets with rich filters (segment, status, category, no_reply, date range, sort)
- get_ticket: fetch full details of one ticket
- update_ticket_status: change ticket status following state machine rules
- assign_ticket: assign or reassign a ticket to an agent
- classify_ticket: set priority and/or category
- close_ticket: close a ticket with a required reason (RESOLVED_FIXED, RESOLVED_INFO, DUPLICATE, NOT_REPRODUCIBLE, WONT_FIX, CUSTOMER_NO_RESPONSE)
- merge_tickets: merge a duplicate ticket into a primary ticket (same customer only)
- draft_reply: generate a personalized reply draft for the leader to review before sending

Rules:
- Always show a preview and ask for confirmation before executing write actions.
- For queries affecting multiple tickets (e.g. "escalate all ENT tickets unanswered for 4h"), first list the tickets, confirm the plan, then act.
- Never invent ticket IDs, customer names, or facts about bugs you don't have.
- If data is missing, say so and ask.
- Reply in the same language the leader uses (usually Portuguese).
- Call one tool at a time. Wait for the result before calling another."""
```

- [ ] **Step 10: Commit and push**

```bash
git add backend/services/ai_agent.py backend/tests/test_agent_tools.py
git commit -m "feat: add draft_reply tool to AI agent with GPT-generated drafts"
git push
```

---

## Summary of changes

| File | Change |
|---|---|
| `backend/services/ai_agent.py` | Expand `list_tickets` tool; add `close_ticket`, `merge_tickets`, `draft_reply` tools; add `_generate_draft` helper; update `run_agent` for draft preview; update `SYSTEM_PROMPT` |
| `backend/tests/test_agent_tools.py` | New file: 9 unit tests covering all new tool behaviors |
