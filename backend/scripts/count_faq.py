"""
Dry-run FAQ classification: classifies LOW/MEDIUM tickets (risk_score < 40)
via GPT-4o-mini, caches results, and reports the count + percentage.
Does NOT write anything to the database.
"""
import json
import os
import sys
from dotenv import load_dotenv
from supabase import create_client

load_dotenv(os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), ".env"))

sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
from services.faq_classifier import classify_faq_batch

FAQ_CACHE_PATH = os.path.join(os.path.dirname(__file__), "faq_cache.json")
BATCH_SIZE = 25


def get_db():
    url = os.getenv("SUPABASE_URL")
    key = os.getenv("SUPABASE_SERVICE_KEY") or os.getenv("SUPABASE_KEY")
    if not url or not key:
        raise RuntimeError("SUPABASE_URL and SUPABASE_SERVICE_KEY must be set in .env")
    return create_client(url, key)


def fetch_all_tickets(db) -> list[dict]:
    """Fetch all tickets paginated (Supabase returns max 1000 per call)."""
    tickets = []
    page_size = 1000
    offset = 0
    while True:
        rows = (
            db.table("tickets")
            .select("ticket_id,subject,body_preview,risk_score,priority")
            .range(offset, offset + page_size - 1)
            .execute()
            .data
        )
        if not rows:
            break
        tickets.extend(rows)
        if len(rows) < page_size:
            break
        offset += page_size
    return tickets


def run():
    db = get_db()

    print("Buscando todos os tickets no Supabase...")
    all_tickets = fetch_all_tickets(db)
    total = len(all_tickets)
    print(f"Total de tickets na base: {total}")

    eligible = [t for t in all_tickets if (t.get("risk_score") or 0) < 40]
    print(f"Elegíveis para FAQ (risk_score < 40 / LOW ou MEDIUM): {len(eligible)}")

    # Load or build cache
    if os.path.exists(FAQ_CACHE_PATH):
        print(f"Cache encontrado: {FAQ_CACHE_PATH}")
        with open(FAQ_CACHE_PATH, encoding="utf-8") as f:
            faq_map: dict[str, bool] = json.load(f)
        uncached = [t for t in eligible if t["ticket_id"] not in faq_map]
        print(f"Já classificados no cache: {len(faq_map)} | Faltando: {len(uncached)}")
    else:
        faq_map = {}
        uncached = eligible

    if uncached:
        print(f"\nClassificando {len(uncached)} tickets via GPT-4o-mini...")
        for i in range(0, len(uncached), BATCH_SIZE):
            batch = uncached[i : i + BATCH_SIZE]
            batch_input = [
                {
                    "ticket_id": t["ticket_id"],
                    "subject": t.get("subject", ""),
                    "body_preview": t.get("body_preview", ""),
                }
                for t in batch
            ]
            result = classify_faq_batch(batch_input)
            faq_map.update(result)
            for t in batch_input:
                if t["ticket_id"] not in faq_map:
                    faq_map[t["ticket_id"]] = False

            done = min(i + BATCH_SIZE, len(uncached))
            if done % 250 == 0 or done == len(uncached):
                faq_so_far = sum(1 for v in faq_map.values() if v)
                print(f"  {done}/{len(uncached)} classificados — FAQ até agora: {faq_so_far}")

        with open(FAQ_CACHE_PATH, "w", encoding="utf-8") as f:
            json.dump(faq_map, f)
        print(f"Cache salvo em {FAQ_CACHE_PATH}")

    faq_count = sum(1 for tid, is_faq in faq_map.items() if is_faq)
    pct_of_eligible = (faq_count / len(eligible) * 100) if eligible else 0
    pct_of_total = (faq_count / total * 100) if total else 0

    print("\n" + "=" * 50)
    print(f"  Total de tickets na base:          {total}")
    print(f"  Elegíveis (LOW/MEDIUM):             {len(eligible)}")
    print(f"  Classificados como FAQ pela LLM:    {faq_count}")
    print(f"  % dos elegíveis:                    {pct_of_eligible:.1f}%")
    print(f"  % do total de 8.000:                {pct_of_total:.1f}%")
    print("=" * 50)
    print("\nNenhum dado foi gravado no banco. Aguardando autorização.")


if __name__ == "__main__":
    run()
