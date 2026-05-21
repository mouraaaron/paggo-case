import json
import os
from openai import OpenAI

_client: OpenAI | None = None


def _get_client() -> OpenAI:
    global _client
    if _client is None:
        _client = OpenAI(api_key=os.getenv("OPENAI_API_KEY"))
    return _client


def classify_faq_batch(tickets: list[dict]) -> dict[str, bool]:
    """
    Classify FAQ potential for up to 25 tickets via GPT-4o-mini.
    Each dict must have 'ticket_id', 'subject', 'body_preview'.
    Returns {ticket_id: True/False}. Missing IDs default to False.

    A ticket is FAQ if: it's a simple, self-contained question with a
    well-known standard answer that doesn't require investigation.
    """
    if not tickets:
        return {}

    lines = "\n".join(
        f"{i + 1}. [ID:{t['ticket_id']}] {t.get('subject', '')} — {(t.get('body_preview') or '')[:300]}"
        for i, t in enumerate(tickets)
    )

    prompt = f"""Você é um analista de suporte B2B SaaS classificando tickets de suporte.

Um ticket é FAQ (Frequently Asked Question) se:
- É uma pergunta simples e autocontida com resposta padronizada conhecida
- Exemplos: redefinição de senha, como encontrar fatura, como exportar dados, como adicionar usuário, como acessar uma funcionalidade específica, solicitar segunda via de nota fiscal, dúvidas básicas de navegação
- NÃO são FAQ: erros técnicos que exigem investigação, reclamações, pedidos de cancelamento, bugs de integração, problemas de performance, configurações complexas, acesso/permissões que exigem ação manual

Analise cada ticket e retorne um JSON onde cada chave é o ID do ticket (exatamente como mostrado) e o valor é true (é FAQ) ou false (não é FAQ).

Tickets:
{lines}

Responda APENAS com um objeto JSON. Exemplo: {{"TKT-001": true, "TKT-002": false}}"""

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
        print(f"[faq_classifier] LLM call failed: {e}")
        return {}
