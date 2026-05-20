# Paggo Case — Sistema de Triagem de Tickets de Suporte

> **⚠️ Aviso sobre o primeiro acesso:** O backend está hospedado no plano gratuito do Render, que hiberna após 15 minutos de inatividade. Se a página abrir sem dados ou exibir erro, aguarde 30–60 segundos e recarregue — o servidor estará acordando. Acessos subsequentes são instantâneos.

Aplicação full-stack para triagem de ~8.000 tickets de suporte, construída com FastAPI + Next.js + Supabase + OpenAI.

## Funcionalidades

- **Kanban de tickets** — visão em colunas com drag-and-drop, cards coloridos por prioridade (URGENT/HIGH/MEDIUM/LOW) e ordenação por risco
- **Painel de alertas lateral** — tickets críticos (score ≥ 70) em destaque em tempo real, workload de agentes por prioridade e gráfico de tendências semanais
- **Prioridade automática** — definida exclusivamente pelo sistema de triagem (não pelo cliente): `≥70 → URGENT`, `40–69 → HIGH`, `10–39 → MEDIUM`, `<10 → LOW`
- **Detalhe do ticket** — painel de ações completo (mudança de status, classificação, atribuição, respostas, encerramento) com audit log
- **Agente de IA** — assistente conversacional com GPT-4o-mini e tool calling; exige confirmação humana antes de executar ações de escrita
- **Motor de regras de triagem** — 6 regras que geram uma pontuação de risco de 0 a 100 por ticket
- **Máquina de estados** — garante transições de status válidas (transições inválidas retornam HTTP 422)
- **Audit log** — cada alteração é registrada com ator, origem (USER vs AGENT) e valores anterior/posterior

## Regras de Triagem

A prioridade é **100% definida pelo sistema** — a prioridade informada pelo cliente é ignorada por ser imprecisa. As duas situações mais críticas para o negócio (churn sem agente e cliente premium sem resposta rápida) geram URGENT diretamente:

| Regra | Condição | Pontos | Flag |
|---|---|---|---|
| `CHURN_UNASSIGNED` | Palavras de churn **+** sem agente atribuído | +70 | `CHURN_UNASSIGNED` |
| `ENT_NO_REPLY_2H` | Cliente ENT sem resposta há mais de 2h | +70 | `ENT_NO_REPLY_2H` |
| `CHURN_WITH_AGENT` | Palavras de churn + agente atribuído | +35 | `CHURN_SIGNAL` |
| `MID_NO_REPLY_2H` | Cliente MID sem resposta há mais de 2h | +30 | `MID_NO_REPLY_2H` |
| `MULTIPLE_OPEN` | Cliente com 3 ou mais tickets abertos simultaneamente | +15 | `MULTIPLE_OPEN` |
| `STALE_IN_PROGRESS` | Ticket IN_PROGRESS sem atividade há mais de 72h | +15 | `STALE_IN_PROGRESS` |

A pontuação final é a soma dos pontos ativos, limitada a 100. Tickets com score ≥ 70 aparecem automaticamente no painel de alertas lateral.

> **Após mudar regras:** re-execute `python scripts/import_csv.py` para recalcular flags, score e prioridade de todos os tickets (operação idempotente).

## Ferramentas do Agente de IA

| Ferramenta | Tipo | Descrição |
|---|---|---|
| `get_ticket` | Leitura | Retorna todos os detalhes de um ticket |
| `list_tickets` | Leitura | Lista tickets com filtros opcionais |
| `update_ticket_status` | **Escrita** | Altera o status (respeita a máquina de estados) |
| `assign_ticket` | **Escrita** | Atribui o ticket a um agente |
| `classify_ticket` | **Escrita** | Define prioridade e/ou categoria |

Ações de escrita exigem confirmação explícita do usuário antes de serem executadas. Todas as ações do agente são registradas no audit log com `source: AGENT`.

## Stack

| Camada | Tecnologia |
|---|---|
| Frontend | Next.js 14 (App Router), TypeScript, Tailwind CSS |
| Backend | FastAPI (Python), Pydantic v2 |
| Banco de dados | Supabase (PostgreSQL) |
| Agente de IA | OpenAI GPT-4o-mini com function calling |
| Hospedagem | Vercel (frontend) + Render (backend) |

## Arquitetura

```
Browser → Next.js (Vercel)
              ↓ fetch
         FastAPI (Render)
              ↓
         Supabase (PostgreSQL)
              ↓ (apenas agente de IA)
         OpenAI API
```

## Desenvolvimento Local

### Pré-requisitos
- Python 3.11+
- Node.js 18+

### Backend

```bash
cd backend
python -m venv venv
venv\Scripts\activate      # Windows
pip install -r requirements.txt
# Copie .env.example para .env e preencha os valores
uvicorn main:app --reload --port 8000
```

### Frontend

```bash
cd frontend
npm install
# .env.local já aponta para http://localhost:8000
npm run dev
```

Abra http://localhost:3000

## Variáveis de Ambiente

### Backend (configurar no painel do Render)

| Variável | Descrição |
|---|---|
| `SUPABASE_URL` | URL do projeto Supabase |
| `SUPABASE_SERVICE_KEY` | Chave service role do Supabase (necessária para escrita) |
| `OPENAI_API_KEY` | Chave da API da OpenAI |
| `ALLOWED_ORIGINS` | Origens CORS permitidas, separadas por vírgula (URL do Vercel) |

### Frontend (configurar no painel da Vercel)

| Variável | Descrição |
|---|---|
| `NEXT_PUBLIC_BACKEND_URL` | URL do backend no Render (ex: https://paggo-case-api.onrender.com) |
