'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'

export default function LoginPage() {
  const router = useRouter()
  const [login, setLogin] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    setLoading(true)

    await new Promise((r) => setTimeout(r, 400))

    if (login === 'admin123' && password === '1234') {
      document.cookie = 'paggo_auth=ok; path=/; max-age=86400; SameSite=Lax'
      router.push('/inbox')
    } else {
      setError('Login ou senha incorretos.')
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-brand-black flex items-center justify-center relative overflow-hidden px-4">

      {/* Background texture — subtle green grain */}
      <div
        className="absolute inset-0 opacity-[0.03] pointer-events-none"
        style={{
          backgroundImage: `radial-gradient(circle at 1px 1px, #C8FF00 1px, transparent 0)`,
          backgroundSize: '32px 32px',
        }}
      />

      {/* Post-it */}
      <div
        className="absolute bottom-16 right-12 w-44 select-none z-10"
        style={{
          transform: 'rotate(-4deg)',
          filter: 'drop-shadow(2px 4px 8px rgba(0,0,0,0.5))',
        }}
      >
        <div
          className="p-4 text-[11px] leading-relaxed font-mono"
          style={{
            background: 'linear-gradient(160deg, #FFFE87 0%, #F5E642 100%)',
            color: '#1a1a00',
            clipPath: 'polygon(0 0, 100% 0, 100% 85%, 88% 100%, 0 100%)',
            boxShadow: 'inset -8px -10px 12px rgba(0,0,0,0.08)',
          }}
        >
          <p className="font-bold text-[10px] uppercase tracking-wider mb-2 opacity-60">
            credenciais
          </p>
          <p>
            <span className="opacity-60">login</span>
            <br />
            <strong>admin123</strong>
          </p>
          <p className="mt-1.5">
            <span className="opacity-60">senha</span>
            <br />
            <strong>1234</strong>
          </p>
        </div>
        {/* folded corner accent */}
        <div
          className="absolute bottom-0 right-0 w-8 h-8"
          style={{
            background: 'linear-gradient(225deg, #C8B800 0%, #9e8f00 100%)',
            clipPath: 'polygon(100% 0, 100% 100%, 0 100%)',
          }}
        />
      </div>

      {/* Login card */}
      <div className="w-full max-w-sm relative z-20">

        {/* Logo */}
        <div className="text-center mb-10">
          <span
            className="text-5xl font-black tracking-tighter"
            style={{ color: '#C8FF00', letterSpacing: '-0.03em' }}
          >
            paggo
          </span>
          <p className="text-brand-muted text-xs mt-2 tracking-widest uppercase">
            Plataforma de Suporte
          </p>
        </div>

        <form
          onSubmit={handleSubmit}
          className="bg-brand-surface border border-brand-border rounded-2xl p-8 shadow-2xl"
        >
          <h1 className="text-white text-lg font-bold mb-1">Entrar</h1>
          <p className="text-brand-muted text-xs mb-7">
            Acesso restrito à equipe de suporte.
          </p>

          {/* Login field */}
          <div className="mb-4">
            <label className="block text-[10px] font-bold uppercase tracking-widest text-brand-muted mb-2">
              Login
            </label>
            <input
              type="text"
              autoComplete="username"
              value={login}
              onChange={(e) => setLogin(e.target.value)}
              placeholder="seu login"
              className="w-full bg-brand-mid border border-brand-border rounded-lg px-4 py-3 text-sm text-white placeholder-brand-muted/50 focus:outline-none focus:border-brand-green transition-colors"
              required
            />
          </div>

          {/* Password field */}
          <div className="mb-6">
            <label className="block text-[10px] font-bold uppercase tracking-widest text-brand-muted mb-2">
              Senha
            </label>
            <input
              type="password"
              autoComplete="current-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              className="w-full bg-brand-mid border border-brand-border rounded-lg px-4 py-3 text-sm text-white placeholder-brand-muted/50 focus:outline-none focus:border-brand-green transition-colors"
              required
            />
          </div>

          {error && (
            <p className="text-brand-error text-xs mb-4">{error}</p>
          )}

          {/* CTA */}
          <button
            type="submit"
            disabled={loading}
            className="w-full py-3 rounded-lg font-bold text-sm text-brand-black transition-all disabled:opacity-50 cursor-pointer"
            style={{ background: loading ? '#8fb300' : '#C8FF00' }}
          >
            {loading ? 'Entrando...' : 'Entrar →'}
          </button>
        </form>

        <p className="text-center text-brand-muted/40 text-[10px] mt-8 tracking-widest uppercase">
          Paggo University · Tech Internship 2025
        </p>
      </div>
    </div>
  )
}
