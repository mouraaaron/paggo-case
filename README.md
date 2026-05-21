# Paggo Case — Sistema de Triagem de Tickets de Suporte

> **Primeiro acesso:** O backend está no plano gratuito do Render e hiberna após 15 min de inatividade. Se abrir sem dados, aguarde 30–60 s e recarregue.

Aplicação full-stack para triagem de ~8.000 tickets de suporte, construída com FastAPI + Next.js + Supabase + OpenAI.

**Demo:** https://paggo-case-gules.vercel.app/inbox

---

## Funcionalidades

- **Kanban de tickets** — visão em colunas por status, cards coloridos por prioridade, filtros por data, segmento, agente, canal, flag e categoria
- **Painel de alertas lateral** — tickets críticos (score ≥ 70) em destaque em tempo real, respeitando os filtros de data ativos
- **Stats bottom bar** — três painéis: balanceamento de carga por agente, volume de tickets por segmento (ENT/MID/SMB) e score de risco médio por segmento
- **Prioridade automática** — calculada pelo sistema de triagem, nunca pelo cliente: `≥ 70 → URGENT` · `40–69 → HIGH` · `10–39 → MEDIUM` · `< 10 → LOW`
- **Detalhe do ticket** — painel lateral com audit log, respostas, mudança de status, atribuição, classificação, encerramento e merge
- **Agente de IA** — assistente conversacional (GPT-4o-mini + tool calling) que lê tickets e executa ações com confirmação humana obrigatória antes de qualquer escrita
- **Máquina de estados** — transições inválidas retornam HTTP 422
- **Audit log** — cada mutação registrada com ator, origem (USER vs AGENT) e valores anterior/posterior

---

## Regras de Triagem

A detecção de churn usa **classificação via LLM** (GPT-4o-mini), não keywords. O modelo avalia o contexto completo da frase e elimina falsos positivos como "cancelar reunião" ou "reembolso de cobrança duplicada".

| Regra | Condição | Pontos | Flag |
|---|---|---|---|
| `CHURN_UNASSIGNED` | LLM detecta intenção de churn + sem agente atribuído | +70 | `CHURN_UNASSIGNED` |
| `ENT_NO_REPLY_2H` | Cliente ENT sem resposta há mais de 2h | +70 | `ENT_NO_REPLY_2H` |
| `CHURN_SIGNAL` | LLM detecta intenção de churn + agente atribuído | +35 | `CHURN_SIGNAL` |
| `MID_NO_REPLY_2H` | Cliente MID sem resposta há mais de 2h | +30 | `MID_NO_REPLY_2H` |
| `MULTIPLE_OPEN` | Cliente com ≥ 3 tickets abertos simultaneamente | +15 | `MULTIPLE_OPEN` |
| `STALE_IN_PROGRESS` | IN_PROGRESS sem atividade há mais de 72h | +15 | `STALE_IN_PROGRESS` |

Score final é a soma dos pontos ativos, limitado a 100. Tickets com score ≥ 70 aparecem no painel de alertas.

> Após alterar regras ou a lógica de churn, reexecute `python scripts/import_csv.py` para recalcular flags, score e prioridade de todos os tickets (operação idempotente; resultados LLM são cacheados em `scripts/churn_cache.json`).

---

## Ferramentas do Agente de IA

| Ferramenta | Tipo | Descrição |
|---|---|---|
| `get_ticket` | Leitura | Retorna todos os detalhes de um ticket |
| `list_tickets` | Leitura | Lista tickets com filtros opcionais |
| `update_ticket_status` | **Escrita** | Altera o status (respeita a máquina de estados) |
| `assign_ticket` | **Escrita** | Atribui o ticket a um agente |
| `classify_ticket` | **Escrita** | Define prioridade e/ou categoria |

Ações de escrita exigem confirmação explícita do usuário. Todas as ações do agente são registradas no audit log com `source: AGENT`.

---

## Stack

| Camada | Tecnologia |
|---|---|
| Frontend | Next.js 16 (App Router) · React 19 · Tailwind CSS v4 |
| Backend | FastAPI · Python 3.13 · Pydantic v2 |
| Banco de dados | Supabase (PostgreSQL) |
| IA | OpenAI GPT-4o-mini (classificação de churn + agente) |
| Hospedagem | Vercel (frontend) · Render (backend) |

---

## Desenvolvimento Local

### Backend

```powershell
cd backend
python -m venv venv
venv\Scripts\Activate.ps1
pip install -r requirements.txt
# Copie .env.example para .env e preencha os valores
uvicorn main:app --reload --port 8000
```

Docs da API: http://localhost:8000/docs

### Frontend

```powershell
cd frontend
$env:PATH = "C:\Program Files\nodejs;$env:PATH"
npm install
# .env.local já aponta para http://localhost:8000
npm run dev   # http://localhost:3000
```

### Re-importar CSV

```powershell
cd backend
venv\Scripts\python.exe scripts/import_csv.py
```

O script classifica churn via LLM em batches de 25 (cache em `scripts/churn_cache.json`) e faz upsert de todos os tickets no Supabase. Custo único de ~$0,30 para 8.000 tickets; runs subsequentes carregam do cache sem chamar a API.

---

## Variáveis de Ambiente

### Backend (Render)

| Variável | Obrigatória | Descrição |
|---|---|---|
| `SUPABASE_URL` | sim | URL do projeto Supabase |
| `SUPABASE_SERVICE_KEY` | sim | Chave service role (necessária para escrita, bypassa RLS) |
| `OPENAI_API_KEY` | sim | Usada pelo classificador de churn e pelo agente de IA |
| `ALLOWED_ORIGINS` | não | Origens CORS separadas por vírgula; padrão `*` |

### Frontend (Vercel)

| Variável | Obrigatória | Descrição |
|---|---|---|
| `NEXT_PUBLIC_BACKEND_URL` | não | URL do backend; padrão `http://localhost:8000` |

---

## Testes

```powershell
# Backend (25 testes)
cd backend
venv\Scripts\python.exe -m pytest

# Frontend — unit/component (34 testes)
cd frontend
npx vitest run

# Frontend — E2E (Playwright)
cd frontend
npx playwright test
```
