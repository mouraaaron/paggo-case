# FAQ Classification Design

**Date:** 2026-05-21

## Goal

Classify support tickets that contain simple, frequently asked questions (FAQ) — those that do not require human investigation and carry low risk — so the team leader can quickly identify them visually and respond with standard templates. Show the total FAQ count and percentage in the stats bar.

## Context

- 8,000 tickets in the database.
- LLM dry-run (GPT-4o-mini) classified **1,766 tickets as FAQ (22.1%)** among the 7,909 eligible tickets (risk_score < 40).
- The `faq_cache.json` file already exists at `backend/scripts/faq_cache.json` with results for all 7,909 eligible tickets — zero additional API calls needed for the first write run.

## FAQ Eligibility Criteria

A ticket is eligible for FAQ classification only if **both** conditions are met:

1. `risk_score < 40` (priority is LOW or MEDIUM — excludes HIGH and URGENT)
2. GPT-4o-mini classifies the subject/body as a simple, self-contained question with a well-known standard answer

Tickets with `risk_score >= 40` receive `is_faq = false` without calling the LLM.

## FAQ Definition (LLM prompt)

A ticket is FAQ if:
- Subject/body is a simple, self-contained question with a well-known standard answer
- Examples: password reset, how to find invoice, how to export data, how to add a user, how to access a specific feature, request for duplicate invoice
- NOT FAQ: technical errors requiring investigation, complaints, cancellation requests, integration bugs, performance issues, complex configurations, access/permission issues requiring manual action

## Architecture

```
backend/
  services/
    faq_classifier.py          ← NEW (already created): GPT-4o-mini batch classifier
  scripts/
    label_faq.py               ← NEW: writes is_faq to DB (replaces count_faq.py dry run)
    count_faq.py               ← EXISTING dry-run script (keep for reference)
    faq_cache.json             ← EXISTING cache from dry run (1,766 FAQ / 7,909 eligible)
    import_csv.py              ← MODIFY: integrate FAQ classification after triage
  routers/
    tickets.py                 ← MODIFY: add GET /tickets/stats/faq-count endpoint
  models.py                    ← MODIFY: add is_faq: bool = False to TicketOut

Supabase (PostgreSQL)
  tickets                      ← MODIFY: add is_faq boolean DEFAULT false column

frontend/
  components/
    KanbanCard.tsx             ← MODIFY: white background when ticket.is_faq === true
    AlertPanel.tsx             ← MODIFY: add FAQ panel to StatsBottomBar
  lib/
    api.ts                     ← MODIFY: add getFaqCount() fetch function
  types/
    index.ts                   ← MODIFY: add is_faq to Ticket type
```

## Database Schema Change

```sql
ALTER TABLE tickets ADD COLUMN is_faq boolean DEFAULT false;
```

Run this in the Supabase SQL editor before executing `label_faq.py`.

## Backend

### `services/faq_classifier.py` (already created)

Batch classifier — identical structure to `churn_classifier.py`. Accepts list of `{ticket_id, subject, body_preview}`, returns `{ticket_id: bool}`. Batch size: 25. Model: `gpt-4o-mini`, `temperature=0`, `response_format={"type": "json_object"}`.

### `scripts/label_faq.py` (new)

1. Connect to Supabase (service key from `.env`)
2. Fetch all tickets paginated (1,000/page) — `ticket_id, subject, body_preview, risk_score`
3. Load `faq_cache.json` if present; classify only uncached tickets in batches of 25
4. For each ticket: `is_faq = faq_map.get(ticket_id, False)` — tickets with `risk_score >= 40` are always `false` regardless of cache
5. Upsert `{ticket_id, is_faq}` to Supabase in batches of 100
6. Save updated cache to `faq_cache.json`
7. Print final count and percentage

### `scripts/import_csv.py` (modify)

After `calculate_triage_flags()`, set `ticket["is_faq"]`:
- If `risk_score < 40`: look up `faq_map.get(ticket_id, False)`
- Else: `False`

Load `faq_cache.json` at the top of the script alongside `churn_cache.json`. If FAQ cache is absent, run `classify_faq_batch()` for eligible tickets (same batching pattern as churn).

### `models.py` (modify)

```python
class TicketOut(BaseModel):
    ...
    is_faq: bool = False
```

### `routers/tickets.py` (modify)

New endpoint, registered **before** `/{ticket_id}`:

```python
@router.get("/stats/faq-count")
def get_faq_count(
    created_after: str | None = Query(None),
    created_before: str | None = Query(None),
):
    # Returns: {"faq_count": int, "total": int, "percentage": float}
```

Query: `SELECT COUNT(*) WHERE is_faq = true` (scoped by `created_at` range if provided). `total` = count of all tickets in same range. `percentage = faq_count / total * 100` (0.0 if total = 0).

## Frontend

### `types/index.ts`

Add `is_faq: boolean` to the `Ticket` interface.

### `lib/api.ts`

```typescript
export interface FaqCountData {
  faq_count: number
  total: number
  percentage: number
}

export function getFaqCount(createdAfter?: string, createdBefore?: string): Promise<FaqCountData> {
  const params = new URLSearchParams()
  if (createdAfter) params.set('created_after', createdAfter)
  if (createdBefore) params.set('created_before', createdBefore)
  return req<FaqCountData>(`/tickets/stats/faq-count?${params}`)
}
```

### `components/KanbanCard.tsx`

When `ticket.is_faq === true`, apply `bg-white` (and `text-gray-900` for contrast) to the card background. All other visual logic (colored borders for churn/risk/unassigned) remains unchanged.

### `components/AlertPanel.tsx` — StatsBottomBar

Add a 4th panel **"Tickets FAQ"** alongside the three existing panels. The panel shows:
- Label: "Tickets FAQ"
- Value: `{faq_count.toLocaleString('pt-BR')}` tickets
- Sub-label: `{percentage.toFixed(1)}% do total`

Follows the same stale-while-revalidate pattern as the existing panels (`hasData` ref, pulse dot on re-fetch). Respects `createdAfter`/`createdBefore` props and `refreshKey`.

## Testing

### Backend (`pytest`)

File: `backend/tests/test_faq_count.py`

- `test_faq_count_no_filter` — returns `{faq_count, total, percentage}` shape
- `test_faq_count_with_date_filter` — scopes by `created_at` range
- `test_faq_count_empty_result` — `faq_count=0, total=0, percentage=0.0` when no tickets match
- `test_faq_count_percentage_calculation` — `faq_count=2, total=10 → percentage=20.0`

Mock pattern: `monkeypatch.setattr("routers.tickets.get_db", ...)` with `_sequential([rows])`.

### Frontend (`vitest`)

File: `frontend/__tests__/FaqPanel.test.tsx`

- Renders "Tickets FAQ" label
- Shows formatted count and percentage
- Shows pulse dot while loading (refreshKey bump)
- Shows stale data while re-fetching

## Out of Scope

- Auto-generated FAQ responses (manual trigger only, to be designed separately)
- FAQ filter in the kanban column filter bar (not requested)
- FAQ status as a ticket workflow state (not requested)
