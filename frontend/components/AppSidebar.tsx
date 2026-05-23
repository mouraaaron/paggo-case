'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { LayoutGrid, MessageSquare, Settings } from 'lucide-react'

function NavItem({ href, icon, label }: { href: string; icon: React.ReactNode; label: string }) {
  return (
    <Link
      href={href}
      title={label}
      className="w-10 h-10 rounded-lg flex items-center justify-center text-brand-muted hover:text-white hover:bg-brand-surface transition-colors duration-150 cursor-pointer"
    >
      {icon}
    </Link>
  )
}

export function AppSidebar() {
  const pathname = usePathname()

  if (pathname.startsWith('/login')) return null

  return (
    <aside className="w-[60px] min-h-screen bg-brand-black border-r border-brand-border flex flex-col items-center py-4 gap-2 shrink-0 fixed left-0 top-0 bottom-0 z-30">
      <div className="mb-4 text-center">
        <span className="text-brand-green font-black text-[11px] tracking-[2px] leading-none block">PU</span>
        <span className="text-brand-muted text-[8px] tracking-wider">paggo</span>
      </div>
      <NavItem href="/inbox" icon={<LayoutGrid size={18} />} label="Inbox" />
      <NavItem href="/agent" icon={<MessageSquare size={18} />} label="Agente IA" />
      <div className="mt-auto">
        <NavItem href="#" icon={<Settings size={16} />} label="Config" />
      </div>
    </aside>
  )
}
