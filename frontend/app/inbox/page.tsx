import { KanbanBoard } from '@/components/KanbanBoard'

export default function InboxPage() {
  return (
    <main className="p-6">
      <div className="mb-4">
        <h1 className="text-2xl font-bold">Inbox de Suporte</h1>
        <p className="text-gray-500 text-sm">
          Tickets ordenados por risco — os mais críticos aparecem primeiro
        </p>
      </div>
      <KanbanBoard />
    </main>
  )
}
