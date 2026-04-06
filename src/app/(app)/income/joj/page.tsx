'use client'

import { useEffect, useMemo, useState } from 'react'
import { Line, LineChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { MonthPicker } from '@/components/ui/MonthPicker'

type JojDetail = {
  month: string
  streamCount: number
  ratePerStream: number
  tvHonorar: number
  bonus: number
  expectedTotal: number
  receivedTotal: number | null
  diff: number | null
}

type JojStats = {
  avgStreams: number
  bestMonth: { month: string; expectedTotal: number } | null
  eurPerStreamTrend: Array<{ month: string; value: number }>
  totals: {
    expectedTotal: number
    receivedTotal: number
  }
}

const currencyFormatter = new Intl.NumberFormat('sk-SK', {
  style: 'currency',
  currency: 'EUR',
  maximumFractionDigits: 2,
})

const monthFormatter = new Intl.DateTimeFormat('sk-SK', {
  month: 'long',
  year: 'numeric',
  timeZone: 'UTC',
})

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

function icon(svgPath: string) {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" className="size-4 fill-none stroke-current stroke-2">
      <path d={svgPath} strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

export default function JojPage() {
  const [month, setMonth] = useState(currentMonthKeyUtc())
  const [streamCount, setStreamCount] = useState('0')
  const [ratePerStream, setRatePerStream] = useState('40')
  const [tvHonorar, setTvHonorar] = useState('0')
  const [bonus, setBonus] = useState('0')
  const [receivedTotal, setReceivedTotal] = useState('')
  const [stats, setStats] = useState<JojStats | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  const expectedTotal = useMemo(() => {
    const streams = Number(streamCount || 0)
    const rate = Number(ratePerStream || 0)
    const tv = Number(tvHonorar || 0)
    const bo = Number(bonus || 0)
    return streams * rate + tv + bo
  }, [streamCount, ratePerStream, tvHonorar, bonus])

  const diff = useMemo(() => {
    if (!receivedTotal.trim()) return null
    const received = Number(receivedTotal)
    if (!Number.isFinite(received)) return null
    return received - expectedTotal
  }, [receivedTotal, expectedTotal])

  async function loadData(targetMonth: string) {
    setLoading(true)
    setError(null)
    try {
      const response = await fetch(`/api/income/joj?month=${targetMonth}`, { cache: 'no-store' })
      const data = await response.json()
      if (!response.ok) {
        throw new Error(data.error ?? 'Nepodarilo sa načítať JOJ dáta.')
      }

      const detail = data.detail as JojDetail | null
      setStats(data.stats as JojStats)

      if (detail) {
        setStreamCount(String(detail.streamCount))
        setRatePerStream(String(detail.ratePerStream))
        setTvHonorar(String(detail.tvHonorar))
        setBonus(String(detail.bonus))
        setReceivedTotal(detail.receivedTotal === null ? '' : String(detail.receivedTotal))
      } else {
        setStreamCount('0')
        setRatePerStream('40')
        setTvHonorar('0')
        setBonus('0')
        setReceivedTotal('')
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Nepodarilo sa načítať JOJ dáta.')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    void loadData(month)
  }, [month])

  async function save() {
    setSaving(true)
    setError(null)
    try {
      const response = await fetch('/api/income/joj', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          month,
          streamCount,
          ratePerStream,
          tvHonorar,
          bonus,
          receivedTotal,
        }),
      })
      const data = await response.json()
      if (!response.ok) {
        throw new Error(data.error ?? 'Nepodarilo sa uložiť JOJ detail.')
      }

      setMessage('JOJ detail bol uložený.')
      await loadData(month)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Nepodarilo sa uložiť JOJ detail.')
    } finally {
      setSaving(false)
    }
  }

  const isDiffAlert = diff !== null && Math.abs(diff) > 5
  const monthDate = parseMonthKey(month)

  return (
    <section className="space-y-5">
      <header className="space-y-2">
        <h2 className="text-2xl font-semibold tracking-tight">JOJ detail</h2>
        <div className="flex flex-wrap items-center gap-2">
          <span className="inline-flex items-center gap-1 rounded-full bg-zinc-100 px-2 py-1 text-xs font-medium text-zinc-700 dark:bg-zinc-800 dark:text-zinc-200">
            {icon('M3 12h18M12 3v18')}
            {monthDate ? monthFormatter.format(monthDate) : month}
          </span>
          <span className={`inline-flex items-center gap-1 rounded-full px-2 py-1 text-xs font-medium ${isDiffAlert ? 'bg-rose-100 text-rose-700 dark:bg-rose-900/40 dark:text-rose-300' : 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300'}`}>
            {icon('M12 3v18M3 12h18')}
            Diff {diff === null ? 'N/A' : currencyFormatter.format(diff)}
          </span>
        </div>
      </header>

      <div className="rounded-xl border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-900">
        <p className="mb-2 block text-xs text-zinc-500 dark:text-zinc-400">
          Pick the month you want to review.
        </p>
        <MonthPicker value={month} onChange={setMonth} className="w-full sm:w-[22rem]" />
      </div>

      <div className="grid gap-3 md:grid-cols-2">
        <div className="rounded-xl border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-900">
          <p className="mb-2 text-sm font-semibold text-zinc-700 dark:text-zinc-100">Input data</p>
          <p className="mb-3 text-xs text-zinc-500 dark:text-zinc-400">
            Streams, TV fee, and bonus are used to calculate the expected payout.
          </p>
          <div className="grid gap-2 sm:grid-cols-2">
            <label className="space-y-1 text-xs text-zinc-500 dark:text-zinc-400">
              <span className="block font-medium text-zinc-700 dark:text-zinc-200">Stream count</span>
              <input type="number" value={streamCount} min="0" onChange={(e) => setStreamCount(e.target.value)} placeholder="0" className="w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm outline-none focus:border-zinc-500 dark:border-zinc-700 dark:bg-zinc-950" />
            </label>
            <label className="space-y-1 text-xs text-zinc-500 dark:text-zinc-400">
              <span className="block font-medium text-zinc-700 dark:text-zinc-200">Rate per stream</span>
              <input type="number" value={ratePerStream} min="0" step="0.01" onChange={(e) => setRatePerStream(e.target.value)} placeholder="40" className="w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm outline-none focus:border-zinc-500 dark:border-zinc-700 dark:bg-zinc-950" />
            </label>
            <label className="space-y-1 text-xs text-zinc-500 dark:text-zinc-400">
              <span className="block font-medium text-zinc-700 dark:text-zinc-200">TV fee</span>
              <input type="number" value={tvHonorar} min="0" step="0.01" onChange={(e) => setTvHonorar(e.target.value)} placeholder="0" className="w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm outline-none focus:border-zinc-500 dark:border-zinc-700 dark:bg-zinc-950" />
            </label>
            <label className="space-y-1 text-xs text-zinc-500 dark:text-zinc-400">
              <span className="block font-medium text-zinc-700 dark:text-zinc-200">Bonus</span>
              <input type="number" value={bonus} min="0" step="0.01" onChange={(e) => setBonus(e.target.value)} placeholder="0" className="w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm outline-none focus:border-zinc-500 dark:border-zinc-700 dark:bg-zinc-950" />
            </label>
          </div>
        </div>

        <div className="rounded-xl border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-900">
          <p className="mb-2 text-sm font-semibold text-zinc-700 dark:text-zinc-100">Calculation</p>
          <p className="mb-3 text-xs text-zinc-500 dark:text-zinc-400">Use the received amount to compare expected vs actual payout.</p>
          <div className="space-y-2 text-sm">
            <p className="flex items-center justify-between"><span className="text-zinc-500">💡 Expected</span><span className="font-semibold">{currencyFormatter.format(expectedTotal)}</span></p>
            <div>
              <label htmlFor="received" className="mb-1 block text-zinc-500">🏦 Received</label>
              <input id="received" type="number" step="0.01" value={receivedTotal} onChange={(e) => setReceivedTotal(e.target.value)} className="w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm outline-none focus:border-zinc-500 dark:border-zinc-700 dark:bg-zinc-950" />
            </div>
            <p className={`flex items-center justify-between rounded-lg px-2 py-1 font-medium ${isDiffAlert ? 'bg-rose-100 text-rose-700 dark:bg-rose-900/30 dark:text-rose-300' : 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300'}`}>
              <span>⚖️ Diff</span>
              <span>{diff === null ? 'N/A' : currencyFormatter.format(diff)}</span>
            </p>
          </div>
          <button
            type="button"
            onClick={save}
            disabled={saving}
            className="mt-3 inline-flex items-center gap-1 rounded-lg bg-zinc-900 px-3 py-2 text-sm font-medium text-white hover:bg-zinc-700 disabled:opacity-60 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-300"
          >
            {icon('M5 12l4 4L19 6')}
            Save
          </button>
        </div>
      </div>

      {message ? (
        <p className="rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-700 dark:border-emerald-900 dark:bg-emerald-950/30 dark:text-emerald-300">{message}</p>
      ) : null}
      {error ? (
        <p className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700 dark:border-rose-900 dark:bg-rose-950/30 dark:text-rose-300">{error}</p>
      ) : null}

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <article className="rounded-xl border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-900">
          <p className="text-xs uppercase text-zinc-500">🎥 Average streams</p>
          <p className="mt-1 text-xl font-semibold">{stats ? stats.avgStreams.toFixed(1) : '-'}</p>
        </article>
        <article className="rounded-xl border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-900">
          <p className="text-xs uppercase text-zinc-500">🏆 Best month</p>
          <p className="mt-1 text-sm font-semibold">{stats?.bestMonth?.month ?? '-'}</p>
          <p className="text-xs text-zinc-500">{stats?.bestMonth ? currencyFormatter.format(stats.bestMonth.expectedTotal) : ''}</p>
        </article>
        <article className="rounded-xl border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-900">
          <p className="text-xs uppercase text-zinc-500">📈 Expected total</p>
          <p className="mt-1 text-xl font-semibold">{stats ? currencyFormatter.format(stats.totals.expectedTotal) : '-'}</p>
        </article>
        <article className="rounded-xl border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-900">
          <p className="text-xs uppercase text-zinc-500">🏦 Received total</p>
          <p className="mt-1 text-xl font-semibold">{stats ? currencyFormatter.format(stats.totals.receivedTotal) : '-'}</p>
        </article>
      </div>

      <div className="rounded-xl border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-900">
        <h3 className="mb-3 text-sm font-semibold text-zinc-700 dark:text-zinc-100">€/stream trend</h3>
        <div className="h-64 w-full">
          <ResponsiveContainer>
            <LineChart data={stats?.eurPerStreamTrend ?? []}>
              <CartesianGrid strokeDasharray="3 3" stroke="#d4d4d8" />
              <XAxis dataKey="month" tick={{ fontSize: 12 }} />
              <YAxis tick={{ fontSize: 12 }} />
              <Tooltip formatter={(value) => `${Number(value).toFixed(2)} €`} />
              <Line type="monotone" dataKey="value" stroke="#0f766e" strokeWidth={2.5} dot={{ r: 3 }} />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>

      {loading ? <p className="text-xs text-zinc-500">Loading…</p> : null}
    </section>
  )
}
