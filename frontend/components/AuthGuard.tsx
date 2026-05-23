'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'

export function AuthGuard({ children }: { children: React.ReactNode }) {
  const router = useRouter()
  const [authorized, setAuthorized] = useState(false)

  useEffect(() => {
    const hasAuth = document.cookie
      .split('; ')
      .some((c) => c.trim() === 'paggo_auth=ok')

    if (!hasAuth) {
      router.replace('/login')
    } else {
      setAuthorized(true)
    }
  }, [router])

  if (!authorized) return null

  return <>{children}</>
}
