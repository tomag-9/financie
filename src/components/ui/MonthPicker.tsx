'use client'

import { useEffect, useMemo, useRef, useState } from 'react'

type MonthPickerProps = {
  label?: string
  value: string
  onChange: (value: string) => void
  className?: string
}

const monthNames = [
  'Jan',
  'Feb',
  'Mar',
  'Apr',
  'Máj',
  'Jún',
  'Júl',
  'Aug',
  'Sep',
  'Okt',
  'Nov',
  'Dec',
]

function parseMonthKey(value: string): { year: number; month: number } | null {
  const match = /^(\d{4})-(\d{2})$/.exec(value)
  if (!match) return null

  const year = Number(match[1])
  const month = Number(match[2])
  if (!Number.isInteger(year) || !Number.isInteger(month) || month < 1 || month > 12) {
    return null
  }

  return { year, month: month - 1 }
}

function formatMonthLabel(value: string): string {
  const parsed = parseMonthKey(value)
  if (!parsed) return value

  const date = new Date(Date.UTC(parsed.year, parsed.month, 1))
  return new Intl.DateTimeFormat('sk-SK', {
    month: 'long',
    year: 'numeric',
    timeZone: 'UTC',
  }).format(date)
}

function toMonthKey(year: number, monthIndex: number): string {
  return `${year}-${String(monthIndex + 1).padStart(2, '0')}`
}

function IconChevron({ direction }: { direction: 'left' | 'right' }) {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" className="size-4 fill-none stroke-current stroke-[2.5]">
      {direction === 'left' ? (
        <path d="M15 18l-6-6 6-6" strokeLinecap="round" strokeLinejoin="round" />
      ) : (
        <path d="M9 6l6 6-6 6" strokeLinecap="round" strokeLinejoin="round" />
      )}
    </svg>
  )
}

export function MonthPicker({ label, value, onChange, className = '' }: MonthPickerProps) {
  const wrapperRef = useRef<HTMLDivElement>(null)
  const parsedValue = useMemo(() => parseMonthKey(value), [value])
  const [open, setOpen] = useState(false)
  const [mounted, setMounted] = useState(false)
  const [year, setYear] = useState(parsedValue?.year ?? new Date().getUTCFullYear())

  useEffect(() => {
    setMounted(true)
  }, [])

  useEffect(() => {
    if (parsedValue) {
      setYear(parsedValue.year)
    }
  }, [parsedValue?.year])

  useEffect(() => {
    function onPointerDown(event: MouseEvent) {
      if (!wrapperRef.current?.contains(event.target as Node)) {
        setOpen(false)
      }
    }

    document.addEventListener('mousedown', onPointerDown)
    return () => document.removeEventListener('mousedown', onPointerDown)
  }, [])

  if (!mounted) {
    return (
      <div ref={wrapperRef} className={`relative inline-block text-left ${className}`}>
        <div className="w-full rounded-2xl border border-zinc-200 bg-white px-3 py-3 text-left text-zinc-900 shadow-sm dark:border-zinc-800 dark:bg-zinc-950 dark:text-zinc-100">
          <div className="space-y-1">
            <p className="truncate text-base font-semibold capitalize">{formatMonthLabel(value)}</p>
            {label ? (
              <p className="text-[11px] uppercase tracking-[0.16em] text-zinc-500 dark:text-zinc-400">{label}</p>
            ) : null}
          </div>
        </div>
      </div>
    )
  }

  return (
    <div ref={wrapperRef} className={`relative inline-block text-left ${className}`}>
      <button
        type="button"
        onClick={() => setOpen((prev) => !prev)}
        className="group inline-flex w-full items-center justify-between gap-3 rounded-2xl border border-zinc-200 bg-white px-3 py-3 text-left text-zinc-900 shadow-sm transition hover:border-zinc-300 hover:bg-zinc-50 focus:outline-none focus:ring-2 focus:ring-zinc-400 dark:border-zinc-800 dark:bg-zinc-950 dark:text-zinc-100 dark:hover:border-zinc-700 dark:hover:bg-zinc-900"
        aria-expanded={open}
        aria-label={label ? `${label}: ${formatMonthLabel(value)}` : `Selected month: ${formatMonthLabel(value)}`}
      >
        <span className="min-w-0">
          <span className="block truncate text-base font-semibold capitalize">
            {formatMonthLabel(value)}
          </span>
          {label ? (
            <span className="mt-0.5 block text-[11px] uppercase tracking-[0.16em] text-zinc-500 dark:text-zinc-400">
              {label}
            </span>
          ) : null}
        </span>
        <span className="inline-flex size-10 items-center justify-center rounded-full bg-zinc-100 text-zinc-600 transition group-hover:bg-zinc-200 dark:bg-zinc-900 dark:text-zinc-300 dark:group-hover:bg-zinc-800">
          <svg viewBox="0 0 24 24" aria-hidden="true" className="size-4 fill-none stroke-current stroke-[2.25]">
            <path d="M7 3v4M17 3v4M4 9h16M6 5h12a2 2 0 0 1 2 2v11a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V7a2 2 0 0 1 2-2Z" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </span>
      </button>

      {open ? (
        <div className="absolute left-0 z-40 mt-2 w-[19rem] rounded-3xl border border-zinc-200 bg-white p-3 shadow-[0_24px_80px_rgba(0,0,0,0.18)] dark:border-zinc-800 dark:bg-zinc-950 sm:w-[22rem]">
          <div className="mb-3 flex items-center justify-between gap-2">
            <button
              type="button"
              onClick={() => setYear((prev) => prev - 1)}
              className="inline-flex size-9 items-center justify-center rounded-full border border-zinc-200 bg-zinc-50 text-zinc-700 transition hover:bg-zinc-100 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-200 dark:hover:bg-zinc-800"
              aria-label="Previous year"
            >
              <IconChevron direction="left" />
            </button>

            <div className="text-center">
              <p className="text-[11px] uppercase tracking-[0.2em] text-zinc-500 dark:text-zinc-400">Year</p>
              <p className="text-base font-semibold text-zinc-900 dark:text-zinc-100">{year}</p>
            </div>

            <button
              type="button"
              onClick={() => setYear((prev) => prev + 1)}
              className="inline-flex size-9 items-center justify-center rounded-full border border-zinc-200 bg-zinc-50 text-zinc-700 transition hover:bg-zinc-100 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-200 dark:hover:bg-zinc-800"
              aria-label="Next year"
            >
              <IconChevron direction="right" />
            </button>
          </div>

          <div className="grid grid-cols-3 gap-2">
            {monthNames.map((name, index) => {
              const key = toMonthKey(year, index)
              const isSelected = key === value

              return (
                <button
                  key={name}
                  type="button"
                  onClick={() => {
                    onChange(key)
                    setOpen(false)
                  }}
                  className={`rounded-2xl border px-3 py-2 text-sm font-medium transition ${
                    isSelected
                      ? 'border-zinc-900 bg-zinc-900 text-white dark:border-zinc-100 dark:bg-zinc-100 dark:text-zinc-900'
                      : 'border-zinc-200 bg-zinc-50 text-zinc-700 hover:border-zinc-300 hover:bg-zinc-100 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-200 dark:hover:border-zinc-700 dark:hover:bg-zinc-800'
                  }`}
                >
                  {name}
                </button>
              )
            })}
          </div>
        </div>
      ) : null}
    </div>
  )
}