import { KanbanBoard } from '@/components/KanbanBoard'
import { AuthGuard } from '@/components/AuthGuard'

export default function InboxPage() {
  return (
    <AuthGuard>
      <div className="flex flex-col min-h-screen">
        <KanbanBoard />
      </div>
    </AuthGuard>
  )
}
