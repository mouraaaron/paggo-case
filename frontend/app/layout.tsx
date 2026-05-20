import type { Metadata } from 'next'
import { Inter } from 'next/font/google'
import Link from 'next/link'
import { LayoutGrid, MessageSquare, Settings } from 'lucide-react'
import './globals.css'

const inter = Inter({
  variable: '--font-inter',
  subsets: ['latin'],
  weight: ['300', '400', '500', '600', '700', '800'],
})

export const metadata: Metadata = {
  title: 'Paggo Support',
  description: 'Sistema de triagem de tickets de suporte',
}

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="pt-BR" className={`${inter.variable} h-full antialiased`}>
      <body className="min-h-full bg-brand-black text-white flex">
        {/* ─── Sidebar ─── */}
        <aside className="w-[60px] min-h-screen bg-brand-black border-r border-brand-border flex flex-col items-center py-4 gap-2 shrink-0 fixed left-0 top-0 bottom-0 z-30">
          {/* Logo */}
          <div className="mb-4 text-center">
            <span className="text-brand-green font-black text-[11px] tracking-[2px] leading-none block">PU</span>
            <span className="text-brand-muted text-[8px] tracking-wider">paggo</span>
          </div>

          {/* Nav items */}
          <NavItem href="/inbox" icon={<LayoutGrid size={18} />} label="Inbox" />
          <NavItem href="/agent" icon={<MessageSquare size={18} />} label="Agente IA" />

          {/* Bottom */}
          <div className="mt-auto">
            <NavItem href="#" icon={<Settings size={16} />} label="Config" />
          </div>
        </aside>

        {/* ─── Main content offset by sidebar width ─── */}
        <main className="ml-[60px] flex-1 min-h-screen flex flex-col">
          {children}
        </main>
      </body>
    </html>
  )
}

function NavItem({
  href,
  icon,
  label,
}: {
  href: string
  icon: React.ReactNode
  label: string
}) {
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
