import AgentChat from '@/components/AgentChat'
import { AuthGuard } from '@/components/AuthGuard'

export default function AgentPage() {
  return (
    <AuthGuard>
      <div className="h-screen flex flex-col">
        <AgentChat />
      </div>
    </AuthGuard>
  )
}
