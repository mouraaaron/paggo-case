import csv
import json
import sys
import os
from dotenv import load_dotenv
from supabase import create_client

load_dotenv(os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), ".env"))

sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
from services.triage_rules import calculate_triage_flags
from services.churn_classifier import classify_churn_batch
from services.faq_classifier import classify_faq_batch


def get_import_db():
    """Use service role key to bypass RLS for bulk import."""
    url = os.getenv("SUPABASE_URL")
    key = os.getenv("SUPABASE_SERVICE_KEY") or os.getenv("SUPABASE_KEY")
    if not url or not key:
        raise RuntimeError("SUPABASE_URL and SUPABASE_SERVICE_KEY must be set in .env")
    return create_client(url, key)

CSV_PATH = r"C:\Users\aaron\Case paggo\tickets.csv"
CHURN_CACHE_PATH = os.path.join(os.path.dirname(__file__), "churn_cache.json")
FAQ_CACHE_PATH = os.path.join(os.path.dirname(__file__), "faq_cache.json")

def parse_nullable(value: str) -> str | None:
    return value if value and value.lower() not in ("null", "", "none") else None

def parse_int(value: str) -> int:
    try:
        return int(value)
    except (ValueError, TypeError):
        return 0

def run():
    db = get_import_db()

    print("Reading CSV...")
    with open(CSV_PATH, newline="", encoding="utf-8") as f:
        rows = list(csv.DictReader(f))
    print(f"Read {len(rows)} rows.")

    # --- LLM churn classification (batches of 25, with JSON cache) ---
    if os.path.exists(CHURN_CACHE_PATH):
        print(f"Loading churn classification from cache: {CHURN_CACHE_PATH}")
        with open(CHURN_CACHE_PATH, encoding="utf-8") as f:
            churn_map: dict[str, bool] = json.load(f)
        print(f"Cache loaded. Churn detected: {sum(v for v in churn_map.values())}/{len(churn_map)}")
    else:
        print("Running LLM churn classification...")
        llm_batch_size = 25
        churn_map = {}

        for i in range(0, len(rows), llm_batch_size):
            batch_rows = rows[i:i + llm_batch_size]
            tickets_for_llm = [
                {
                    "ticket_id": r["ticketId"],
                    "subject": r.get("subject", ""),
                    "body_preview": r.get("bodyPreview", ""),
                }
                for r in batch_rows
            ]
            result = classify_churn_batch(tickets_for_llm)
            churn_map.update(result)
            for t in tickets_for_llm:
                if t["ticket_id"] not in churn_map:
                    churn_map[t["ticket_id"]] = False

            done = min(i + llm_batch_size, len(rows))
            if done % 250 == 0 or done == len(rows):
                churn_so_far = sum(1 for v in churn_map.values() if v)
                print(f"  {done}/{len(rows)} classified — churn so far: {churn_so_far}")

        churn_total = sum(1 for v in churn_map.values() if v)
        print(f"LLM classification complete. Churn intent detected: {churn_total}/{len(rows)} tickets.")
        with open(CHURN_CACHE_PATH, "w", encoding="utf-8") as f:
            json.dump(churn_map, f)
        print(f"Cache saved to {CHURN_CACHE_PATH}")

    # --- LLM FAQ classification (batches of 25, with JSON cache) ---
    if os.path.exists(FAQ_CACHE_PATH):
        print(f"Loading FAQ classification from cache: {FAQ_CACHE_PATH}")
        with open(FAQ_CACHE_PATH, encoding="utf-8") as f:
            faq_map: dict[str, bool] = json.load(f)
        uncached_faq = [r for r in rows if r["ticketId"] not in faq_map]
        print(f"FAQ cache loaded ({len(faq_map)} entries). Uncached: {len(uncached_faq)}")
    else:
        faq_map = {}
        uncached_faq = rows

    if uncached_faq:
        print(f"Running LLM FAQ classification on {len(uncached_faq)} tickets...")
        tickets_for_faq = [
            {"ticket_id": r["ticketId"], "subject": r.get("subject", ""), "body_preview": r.get("bodyPreview", "")}
            for r in uncached_faq
        ]
        for i in range(0, len(tickets_for_faq), 25):
            batch_faq = tickets_for_faq[i:i + 25]
            result = classify_faq_batch(batch_faq)
            faq_map.update(result)
            for t in batch_faq:
                if t["ticket_id"] not in faq_map:
                    faq_map[t["ticket_id"]] = False
        with open(FAQ_CACHE_PATH, "w", encoding="utf-8") as f:
            json.dump(faq_map, f)
        print(f"FAQ cache saved to {FAQ_CACHE_PATH}")

    # --- Triage + upsert ---
    print("Processing triage and upserting...")
    batch: list[dict] = []
    upsert_batch_size = 100
    total = 0

    for row in rows:
        ticket = {
            "ticket_id": row["ticketId"],
            "customer_id": row["customerId"],
            "customer_name": row["customerName"],
            "customer_segment": row["customerSegment"],
            "plan": row["plan"],
            "channel": row["channel"],
            "subject": row["subject"],
            "body_preview": row["bodyPreview"],
            "created_at": parse_nullable(row["createdAt"]),
            "last_reply_at": parse_nullable(row["lastReplyAt"]),
            "last_reply_by": parse_nullable(row["lastReplyBy"]),
            "reply_count": parse_int(row["replyCount"]),
            "status": row.get("status") or "NEW",
            "priority": parse_nullable(row["priority"]),
            "assigned_to": parse_nullable(row["assignedTo"]),
            "category": parse_nullable(row["category"]),
            "previous_open_tickets_for_customer": parse_int(row["previousOpenTicketsForCustomer"]),
        }
        has_churn = churn_map.get(ticket["ticket_id"], False)
        flags, score, priority = calculate_triage_flags(ticket, has_churn=has_churn)
        ticket["triage_flags"] = flags
        ticket["risk_score"] = score
        ticket["priority"] = priority
        ticket["is_faq"] = faq_map.get(ticket["ticket_id"], False) if score < 40 else False
        batch.append(ticket)

        if len(batch) >= upsert_batch_size:
            db.table("tickets").upsert(batch).execute()
            total += len(batch)
            print(f"Upserted {total} tickets...")
            batch = []

    if batch:
        db.table("tickets").upsert(batch).execute()
        total += len(batch)
        print(f"Upserted final {len(batch)} tickets.")

    print(f"\nImport complete. Total: {total} tickets.")

if __name__ == "__main__":
    run()
