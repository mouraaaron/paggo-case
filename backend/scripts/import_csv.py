import csv
import sys
import os
from dotenv import load_dotenv
from supabase import create_client

load_dotenv(os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), ".env"))

sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
from services.triage_rules import calculate_triage_flags


def get_import_db():
    """Use service role key to bypass RLS for bulk import."""
    url = os.getenv("SUPABASE_URL")
    key = os.getenv("SUPABASE_SERVICE_KEY") or os.getenv("SUPABASE_KEY")
    if not url or not key:
        raise RuntimeError("SUPABASE_URL and SUPABASE_SERVICE_KEY must be set in .env")
    return create_client(url, key)

CSV_PATH = r"C:\Users\aaron\Case paggo\tickets.csv"

def parse_nullable(value: str) -> str | None:
    return value if value and value.lower() not in ("null", "", "none") else None

def parse_int(value: str) -> int:
    try:
        return int(value)
    except (ValueError, TypeError):
        return 0

def run():
    db = get_import_db()
    batch = []
    batch_size = 500
    total = 0

    with open(CSV_PATH, newline="", encoding="utf-8") as f:
        reader = csv.DictReader(f)
        for row in reader:
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
            flags, score = calculate_triage_flags(ticket)
            ticket["triage_flags"] = flags
            ticket["risk_score"] = score
            batch.append(ticket)

            if len(batch) >= batch_size:
                db.table("tickets").upsert(batch).execute()
                total += len(batch)
                print(f"Upserted {total} tickets...")
                batch = []

        if batch:
            db.table("tickets").upsert(batch).execute()
            total += len(batch)
            print(f"Upserted final {len(batch)} tickets.")

    print(f"Import complete. Total: {total} tickets.")

if __name__ == "__main__":
    run()
