import os
import json
from datetime import datetime
from collections import defaultdict
from openai import OpenAI
from database import get_db


def _get_client() -> OpenAI:
    return OpenAI(api_key=os.getenv("OPENAI_API_KEY"))


def _format_period_label(created_after: str, created_before: str) -> str:
    d_from = datetime.fromisoformat(created_after.split("T")[0])
    d_to = datetime.fromisoformat(created_before.split("T")[0])
    return f"{d_from.strftime('%d/%m')} - {d_to.strftime('%d/%m')}"


def generate_morning_briefing(created_after: str, created_before: str) -> dict:
    db = get_db()
    OPEN_STATUSES = {"NEW", "TRIAGED", "IN_PROGRESS", "WAITING_CUSTOMER", "ESCALATED", "REOPENED"}

    # 1. Tickets created in the period
    period_rows = (
        db.table("tickets")
        .select("customer_segment,status,priority,assigned_to")
        .gte("created_at", created_after)
        .lte("created_at", f"{created_before.split('T')[0]}T23:59:59.999999")
        .execute()
        .data
    )

    by_segment: dict[str, int] = defaultdict(int)
    unassigned_urgent = 0
    for r in period_rows:
        seg = r.get("customer_segment")
        if seg in ("ENT", "MID", "SMB"):
            by_segment[seg] += 1
        if (
            r.get("priority") == "URGENT"
            and r.get("assigned_to") is None
            and r.get("status") in OPEN_STATUSES
        ):
            unassigned_urgent += 1

    # 2. Current agent load (all open tickets, not period-scoped)
    agent_rows = (
        db.table("tickets")
        .select("assigned_to,priority,status")
        .neq("assigned_to", None)
        .execute()
        .data
    )

    agent_totals: dict[str, dict] = defaultdict(lambda: {"total": 0, "urgent": 0})
    for r in agent_rows:
        if r.get("status") in ("CLOSED", "RESOLVED"):
            continue
        agent = r["assigned_to"]
        agent_totals[agent]["total"] += 1
        if r.get("priority") == "URGENT":
            agent_totals[agent]["urgent"] += 1

    overloaded = sorted(
        a for a, d in agent_totals.items() if d["total"] >= 15 or d["urgent"] >= 3
    )

    # 3. GPT-4o-mini: narrative + next_steps
    context = {
        "period": _format_period_label(created_after, created_before),
        "new_tickets_total": len(period_rows),
        "by_segment": {
            "ENT": by_segment.get("ENT", 0),
            "MID": by_segment.get("MID", 0),
            "SMB": by_segment.get("SMB", 0),
        },
        "unassigned_urgent": unassigned_urgent,
        "overloaded_agents": overloaded,
    }

    client = _get_client()
    response = client.chat.completions.create(
        model="gpt-4o-mini",
        response_format={"type": "json_object"},
        messages=[
            {
                "role": "system",
                "content": (
                    "Você é um assistente de análise de suporte para um gestor SaaS B2B. "
                    "Analise os dados do período e retorne JSON com exatamente duas chaves: "
                    "\"narrative\" (string, 1-2 frases resumindo o período em português) e "
                    "\"next_steps\" (array de 3 a 5 strings com ações concretas em português, "
                    "começando com verbo no infinitivo, ex: 'Atribuir tickets urgentes sem responsável')."
                ),
            },
            {
                "role": "user",
                "content": f"Dados do período:\n{json.dumps(context, ensure_ascii=False)}",
            },
        ],
    )

    try:
        llm_result = json.loads(response.choices[0].message.content or "{}")
        narrative = str(llm_result.get("narrative", ""))
        next_steps = [str(s) for s in llm_result.get("next_steps", [])]
    except (json.JSONDecodeError, AttributeError):
        narrative = ""
        next_steps = []

    return {
        "period_label": _format_period_label(created_after, created_before),
        "new_tickets": {
            "total": len(period_rows),
            "ENT": by_segment.get("ENT", 0),
            "MID": by_segment.get("MID", 0),
            "SMB": by_segment.get("SMB", 0),
        },
        "team_status": {
            "overloaded_agents": overloaded,
            "unassigned_urgent": unassigned_urgent,
        },
        "narrative": narrative,
        "next_steps": next_steps,
    }
