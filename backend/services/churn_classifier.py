import json
import os
from openai import OpenAI

_client: OpenAI | None = None


def _get_client() -> OpenAI:
    global _client
    if _client is None:
        _client = OpenAI(api_key=os.getenv("OPENAI_API_KEY"))
    return _client


def classify_churn_batch(tickets: list[dict]) -> dict[str, bool]:
    """
    Classify churn intent for up to 25 tickets via GPT-4o-mini.
    Each dict must have 'ticket_id', 'subject', 'body_preview'.
    Returns {ticket_id: True/False}. Missing IDs default to False (no churn).
    """
    if not tickets:
        return {}

    lines = "\n".join(
        f"{i + 1}. [ID:{t['ticket_id']}] {t.get('subject', '')} — {(t.get('body_preview') or '')[:300]}"
        for i, t in enumerate(tickets)
    )

    prompt = f"""You are a B2B SaaS customer success analyst detecting churn risk in support tickets.

Churn intent = the customer is seriously considering canceling their subscription, ending the contract, switching to a competitor, or abandoning the product entirely.

NOT churn intent:
- Canceling a meeting, appointment, or single transaction
- Billing disputes or refund requests without an exit signal
- Feature complaints or frustration without any cancellation language
- Hypothetical or procedural questions about how cancellation works

Analyze each ticket and return a JSON object where each key is the ticket ID (exactly as shown) and the value is true (churn intent present) or false (no churn intent).

Tickets:
{lines}

Respond with ONLY a JSON object. Example: {{"TKT-001": true, "TKT-002": false}}"""

    try:
        response = _get_client().chat.completions.create(
            model="gpt-4o-mini",
            messages=[{"role": "user", "content": prompt}],
            response_format={"type": "json_object"},
            temperature=0,
        )
        result = json.loads(response.choices[0].message.content)
        known_ids = {t["ticket_id"] for t in tickets}
        return {k: bool(v) for k, v in result.items() if k in known_ids}
    except Exception as e:
        print(f"[churn_classifier] LLM call failed: {e}")
        return {}
