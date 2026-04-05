'use client'

import Link from 'next/link'
import { useEffect, useMemo, useState } from 'react'
import { Bar, BarChart, CartesianGrid, Legend, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'

type Source = {
  id: string
  name: string
  color: string
  isActive: boolean
}

type Entry = {
  id: string
  sourceId: string
  amount: number
  note: string | null
}

type HistoryRow = {
  month: string
  amount: number
  sourceId: string
  sourceName: string
  color: string
}

type EntryDraft = {
  amount: string
  note: string
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

const monthTickFormatter = new Intl.DateTimeFormat('sk-SK', {
  month: 'short',
  year: '2-digit',
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

export default function IncomePage() {
  const [month, setMonth] = useState(currentMonthKeyUtc())
  const [sources, setSources] = useState<Source[]>([])
  const [entries, setEntries] = useState<Entry[]>([])
  const [history, setHistory] = useState<HistoryRow[]>([])
  const [drafts, setDrafts] = useState<Record<string, EntryDraft>>({})
  const [newSourceName, setNewSourceName] = useState('')
  const [newSourceColor, setNewSourceColor] = useState('#378ADD')
  const [savingKey, setSavingKey] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [message, setMessage] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  async function loadIncome(targetMonth: string) {
    setLoading(true)
    setError(null)
    try {
      const response = await fetch(`/api/income?month=${targetMonth}&months=12`, { cache: 'no-store' })
      const data = await response.json()
      if (!response.ok) {
        throw new Error(data.error ?? 'Nepodarilo sa načítať income dáta.')
      }

      const nextSources = (data.sources ?? []) as Source[]
      const nextEntries = (data.entries ?? []) as Entry[]
      const nextHistory = (data.history ?? []) as HistoryRow[]

      setSources(nextSources)
      setEntries(nextEntries)
      setHistory(nextHistory)

      const nextDrafts: Record<string, EntryDraft> = {}
      for (const source of nextSources) {
        const existing = nextEntries.find((entry) => entry.sourceId === source.id)
        nextDrafts[source.id] = {
          amount: existing ? String(existing.amount) : '',
          note: existing?.note ?? '',
        }
      }
      setDrafts(nextDrafts)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Nepodarilo sa načítať income dáta.')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    void loadIncome(month)
  }, [month])

  const monthDate = useMemo(() => parseMonthKey(month), [month])

  const totalIncome = useMemo(() => {
    return entries.reduce((acc, entry) => acc + entry.amount, 0)
  }, [entries])

  const chartData = useMemo(() => {
    const byMonth = new Map<string, Record<string, string | number>>()

    for (const row of history) {
      const monthRow =
        byMonth.get(row.month) ?? {
          month: monthTickFormatter.format(parseMonthKey(row.month) ?? new Date()),
          monthKey: row.month,
        }

      monthRow[row.sourceId] = row.amount
      byMonth.set(row.month, monthRow)
    }

    return [...byMonth.values()].sort((a, b) => String(a.monthKey).localeCompare(String(b.monthKey)))
  }, [history])

  async function addSource() {
    if (!newSourceName.trim()) {
      setError('Názov zdroja je povinný.')
      return
    }

    setSavingKey('source-new')
    setError(null)
    try {
      const response = await fetch('/api/income', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: newSourceName, color: newSourceColor }),
      })
      const data = await response.json()
      if (!response.ok) {
        throw new Error(data.error ?? 'Nepodarilo sa pridať zdroj príjmu.')
      }

      setNewSourceName('')
      setMessage('Zdroj príjmu bol pridaný.')
      await loadIncome(month)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Nepodarilo sa pridať zdroj príjmu.')
    } finally {
      setSavingKey(null)
    }
  }

  async function toggleSource(source: Source) {
    setSavingKey(`source-${source.id}`)
    setError(null)
    try {
      const response = await fetch('/api/income', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'source-toggle',
          id: source.id,
          isActive: !source.isActive,
        }),
      })
      const data = await response.json()
      if (!response.ok) {
        throw new Error(data.error ?? 'Nepodarilo sa zmeniť stav zdroja.')
      }
      setMessage(source.isActive ? 'Zdroj bol deaktivovaný.' : 'Zdroj bol aktivovaný.')
      await loadIncome(month)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Nepodarilo sa zmeniť stav zdroja.')
    } finally {
      setSavingKey(null)
    }
  }

  async function saveEntry(sourceId: string) {
    const draft = drafts[sourceId]
    if (!draft) return

    setSavingKey(`entry-${sourceId}`)
    setError(null)
    try {
      const response = await fetch('/api/income', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'entry-upsert',
          sourceId,
          month,
          amount: draft.amount,
          note: draft.note,
        }),
      })
      const data = await response.json()
      if (!response.ok) {
        throw new Error(data.error ?? 'Nepodarilo sa uložiť príjem.')
      }

      setMessage('Mesačný príjem bol uložený.')
      await loadIncome(month)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Nepodarilo sa uložiť príjem.')
    } finally {
      setSavingKey(null)
    }
  }

  return (
    <section className="space-y-5">
      <header className="space-y-2">
        <h2 className="text-2xl font-semibold tracking-tight">Zárobky</h2>
        <div className="flex flex-wrap items-center gap-2">
          <span className="inline-flex items-center gap-1 rounded-full bg-zinc-100 px-2 py-1 text-xs font-medium text-zinc-700 dark:bg-zinc-800 dark:text-zinc-200">
            {icon('M3 12h18M12 3v18')}
            {monthDate ? monthTitleFormatter.format(monthDate) : month}
          </span>
          <span className="inline-flex items-center gap-1 rounded-full bg-emerald-100 px-2 py-1 text-xs font-medium text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300">
            {icon('M4 12h16M4 12l4 4m-4-4 4-4')}
            Spolu {currencyFormatter.format(totalIncome)}
          </span>
          <Link
            href="/income/joj"
            className="inline-flex items-center gap-1 rounded-full border border-zinc-300 px-2 py-1 text-xs font-medium text-zinc-700 hover:bg-zinc-100 dark:border-zinc-700 dark:text-zinc-100 dark:hover:bg-zinc-800"
          >
            {icon('M6 19V5l12 7-12 7Z')}
            JOJ detail
          </Link>
        </div>
      </header>

      <div className="rounded-xl border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-900">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
          <label className="text-sm font-medium text-zinc-700 dark:text-zinc-200" htmlFor="income-month-picker">
            Mesiac
          </label>
          <input
            id="income-month-picker"
            type="month"
            value={month}
            onChange={(event) => setMonth(event.target.value)}
            className="rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 outline-none focus:border-zinc-500 dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-100"
          />
        </div>
      </div>

      <div className="rounded-xl border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-900">
        <h3 className="mb-3 text-sm font-semibold text-zinc-700 dark:text-zinc-100">Pridať zdroj príjmu</h3>
        <div className="grid gap-2 sm:grid-cols-[1fr_120px_auto]">
          <input
            value={newSourceName}
            onChange={(event) => setNewSourceName(event.target.value)}
            placeholder="Názov (napr. Freelance)"
            className="rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 outline-none focus:border-zinc-500 dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-100"
          />
          <input
            value={newSourceColor}
            onChange={(event) => setNewSourceColor(event.target.value)}
            type="color"
            className="h-10 w-full rounded-lg border border-zinc-300 bg-white px-1 py-1 dark:border-zinc-700 dark:bg-zinc-950"
          />
          <button
            type="button"
            onClick={addSource}
            disabled={savingKey === 'source-new'}
            className="inline-flex items-center justify-center gap-1 rounded-lg bg-zinc-900 px-3 py-2 text-sm font-medium text-white hover:bg-zinc-700 disabled:opacity-60 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-300"
          >
            {icon('M12 5v14M5 12h14')}
            Pridať
          </button>
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

      <div className="grid gap-3">
        {loading ? (
          <p className="rounded-xl border border-zinc-200 bg-white p-4 text-sm text-zinc-600 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-300">
            Načítavam income dáta...
          </p>
        ) : sources.length === 0 ? (
          <p className="rounded-xl border border-zinc-200 bg-white p-4 text-sm text-zinc-600 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-300">
            Nemáš žiadne zdroje príjmu.
          </p>
        ) : (
          sources.map((source) => {
            const draft = drafts[source.id] ?? { amount: '', note: '' }
            return (
              <article key={source.id} className="rounded-xl border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-900">
                <div className="mb-3 flex items-center justify-between gap-3">
                  <div className="flex items-center gap-2">
                    <span className="size-3 rounded-full" style={{ backgroundColor: source.color }} />
                    <p className="font-medium text-zinc-900 dark:text-zinc-100">{source.name}</p>
                    {!source.isActive ? (
                      <span className="rounded-full bg-zinc-200 px-2 py-0.5 text-[10px] font-semibold text-zinc-700 dark:bg-zinc-700 dark:text-zinc-200">
                        neaktívny
                      </span>
                    ) : null}
                  </div>
                  <button
                    type="button"
                    onClick={() => toggleSource(source)}
                    disabled={savingKey === `source-${source.id}`}
                    className="inline-flex items-center gap-1 rounded-lg border border-zinc-300 px-2 py-1 text-xs font-medium text-zinc-700 hover:bg-zinc-100 disabled:opacity-60 dark:border-zinc-700 dark:text-zinc-100 dark:hover:bg-zinc-800"
                  >
                    {source.isActive ? icon('M5 12h14') : icon('M12 5v14M5 12h14')}
                    {source.isActive ? 'Skryť' : 'Aktivovať'}
                  </button>
                </div>

                <div className="grid gap-2 sm:grid-cols-[180px_1fr_auto]">
                  <input
                    type="number"
                    inputMode="decimal"
                    step="0.01"
                    min="0"
                    value={draft.amount}
                    onChange={(event) => {
                      const value = event.target.value
                      setDrafts((prev) => ({ ...prev, [source.id]: { ...draft, amount: value } }))
                    }}
                    placeholder="0.00"
                    className="rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 outline-none focus:border-zinc-500 dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-100"
                  />
                  <input
                    value={draft.note}
                    onChange={(event) => {
                      const value = event.target.value
                      setDrafts((prev) => ({ ...prev, [source.id]: { ...draft, note: value } }))
                    }}
                    placeholder="Poznámka"
                    className="rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 outline-none focus:border-zinc-500 dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-100"
                  />
                  <button
                    type="button"
                    onClick={() => saveEntry(source.id)}
                    disabled={savingKey === `entry-${source.id}` || !source.isActive}
                    className="inline-flex items-center justify-center gap-1 rounded-lg bg-zinc-900 px-3 py-2 text-sm font-medium text-white hover:bg-zinc-700 disabled:opacity-60 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-300"
                  >
                    {icon('M5 12l4 4L19 6')}
                    Uložiť
                  </button>
                </div>
              </article>
            )
          })
        )}
      </div>

      <div className="rounded-xl border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-900">
        <h3 className="mb-3 text-sm font-semibold text-zinc-700 dark:text-zinc-100">Trend príjmov (12 mesiacov)</h3>
        <div className="h-72 w-full">
          <ResponsiveContainer>
            <BarChart data={chartData}>
              <CartesianGrid strokeDasharray="3 3" stroke="#d4d4d8" />
              <XAxis dataKey="month" tick={{ fontSize: 12 }} />
              <YAxis tickFormatter={(value) => currencyFormatter.format(Number(value))} width={100} tick={{ fontSize: 12 }} />
              <Tooltip formatter={(value) => currencyFormatter.format(Number(value ?? 0))} />
              <Legend />
              {sources.map((source) => (
                <Bar key={source.id} dataKey={source.id} name={source.name} stackId="income" fill={source.color} radius={[3, 3, 0, 0]} />
              ))}
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>
    </section>
  )
}
