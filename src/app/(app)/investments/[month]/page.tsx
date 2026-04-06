'use client'

import { useEffect, useMemo, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'

type MonthRow = {
  investmentId: string
  ticker: string
  name: string
  platform: string
  assetType: string
  currentUnits: number
  avgPrice: number | null
  entry: {
    id: string
    entryType: string
    unitsAdded: number
    amountAdded: number
    priceAtTime: number | null
  } | null
}

type DraftRow = {
  entryType: string
  unitsAdded: string
  amountAdded: string
  priceAtTime: string
}

const currencyFormatter = new Intl.NumberFormat('sk-SK', {
  style: 'currency',
  currency: 'EUR',
  maximumFractionDigits: 2,
})

const monthTitleFormatter = new Intl.DateTimeFormat('sk-SK', {
  month: 'long',
  year: 'numeric',
  timeZone: 'UTC',
})

function icon(svgPath: string) {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" className="size-4 fill-none stroke-current stroke-2">
      <path d={svgPath} strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

function currentMonthKeyUtc(): string {
  const now = new Date()
  return `${now.getUTCFullYear()}-${String(now.getUTCMonth() + 1).padStart(2, '0')}`
}

function parseMonthKey(value: string): Date | null {
  const match = /^(\d{4})-(\d{2})$/.exec(value)
  if (!match) return null

  const year = Number(match[1])
  const month = Number(match[2])
  if (!Number.isInteger(year) || !Number.isInteger(month) || month < 1 || month > 12) return null

  return new Date(Date.UTC(year, month - 1, 1))
}

export default function InvestmentsMonthPage() {
  const params = useParams<{ month?: string }>()
  const router = useRouter()

  const initialMonth = typeof params.month === 'string' && /^\d{4}-\d{2}$/.test(params.month)
    ? params.month
    : currentMonthKeyUtc()

  const [month, setMonth] = useState(initialMonth)
  const [rows, setRows] = useState<MonthRow[]>([])
  const [drafts, setDrafts] = useState<Record<string, DraftRow>>({})
  const [totalInvested, setTotalInvested] = useState(0)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (month !== initialMonth) {
      router.replace(`/investments/${month}`)
    }
  }, [initialMonth, month, router])

  async function loadMonth(targetMonth: string) {
    setLoading(true)
    setError(null)

    try {
      const response = await fetch(`/api/investments/entries?month=${targetMonth}`, { cache: 'no-store' })
      const data = await response.json()
      if (!response.ok) {
        throw new Error(data.error ?? 'Failed to load monthly investments.')
      }

      const nextRows = (data.rows ?? []) as MonthRow[]
      setRows(nextRows)
      setTotalInvested(Number(data.totalInvested ?? 0))

      const nextDrafts: Record<string, DraftRow> = {}
      for (const row of nextRows) {
        nextDrafts[row.investmentId] = {
            entryType: row.entry?.entryType ?? 'RECURRING',
          unitsAdded: row.entry ? String(row.entry.unitsAdded) : '',
          amountAdded: row.entry ? String(row.entry.amountAdded) : '',
          priceAtTime: row.entry?.priceAtTime != null ? String(row.entry.priceAtTime) : '',
        }
      }
      setDrafts(nextDrafts)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load monthly investments.')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    void loadMonth(month)
  }, [month])

  const monthDate = useMemo(() => parseMonthKey(month), [month])

  const draftMonthTotal = useMemo(() => {
    return Object.values(drafts).reduce((acc, draft) => {
      const value = Number(draft.amountAdded.trim().replace(',', '.'))
      return acc + (Number.isFinite(value) && value >= 0 ? value : 0)
    }, 0)
  }, [drafts])

  async function saveAll() {
    setSaving(true)
    setError(null)
    setMessage(null)

    try {
      const response = await fetch('/api/investments/entries', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          month,
          rows: rows.map((row) => ({
            investmentId: row.investmentId,
            entryType: drafts[row.investmentId]?.entryType ?? 'RECURRING',
            unitsAdded: drafts[row.investmentId]?.unitsAdded ?? '',
            amountAdded: drafts[row.investmentId]?.amountAdded ?? '',
            priceAtTime: drafts[row.investmentId]?.priceAtTime ?? '',
          })),
        }),
      })

      const data = await response.json()
      if (!response.ok) {
        throw new Error(data.error ?? 'Failed to save monthly investments.')
      }

      setMessage('Monthly investments saved.')
      setTotalInvested(Number(data.totalInvested ?? 0))
      await loadMonth(month)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save monthly investments.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <section className="space-y-5">
      <header className="space-y-2">
        <h2 className="text-2xl font-semibold tracking-tight">Monthly investments</h2>
        <div className="flex flex-wrap items-center gap-2">
          <span className="inline-flex items-center gap-1 rounded-full bg-zinc-100 px-2 py-1 text-xs font-medium text-zinc-700 dark:bg-zinc-800 dark:text-zinc-200">
            {icon('M8 2v4M16 2v4M3 10h18M5 6h14a2 2 0 0 1 2 2v10a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2Z')}
            {monthDate ? monthTitleFormatter.format(monthDate) : month}
          </span>
          <span className="inline-flex items-center gap-1 rounded-full bg-emerald-100 px-2 py-1 text-xs font-medium text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300">
            {icon('M4 12h16M4 12l4 4m-4-4 4-4')}
            Saved {currencyFormatter.format(totalInvested)}
          </span>
          <span className="inline-flex items-center gap-1 rounded-full bg-sky-100 px-2 py-1 text-xs font-medium text-sky-700 dark:bg-sky-900/40 dark:text-sky-300">
            {icon('M3 17l6-6 4 4 8-8')}
            Preview {currencyFormatter.format(draftMonthTotal)}
          </span>
        </div>
      </header>

      <div className="rounded-xl border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-900">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
          <label htmlFor="investments-month-picker" className="text-sm font-medium text-zinc-700 dark:text-zinc-200">
            Month
          </label>
          <input
            id="investments-month-picker"
            type="month"
            value={month}
            onChange={(event) => setMonth(event.target.value)}
            className="rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 outline-none focus:border-zinc-500 dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-100"
          />
        </div>
      </div>

      {message ? (
        <p className="rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-700 dark:border-emerald-900 dark:bg-emerald-950/30 dark:text-emerald-300">
          {message}
        </p>
      ) : null}

      {error ? (
        <p className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700 dark:border-rose-900 dark:bg-rose-950/30 dark:text-rose-300">
          {error}
        </p>
      ) : null}

      {loading ? (
        <p className="rounded-xl border border-zinc-200 bg-white p-4 text-sm text-zinc-600 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-300">
          Loading investment records...
        </p>
      ) : rows.length === 0 ? (
        <p className="rounded-xl border border-zinc-200 bg-white p-4 text-sm text-zinc-600 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-300">
          Create investment positions in Investments first.
        </p>
      ) : (
        <div className="space-y-3">
          {rows.map((row) => {
            const draft = drafts[row.investmentId] ?? { unitsAdded: '', amountAdded: '', priceAtTime: '' }
            return (
              <article key={row.investmentId} className="rounded-xl border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-900">
                <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <p className="font-medium text-zinc-900 dark:text-zinc-100">{row.ticker} · {row.name}</p>
                    <p className="text-xs text-zinc-500 dark:text-zinc-400">
                      {row.platform} · {row.assetType} · Current units {row.currentUnits.toFixed(4)} · Avg {row.avgPrice ? currencyFormatter.format(row.avgPrice) : 'N/A'}
                    </p>
                  </div>
                  <label className="inline-flex items-center gap-2 rounded-full border border-zinc-300 px-2 py-1 text-xs font-medium text-zinc-700 dark:border-zinc-700 dark:text-zinc-200">
                    <span className="text-zinc-500 dark:text-zinc-400">Mode</span>
                    <select
                      value={draft.entryType}
                      onChange={(event) => {
                        const value = event.target.value
                        setDrafts((prev) => ({
                          ...prev,
                          [row.investmentId]: {
                            ...draft,
                            entryType: value,
                          },
                        }))
                      }}
                      className="rounded-md border border-zinc-300 bg-white px-2 py-1 text-xs text-zinc-900 outline-none dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-100"
                    >
                      <option value="RECURRING">Recurring</option>
                      <option value="ONE_OFF">One-off</option>
                    </select>
                  </label>
                </div>

                <div className="grid gap-2 sm:grid-cols-3">
                  <input
                    type="number"
                    inputMode="decimal"
                    min="0"
                    step="0.0001"
                    value={draft.unitsAdded}
                    onChange={(event) => {
                      const value = event.target.value
                      setDrafts((prev) => ({
                        ...prev,
                        [row.investmentId]: {
                          ...draft,
                          unitsAdded: value,
                        },
                      }))
                    }}
                    placeholder="Units added"
                    className="rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 outline-none focus:border-zinc-500 dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-100"
                  />
                  <input
                    type="number"
                    inputMode="decimal"
                    min="0"
                    step="0.01"
                    value={draft.amountAdded}
                    onChange={(event) => {
                      const value = event.target.value
                      setDrafts((prev) => ({
                        ...prev,
                        [row.investmentId]: {
                          ...draft,
                          amountAdded: value,
                        },
                      }))
                    }}
                    placeholder="Amount invested"
                    className="rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 outline-none focus:border-zinc-500 dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-100"
                  />
                  <input
                    type="number"
                    inputMode="decimal"
                    min="0"
                    step="0.01"
                    value={draft.priceAtTime}
                    onChange={(event) => {
                      const value = event.target.value
                      setDrafts((prev) => ({
                        ...prev,
                        [row.investmentId]: {
                          ...draft,
                          priceAtTime: value,
                        },
                      }))
                    }}
                    placeholder="Purchase price"
                    className="rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 outline-none focus:border-zinc-500 dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-100"
                  />
                </div>
              </article>
            )
          })}

          <div className="flex justify-end">
            <button
              type="button"
              onClick={saveAll}
              disabled={saving}
              className="inline-flex items-center justify-center gap-1 rounded-lg bg-zinc-900 px-4 py-2 text-sm font-medium text-white hover:bg-zinc-700 disabled:opacity-60 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-300"
            >
              {icon('M5 12l4 4L19 6')}
              {saving ? 'Saving...' : 'Save all'}
            </button>
          </div>
        </div>
      )}
    </section>
  )
}
