'use client'

import { useState, useRef, useEffect } from 'react'
import { Calendar, ChevronLeft, ChevronRight, X } from 'lucide-react'

interface DateRangePickerProps {
  onRangeChange: (from: string | undefined, to: string | undefined) => void
  initialFrom?: string
  initialTo?: string
}

const MONTHS = [
  'Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
  'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro',
]
const WEEKDAYS = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb']

function norm(d: Date) {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate())
}
function toYMD(d: Date) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}
function fmt(d: Date) {
  return d.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric' })
}
function monthCells(year: number, month: number): (Date | null)[] {
  const pad = new Date(year, month, 1).getDay()
  const total = new Date(year, month + 1, 0).getDate()
  const cells: (Date | null)[] = Array(pad).fill(null)
  for (let i = 1; i <= total; i++) cells.push(new Date(year, month, i))
  return cells
}

const MIN = norm(new Date(2026, 0, 1))   // 1 jan 2026
const MAX = norm(new Date(2026, 2, 31))  // 31 mar 2026

function parseYMD(s: string): Date {
  const [y, m, d] = s.split('-').map(Number)
  return new Date(y, m - 1, d)
}

export function DateRangePicker({ onRangeChange, initialFrom, initialTo }: DateRangePickerProps) {
  const today = norm(new Date())
  const [open, setOpen] = useState(false)
  const initStart = initialFrom ? norm(parseYMD(initialFrom)) : null
  const initEnd = initialTo ? norm(parseYMD(initialTo)) : null
  const [view, setView] = useState(
    initStart
      ? { year: initStart.getFullYear(), month: initStart.getMonth() }
      : { year: 2026, month: 0 }
  )
  const [start, setStart] = useState<Date | null>(initStart)
  const [end, setEnd] = useState<Date | null>(initEnd)
  const [hover, setHover] = useState<Date | null>(null)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    function onDown(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', onDown)
    return () => document.removeEventListener('mousedown', onDown)
  }, [])

  function pickDay(day: Date) {
    const d = norm(day)
    if (d < MIN || d > MAX) return
    if (!start || end) {
      setStart(d)
      setEnd(null)
    } else {
      const s = norm(start)
      if (d.getTime() === s.getTime()) return
      if (d < s) {
        setStart(d); setEnd(s)
        onRangeChange(toYMD(d), toYMD(s))
      } else {
        setEnd(d)
        onRangeChange(toYMD(s), toYMD(d))
      }
    }
  }

  function clear(e: React.MouseEvent) {
    e.stopPropagation()
    setStart(null); setEnd(null); setHover(null)
    onRangeChange(undefined, undefined)
  }

  const atMin = view.year === MIN.getFullYear() && view.month === MIN.getMonth()
  const atMax = view.year === MAX.getFullYear() && view.month === MAX.getMonth()

  function prevMonth() {
    if (atMin) return
    setView(v => v.month === 0 ? { year: v.year - 1, month: 11 } : { ...v, month: v.month - 1 })
  }
  function nextMonth() {
    if (atMax) return
    setView(v => v.month === 11 ? { year: v.year + 1, month: 0 } : { ...v, month: v.month + 1 })
  }

  function dayClass(day: Date) {
    const d = norm(day)
    if (d < MIN || d > MAX) return 'text-brand-border cursor-not-allowed'
    const s = start ? norm(start) : null
    const e = end ? norm(end) : (start && hover ? norm(hover) : null)
    const isStart = s && d.getTime() === s.getTime()
    const isEnd = e && d.getTime() === e.getTime()
    const inRange = s && e && d > s && d < e
    if (isStart) return 'bg-brand-green text-brand-black font-bold rounded-l-full'
    if (isEnd) return 'bg-brand-green text-brand-black font-bold rounded-r-full'
    if (inRange) return 'bg-brand-green/20 text-white'
    if (d.getTime() === today.getTime()) return 'text-brand-green font-semibold hover:bg-brand-mid rounded-full'
    return 'text-brand-muted hover:text-white hover:bg-brand-mid rounded-full'
  }

  const hasRange = start && end
  const step = !start ? 1 : !end ? 2 : null

  return (
    <div ref={ref} className="relative">
      {/* Trigger — styled like the other filter selects */}
      <button
        onClick={() => setOpen(o => !o)}
        className={`flex items-center gap-2 bg-brand-mid border px-3 py-1.5 rounded text-xs focus:outline-none cursor-pointer transition-colors ${
          open ? 'border-brand-green' : 'border-brand-border hover:border-brand-green/50'
        }`}
      >
        <Calendar size={12} className="text-brand-muted shrink-0" />
        {hasRange ? (
          <>
            <span className="text-white">{fmt(start!)} → {fmt(end!)}</span>
            <span onClick={clear} className="text-brand-muted hover:text-white ml-1 cursor-pointer">
              <X size={10} />
            </span>
          </>
        ) : (
          <span className="text-brand-muted">Período</span>
        )}
      </button>

      {/* Dropdown calendar */}
      {open && (
        <div className="absolute top-full left-0 mt-1.5 z-50 bg-brand-surface border border-brand-border rounded-xl shadow-2xl select-none overflow-hidden w-[300px]">

          {/* Selected range display */}
          <div className="grid grid-cols-2 border-b border-brand-border">
            <div className={`px-3 py-2.5 border-r border-brand-border ${step === 1 ? 'bg-brand-green/5' : ''}`}>
              <p className="text-[9px] font-bold uppercase tracking-wider text-brand-muted mb-0.5">Início</p>
              <p className={`text-xs font-semibold ${start ? 'text-brand-green' : 'text-brand-muted'}`}>
                {start ? fmt(start) : '— / — / ——'}
              </p>
            </div>
            <div className={`px-3 py-2.5 ${step === 2 ? 'bg-brand-green/5' : ''}`}>
              <p className="text-[9px] font-bold uppercase tracking-wider text-brand-muted mb-0.5">Fim</p>
              <p className={`text-xs font-semibold ${end ? 'text-brand-green' : 'text-brand-muted'}`}>
                {end ? fmt(end) : '— / — / ——'}
              </p>
            </div>
          </div>

          {/* Month header */}
          <div className="flex items-center justify-between px-4 py-2.5">
            <button
              onClick={prevMonth}
              disabled={atMin}
              className="w-6 h-6 flex items-center justify-center rounded transition-colors disabled:opacity-20 disabled:cursor-not-allowed text-brand-muted hover:text-white hover:bg-brand-mid cursor-pointer"
            >
              <ChevronLeft size={13} />
            </button>
            <span className="text-xs font-bold text-white">
              {MONTHS[view.month]} {view.year}
            </span>
            <button
              onClick={nextMonth}
              disabled={atMax}
              className="w-6 h-6 flex items-center justify-center rounded transition-colors disabled:opacity-20 disabled:cursor-not-allowed text-brand-muted hover:text-white hover:bg-brand-mid cursor-pointer"
            >
              <ChevronRight size={13} />
            </button>
          </div>

          {/* Weekday labels */}
          <div className="grid grid-cols-7 px-2 mb-1">
            {WEEKDAYS.map((d, i) => (
              <div key={i} className="text-center text-[9px] text-brand-muted font-semibold py-0.5">{d}</div>
            ))}
          </div>

          {/* Days */}
          <div className="grid grid-cols-7 px-2 pb-3 gap-y-0.5">
            {monthCells(view.year, view.month).map((day, i) =>
              day ? (
                <button
                  key={i}
                  onClick={() => pickDay(day)}
                  onMouseEnter={() => start && !end && setHover(norm(day))}
                  onMouseLeave={() => setHover(null)}
                  className={`text-[11px] h-7 w-full flex items-center justify-center cursor-pointer transition-colors ${dayClass(day)}`}
                >
                  {day.getDate()}
                </button>
              ) : <div key={i} />
            )}
          </div>

          {/* Status hint */}
          {step && (
            <div className="px-4 py-2 border-t border-brand-border bg-brand-black">
              <p className="text-[10px] text-brand-muted text-center">
                {step === 1
                  ? '← Clique em um dia para definir a data de início'
                  : '← Clique em outro dia para definir a data de fim'}
              </p>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
