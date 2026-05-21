# Paggo Case — Frontend

Next.js 16 (App Router) frontend para o sistema de triagem de tickets de suporte.

Para documentação completa do projeto, veja o [README raiz](../README.md).

## Desenvolvimento

```powershell
$env:PATH = "C:\Program Files\nodejs;$env:PATH"
npm install
npm run dev   # http://localhost:3000
```

Defina `NEXT_PUBLIC_BACKEND_URL` em `.env.local` apontando para o backend. Sem essa variável, usa `http://localhost:8000`.

## Build de produção

```powershell
npx next build
```

## Testes

```powershell
# Unit / component (vitest)
npx vitest run

# E2E (Playwright)
npx playwright test
```

## Estrutura

```
app/
  inbox/page.tsx          kanban board
  tickets/[id]/page.tsx   detalhe do ticket (server component)
  agent/page.tsx          chat com agente de IA
components/
  KanbanBoard.tsx         layout principal, filtros, date picker
  KanbanColumn.tsx        coluna por status
  KanbanCard.tsx          card do ticket
  AlertPanel.tsx          AlertsSidebar + StatsBottomBar + gráficos
  TicketDetailPanel.tsx   painel lateral com todas as ações
  ActionButtons.tsx       atribuir, classificar, responder, fechar, merge
  AgentChat.tsx           UI do agente conversacional
  AuditLog.tsx            histórico de eventos
lib/api.ts                todas as chamadas fetch
types/index.ts            tipos TypeScript compartilhados
__tests__/                testes vitest
e2e/                      testes Playwright
```
