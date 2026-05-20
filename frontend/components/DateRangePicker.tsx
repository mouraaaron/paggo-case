'use client'

import { useState, useRef, useEffect } from 'react'
import { CalendarIcon, ChevronLeft, ChevronRight, X } from 'lucide-react'

interface DateRangePickerProps {
  onRangeChange: (from: string | undefined, to: string | undefined) => void
}

const MONTHS = [
  'Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
  'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro',
]
const WEEKDAYS = ['D', 'S', 'T', 'Q', 'Q', 'S', 'S']

function norm(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate())
}

function toYMD(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

function label(d: Date): string {
  return d.toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' })
}

function daysInMonth(year: number, month: number): (Date | null)[] {
  const firstPad = new Date(year, month, 1).getDay()
  const total = new Date(year, month + 1, 0).getDate()
  const cells: (Date | null)[] = Array(firstPad).fill(null)
  for (let i = 1; i <= total; i++) cells.push(new Date(year, month, i))
  return cells
}

export function DateRangePicker({ onRangeChange }: DateRangePickerProps) {
  const today = norm(new Date())
  const [open, setOpen] = useState(false)
  const [view, setView] = useState({ year: today.getFullYear(), month: today.getMonth() })
  const [start, setStart] = useState<Date | null>(null)
  const [end, setEnd] = useState<Date | null>(null)
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
    if (!start || (start && end)) {
      setStart(d)
      setEnd(null)
    } else {
      const s = norm(start)
      if (d < s) {
        setStart(d); setEnd(s)
        onRangeChange(toYMD(d), toYMD(s))
      } else if (d > s) {
        setEnd(d)
        onRangeChange(toYMD(s), toYMD(d))
      }
      setOpen(false)
    }
  }

  function clear(e: React.MouseEvent) {
    e.stopPropagation()
    setStart(null); setEnd(null)
    onRangeChange(undefined, undefined)
  }

  function prevMonth() {
    setView(v => v.month === 0 ? { year: v.year - 1, month: 11 } : { ...v, month: v.month - 1 })
  }

  function nextMonth() {
    setView(v => v.month === 11 ? { year: v.year + 1, month: 0 } : { ...v, month: v.month + 1 })
  }

  function dayClass(day: Date): string {
    const d = norm(day)
    const s = start ? norm(start) : null
    const e = end ? norm(end) : (hover ? norm(hover) : null)

    const isStart = s && d.getTime() === s.getTime()
    const isEnd = end && e && d.getTime() === e.getTime()
    const inRange = s && e && d > s && d < e

    if (isStart || isEnd) return 'bg-brand-green text-brand-black font-bold rounded-full'
    if (inRange) return 'bg-brand-green/20 text-white rounded-sm'
    return 'text-brand-muted hover:text-white hover:bg-brand-mid rounded-full'
  }

  const btnLabel = start
    ? end ? `${label(start)} – ${label(end)}` : `${label(start)} – ?`
    : 'Período'

  const cells = daysInMonth(view.year, view.month)

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen(o => !o)}
        className={`flex items-center gap-1.5 bg-brand-mid border px-2 py-1.5 rounded text-xs focus:outline-none cursor-pointer transition-colors ${
          open ? 'border-brand-green text-white' : 'border-brand-border text-brand-muted hover:border-brand-green'
        }`}
      >
        <CalendarIcon size={12} className={start ? 'text-brand-green' : ''} />
        <span className={start ? 'text-white' : ''}>{btnLabel}</span>
        {start && (
          <span onClick={clear} className="ml-0.5 text-brand-muted hover:text-white cursor-pointer">
            <X size={10} />
          </span>
        )}
      </button>

      {open && (
        <div className="absolute top-full left-0 mt-1.5 z-50 bg-brand-surface border border-brand-border rounded-xl shadow-2xl p-3 w-[252px] select-none">
          {/* Month nav */}
          <div className="flex items-center justify-between mb-3">
            <button
              onClick={prevMonth}
              className="w-6 h-6 flex items-center justify-center rounded text-brand-muted hover:text-white hover:bg-brand-mid cursor-pointer transition-colors"
            >
              <ChevronLeft size={13} />
            </button>
            <span className="text-xs font-semibold text-white">
              {MONTHS[view.month]} {view.year}
            </span>
            <button
              onClick={nextMonth}
              className="w-6 h-6 flex items-center justify-center rounded text-brand-muted hover:text-white hover:bg-brand-mid cursor-pointer transition-colors"
            >
              <ChevronRight size={13} />
            </button>
          </div>

          {/* Weekday row */}
          <div className="grid grid-cols-7 mb-1">
            {WEEKDAYS.map((d, i) => (
              <div key={i} className="text-center text-[9px] text-brand-muted font-semibold py-0.5">{d}</div>
            ))}
          </div>

          {/* Day cells */}
          <div className="grid grid-cols-7 gap-y-0.5">
            {cells.map((day, i) =>
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
              ) : (
                <div key={i} />
              )
            )}
          </div>

          {/* Hint */}
          <p className="text-[9px] text-brand-muted text-center mt-2 h-3">
            {!start ? 'Selecione a data inicial' : !end ? 'Selecione a data final' : null}
          </p>
        </div>
      )}
    </div>
  )
}
