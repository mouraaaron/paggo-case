'use client'

import { useState, useEffect } from 'react'
import { TicketTable } from '@/components/TicketTable'
import { KanbanBoard } from '@/components/KanbanBoard'

type ViewMode = 'kanban' | 'table'

export default function InboxPage() {
  const [view, setView] = useState<ViewMode>('kanban')

  useEffect(() => {
    const saved = localStorage.getItem('inbox_view') as ViewMode | null
    if (saved === 'kanban' || saved === 'table') setView(saved)
  }, [])

  function switchView(v: ViewMode) {
    setView(v)
    localStorage.setItem('inbox_view', v)
  }

  return (
    <main className="p-6">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h1 className="text-2xl font-bold">Inbox de Suporte</h1>
          <p className="text-gray-500 text-sm">
            Tickets ordenados por risco — os mais críticos aparecem primeiro
          </p>
        </div>
        <div className="flex rounded overflow-hidden border border-gray-200">
          <button
            onClick={() => switchView('kanban')}
            className={`px-3 py-1.5 text-sm font-medium transition-colors ${
              view === 'kanban'
                ? 'bg-blue-600 text-white'
                : 'text-gray-600 hover:bg-gray-50'
            }`}
          >
            Kanban
          </button>
          <button
            onClick={() => switchView('table')}
            className={`px-3 py-1.5 text-sm font-medium transition-colors border-l border-gray-200 ${
              view === 'table'
                ? 'bg-blue-600 text-white'
                : 'text-gray-600 hover:bg-gray-50'
            }`}
          >
            Tabela
          </button>
        </div>
      </div>

      {view === 'kanban' ? <KanbanBoard /> : <TicketTable />}
    </main>
  )
}
