import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { timeAgo, flagLabel } from '@/components/AlertPanel'

// ─── timeAgo ──────────────────────────────────────────────────────────────────

describe('timeAgo', () => {
  const NOW = new Date('2024-06-15T12:00:00Z').getTime()

  beforeEach(() => {
    vi.useFakeTimers()
    vi.setSystemTime(NOW)
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('returns em dash for null input', () => {
    expect(timeAgo(null)).toBe('—')
  })

  it('returns minutes for age < 1 hour', () => {
    const date = new Date(NOW - 30 * 60 * 1000).toISOString()   // 30 min ago
    expect(timeAgo(date)).toBe('30m')
  })

  it('returns 0m for very recent timestamps', () => {
    const date = new Date(NOW - 45 * 1000).toISOString()  // 45 seconds ago
    expect(timeAgo(date)).toBe('0m')
  })

  it('returns hours for age between 1h and 24h', () => {
    const date = new Date(NOW - 5 * 3600 * 1000).toISOString()  // 5 hours ago
    expect(timeAgo(date)).toBe('5h')
  })

  it('returns days for age >= 24 hours', () => {
    const date = new Date(NOW - 3 * 86400 * 1000).toISOString()  // 3 days ago
    expect(timeAgo(date)).toBe('3d')
  })

  it('switches from h to d at exactly 24 hours', () => {
    const date = new Date(NOW - 24 * 3600 * 1000).toISOString()
    expect(timeAgo(date)).toBe('1d')
  })

  it('switches from m to h at exactly 1 hour', () => {
    const date = new Date(NOW - 3600 * 1000).toISOString()
    expect(timeAgo(date)).toBe('1h')
  })
})

// ─── flagLabel ────────────────────────────────────────────────────────────────

describe('flagLabel', () => {
  it('returns churn unassigned label for CHURN_UNASSIGNED flag', () => {
    expect(flagLabel(['CHURN_UNASSIGNED'])).toBe('CHURN · SEM AGENTE')
  })

  it('returns ENT reply label for ENT_NO_REPLY_2H flag', () => {
    expect(flagLabel(['ENT_NO_REPLY_2H'])).toBe('ENT · SEM REPLY')
  })

  it('returns churn signal label for CHURN_SIGNAL flag', () => {
    expect(flagLabel(['CHURN_SIGNAL'])).toBe('CHURN · COM AGENTE')
  })

  it('returns MID reply label for MID_NO_REPLY_2H flag', () => {
    expect(flagLabel(['MID_NO_REPLY_2H'])).toBe('MID · SEM REPLY')
  })

  it('returns multiple open label for MULTIPLE_OPEN flag', () => {
    expect(flagLabel(['MULTIPLE_OPEN'])).toBe('MÚLTIPLOS ABERTOS')
  })

  it('returns stale label for STALE_IN_PROGRESS flag', () => {
    expect(flagLabel(['STALE_IN_PROGRESS'])).toBe('PARADO')
  })

  it('returns default high risk label for unknown flags', () => {
    expect(flagLabel(['SOME_OTHER_FLAG'])).toBe('RISCO ALTO')
  })

  it('returns default label for empty array', () => {
    expect(flagLabel([])).toBe('RISCO ALTO')
  })

  it('CHURN_UNASSIGNED takes priority over other flags', () => {
    expect(flagLabel(['STALE_IN_PROGRESS', 'CHURN_UNASSIGNED'])).toBe('CHURN · SEM AGENTE')
  })
})
