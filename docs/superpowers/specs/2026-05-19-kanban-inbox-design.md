# Kanban Inbox — Design Spec

**Data:** 2026-05-19
**Escopo:** Substituir a tabela da `/inbox` por um kanban board, mantendo toggle para a view de tabela original.

---

## Objetivo

Transformar a view de inbox de uma tabela paginada em um kanban board com colunas por status, drag & drop com validação de máquina de estados, e painel lateral de detalhes. Toda a lógica de triagem, risk score, filtros e ações existentes é preservada.

---

## Componentes novos

| Arquivo | Tipo | Responsabilidade |
|---|---|---|
| `frontend/components/KanbanBoard.tsx` | `'use client'` | Dono dos filtros, queries por coluna, DnD context |
| `frontend/components/KanbanColumn.tsx` | `'use client'` | Renderiza uma coluna, scroll vertical independente |
| `frontend/components/KanbanCard.tsx` | `'use client'` | Renderiza um card com todos os indicadores visuais |
| `frontend/components/TicketSidePanel.tsx` | `'use client'` | Painel lateral de detalhes (reutiliza ActionButtons + AuditLog) |
| `frontend/lib/stateMachine.ts` | utilitário | Replica VALID_TRANSITIONS para validação local no frontend |

**Modificados:**
- `frontend/app/inbox/page.tsx` — adiciona toggle Kanban ↔ Tabela
- `TicketTable.tsx` — **não alterado**

---

## Carregamento de dados

- 6 queries em paralelo no mount, uma por status: `NEW`, `TRIAGED`, `IN_PROGRESS`, `WAITING_CUSTOMER`, `RESOLVED`, `CLOSED`
- A query de `IN_PROGRESS` usa filtro `status=in.(IN_PROGRESS,ESCALATED)` para incluir tickets escalados
- Cada query: `limit=50`, `sort_by=risk_score`, `sort_desc=true`
- Quando qualquer filtro muda, todas as 6 queries são refeitas em paralelo
- `ESCALATED` não é coluna separada — é renderizado dentro de `IN_PROGRESS` com badge laranja

---

## Filtros

Todos os filtros existentes são preservados e reposicionados acima do board:
- Segmento, Prioridade, Flag, Assignee (aplicados em todas as colunas)
- **Filtro de status** vira toggle de visibilidade de coluna (checkbox por status para mostrar/ocultar)

---

## Colunas

Ordem: `NEW → TRIAGED → IN_PROGRESS → WAITING_CUSTOMER → RESOLVED → CLOSED`

- Header: nome do status + contagem de tickets carregados
- Scroll vertical independente por coluna
- Scroll horizontal no board em viewports menores (`overflow-x: auto` no container)
- Largura fixa por coluna: `w-72` (288px)

---

## Cards

Conteúdo de cada card:
- Linha 1: `#ticket_id` · badge de segmento (ENT/MID/SMB) · badge de prioridade · 🔥 se URGENT
- Linha 2: assunto (truncado em 2 linhas)
- Linha 3: nome do cliente · categoria
- Linha 4: barra visual de risk score (verde/amarelo/vermelho) + número
- Linha 5: tempo sem resposta (`timeAgo`) · assignee ou badge "Não atribuído"
- Linha 6: badges de triage flags

**Borda lateral esquerda (4px):**
- `risk_score ≥ 70` → `border-red-500`
- `CHURN_SIGNAL` nas flags → `border-pink-500`
- Ambos → `border-red-500` (risco prevalece)
- Nenhum → `border-gray-200`

**Outros indicadores:**
- `assigned_to === null` → borda tracejada (`border-dashed`) + badge "Não atribuído"
- `status === 'ESCALATED'` → badge laranja "ESCALADO" no card
- Barra de risk score: `bg-green-500` (0–29), `bg-yellow-400` (30–69), `bg-red-500` (70–100)

Clicar no card → abre `TicketSidePanel` (não navega para `/tickets/[id]`)

---

## Drag & Drop

**Biblioteca:** `@dnd-kit/core` + `@dnd-kit/sortable`

**Fluxo ao soltar:**
1. Move o card otimisticamente na UI
2. Valida localmente com `canTransition(statusAtual, statusDestino)` de `lib/stateMachine.ts`
   - Inválida → reverte card, exibe toast de erro
3. Chama `PATCH /tickets/{id}/status`
   - 422 → reverte card, exibe mensagem do backend
   - Sucesso → mantém card, atualiza contagem da coluna
4. Drag entre colunas não reordena por posição — cards mantêm ordenação por `risk_score` desc

---

## Painel lateral (TicketSidePanel)

- Abre pela direita sobre o board (não navega de página)
- Largura: `w-[480px]`, overlay semitransparente no fundo
- Conteúdo: mesmo layout de `/tickets/[id]` — informações do cliente, corpo do ticket, tabs Ações / Audit Log
- Reutiliza `ActionButtons` e `AuditLog` existentes
- Ao executar uma ação, atualiza o card correspondente no board via callback `onUpdate`
- Fechar: botão ✕ ou clicar no overlay

---

## Toggle Kanban ↔ Tabela

- Botão no topo da página: "Kanban" / "Tabela"
- Preferência salva em `localStorage` com chave `inbox_view`
- Padrão: `kanban`

---

## Estado não alterado

- Nenhuma rota de API
- Nenhuma lógica de banco de dados
- Nenhuma regra de triagem ou cálculo de score
- Schema do banco
- `TicketTable.tsx`
- Rota `/tickets/[id]` (continua funcionando normalmente)
