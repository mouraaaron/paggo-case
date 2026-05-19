import { TicketTable } from '@/components/TicketTable'

export default function InboxPage() {
  return (
    <main className="p-6">
      <h1 className="text-2xl font-bold mb-1">Inbox de Suporte</h1>
      <p className="text-gray-500 text-sm mb-4">Tickets ordenados por risco — os mais críticos aparecem primeiro</p>
      <TicketTable />
    </main>
  )
}
