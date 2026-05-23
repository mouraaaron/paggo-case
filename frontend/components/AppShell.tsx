'use client'

import { usePathname } from 'next/navigation'
import { AppSidebar } from './AppSidebar'

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()
  const isLogin = pathname.startsWith('/login')

  return (
    <>
      <AppSidebar />
      <main className={`${isLogin ? '' : 'ml-[60px]'} flex-1 min-h-screen flex flex-col`}>
        {children}
      </main>
    </>
  )
}
