'use client'

import Link from 'next/link'
import { useEffect, useMemo, useState } from 'react'

type InvestmentRow = {
  id: string
  ticker: string
  isin: string | null
  name: string
  platform: string
  assetType: string
  units: number
  avgPrice: number | null
  positionValue: number | null
  marketPrice: number | null
  isStalePrice: boolean
  archived: boolean
}

type Group = {
  platform: string
  items: InvestmentRow[]
}

type FormState = {
  ticker: string
  isin: string
  name: string
  platform: string
  assetType: string
  units: string
  avgPrice: string
}

const currencyFormatter = new Intl.NumberFormat('sk-SK', {
  style: 'currency',
  currency: 'EUR',
  maximumFractionDigits: 2,
})

function icon(svgPath: string) {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" className="size-4 fill-none stroke-current stroke-2">
      <path d={svgPath} strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

const EMPTY_FORM: FormState = {
  ticker: '',
  isin: '',
  name: '',
  platform: 'XTB',
  assetType: 'ETF',
  units: '',
  avgPrice: '',
}

export default function InvestmentsPage() {
  const [groups, setGroups] = useState<Group[]>([])
  const [form, setForm] = useState<FormState>(EMPTY_FORM)
  const [editId, setEditId] = useState<string | null>(null)
  const [assetTypeFilter, setAssetTypeFilter] = useState('ALL')
  const [savingKey, setSavingKey] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [message, setMessage] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  async function loadInvestments() {
    setLoading(true)
    setError(null)

    try {
      const response = await fetch('/api/investments', { cache: 'no-store' })
      const data = await response.json()
      if (!response.ok) {
        throw new Error(data.error ?? 'Failed to load investments.')
      }

      setGroups((data.groups ?? []) as Group[])
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load investments.')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    void loadInvestments()
  }, [])

  useEffect(() => {
    void refreshPrices(false)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const totalPortfolioValue = useMemo(() => {
    return groups
      .flatMap((group) => group.items)
      .reduce((acc, item) => acc + (item.positionValue ?? 0), 0)
  }, [groups])

  const monthEntriesHref = useMemo(() => {
    const now = new Date()
    const month = `${now.getUTCFullYear()}-${String(now.getUTCMonth() + 1).padStart(2, '0')}`
    return `/investments/${month}`
  }, [])

  function startCreate() {
    setEditId(null)
    setForm(EMPTY_FORM)
  }

  function startEdit(item: InvestmentRow) {
    setEditId(item.id)
    setForm({
      ticker: item.ticker,
      isin: item.isin ?? '',
      name: item.name,
      platform: item.platform,
      assetType: item.assetType,
      units: String(item.units),
      avgPrice: item.avgPrice != null ? String(item.avgPrice) : '',
    })
  }

  async function saveInvestment() {
    const payload = {
      ticker: form.ticker,
      isin: form.isin,
      name: form.name,
      platform: form.platform,
      assetType: form.assetType,
      units: form.units,
      avgPrice: form.avgPrice,
    }

    setSavingKey('save')
    setError(null)
    setMessage(null)

    try {
      const response = await fetch('/api/investments', {
        method: editId ? 'PATCH' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(editId ? { action: 'edit', id: editId, ...payload } : payload),
      })

      const data = await response.json()
      if (!response.ok) {
        throw new Error(data.error ?? 'Failed to save the investment.')
      }

      setMessage(editId ? 'Investment updated.' : 'Investment added.')
      setEditId(null)
      setForm(EMPTY_FORM)
      await loadInvestments()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save the investment.')
    } finally {
      setSavingKey(null)
    }
  }

  async function toggleArchive(item: InvestmentRow) {
    setSavingKey(item.id)
    setError(null)
    setMessage(null)

    try {
      const response = await fetch('/api/investments', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: item.archived ? 'unarchive' : 'archive',
          id: item.id,
        }),
      })
      const data = await response.json()
      if (!response.ok) {
        throw new Error(data.error ?? 'Failed to change the investment state.')
      }

      setMessage(item.archived ? 'Investment reactivated.' : 'Investment archived.')
      await loadInvestments()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to change the investment state.')
    } finally {
      setSavingKey(null)
    }
  }

  async function refreshPrices(force: boolean) {
    setSavingKey('refresh')
    setError(null)

    try {
      const response = await fetch('/api/investments/refresh', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ force }),
      })
      const data = await response.json()
      if (!response.ok) {
        throw new Error(data.error ?? 'Failed to refresh market prices.')
      }

      setMessage(force ? 'Market prices refreshed manually.' : 'Market cache checked.')
      await loadInvestments()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to refresh market prices.')
    } finally {
      setSavingKey(null)
    }
  }

  return (
    <section className="space-y-5">
      <header className="space-y-2">
        <h2 className="text-2xl font-semibold tracking-tight">Investments</h2>
        <p className="max-w-2xl text-sm text-zinc-600 dark:text-zinc-300">
          Separate ETF tracking from other assets, and label positions as recurring or one-off when you enter monthly contributions.
        </p>
        <div className="flex flex-wrap items-center gap-2">
          <span className="inline-flex items-center gap-1 rounded-full bg-emerald-100 px-2 py-1 text-xs font-medium text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300">
            {icon('M3 17l6-6 4 4 8-8')}
            Value {currencyFormatter.format(totalPortfolioValue)}
          </span>
          <Link
            href="/investments/stats"
            className="inline-flex items-center gap-1 rounded-full border border-zinc-300 px-2 py-1 text-xs font-medium text-zinc-700 hover:bg-zinc-100 dark:border-zinc-700 dark:text-zinc-100 dark:hover:bg-zinc-800"
          >
            {icon('M4 12h16M4 12l4 4m-4-4 4-4')}
            Stats
          </Link>
          <Link
            href={monthEntriesHref}
            className="inline-flex items-center gap-1 rounded-full border border-zinc-300 px-2 py-1 text-xs font-medium text-zinc-700 hover:bg-zinc-100 dark:border-zinc-700 dark:text-zinc-100 dark:hover:bg-zinc-800"
          >
            {icon('M8 2v4M16 2v4M3 10h18')}
            Monthly entries
          </Link>
          <button
            type="button"
            onClick={() => refreshPrices(true)}
            disabled={savingKey === 'refresh'}
            className="inline-flex items-center gap-1 rounded-full border border-zinc-300 px-2 py-1 text-xs font-medium text-zinc-700 hover:bg-zinc-100 disabled:opacity-60 dark:border-zinc-700 dark:text-zinc-100 dark:hover:bg-zinc-800"
          >
            {icon('M4 4v6h6M20 20v-6h-6M5 19A9 9 0 1 1 19 5')}
            Refresh prices
          </button>
        </div>
      </header>

      <div className="rounded-xl border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-900">
        <h3 className="mb-3 text-sm font-semibold text-zinc-700 dark:text-zinc-100">
          {editId ? 'Edit position' : 'Add position'}
        </h3>
        <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
          <input
            value={form.ticker}
            onChange={(event) => setForm((prev) => ({ ...prev, ticker: event.target.value }))}
            placeholder="Ticker (VWCE)"
            className="rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 outline-none focus:border-zinc-500 dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-100"
          />
          <input
            value={form.isin}
            onChange={(event) => setForm((prev) => ({ ...prev, isin: event.target.value }))}
            placeholder="ISIN (optional)"
            className="rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 outline-none focus:border-zinc-500 dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-100"
          />
          <input
            value={form.name}
            onChange={(event) => setForm((prev) => ({ ...prev, name: event.target.value }))}
            placeholder="Name"
            className="rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 outline-none focus:border-zinc-500 dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-100"
          />
          <select
            value={form.platform}
            onChange={(event) => setForm((prev) => ({ ...prev, platform: event.target.value }))}
            className="rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 outline-none focus:border-zinc-500 dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-100"
          >
            <option value="XTB">XTB</option>
            <option value="Conseq">Conseq</option>
            <option value="EIC">EIC</option>
          </select>
          <select
            value={form.assetType}
            onChange={(event) => setForm((prev) => ({ ...prev, assetType: event.target.value }))}
            className="rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 outline-none focus:border-zinc-500 dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-100"
          >
            <option value="ETF">ETF</option>
            <option value="FUND">Fund</option>
            <option value="ACCOUNT">Account</option>
            <option value="CASH">Cash</option>
          </select>
          <input
            type="number"
            inputMode="decimal"
            min="0"
            step="0.0001"
            value={form.units}
            onChange={(event) => setForm((prev) => ({ ...prev, units: event.target.value }))}
            placeholder="Units"
            className="rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 outline-none focus:border-zinc-500 dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-100"
          />
          <input
            type="number"
            inputMode="decimal"
            min="0"
            step="0.01"
            value={form.avgPrice}
            onChange={(event) => setForm((prev) => ({ ...prev, avgPrice: event.target.value }))}
            placeholder="Average price"
            className="rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 outline-none focus:border-zinc-500 dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-100"
          />
        </div>

        <div className="mt-3 flex flex-wrap justify-end gap-2">
          <button
            type="button"
            onClick={startCreate}
            className="inline-flex items-center gap-1 rounded-lg border border-zinc-300 px-3 py-2 text-sm font-medium text-zinc-700 hover:bg-zinc-100 dark:border-zinc-700 dark:text-zinc-100 dark:hover:bg-zinc-800"
          >
            {icon('M5 12h14')}
            Reset
          </button>
          <button
            type="button"
            onClick={saveInvestment}
            disabled={savingKey === 'save'}
            className="inline-flex items-center gap-1 rounded-lg bg-zinc-900 px-3 py-2 text-sm font-medium text-white hover:bg-zinc-700 disabled:opacity-60 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-300"
          >
            {icon('M5 12l4 4L19 6')}
            {editId ? 'Save changes' : 'Add position'}
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

      {loading ? (
        <p className="rounded-xl border border-zinc-200 bg-white p-4 text-sm text-zinc-600 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-300">
          Loading investments...
        </p>
      ) : groups.length === 0 ? (
        <p className="rounded-xl border border-zinc-200 bg-white p-4 text-sm text-zinc-600 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-300">
          You do not have any investment positions.
        </p>
      ) : (
        <div className="space-y-4">
          <div className="flex flex-wrap gap-2">
            {['ALL', 'ETF', 'FUND', 'ACCOUNT', 'CASH'].map((type) => (
              <button
                key={type}
                type="button"
                onClick={() => setAssetTypeFilter(type)}
                className={`rounded-full px-3 py-1 text-xs font-medium transition ${assetTypeFilter === type ? 'bg-zinc-900 text-white dark:bg-zinc-100 dark:text-zinc-900' : 'border border-zinc-300 text-zinc-700 hover:bg-zinc-100 dark:border-zinc-700 dark:text-zinc-200 dark:hover:bg-zinc-800'}`}
              >
                {type === 'ALL' ? 'All' : type}
              </button>
            ))}
          </div>
          {groups.map((group) => {
            const filteredItems =
              assetTypeFilter === 'ALL'
                ? group.items
                : group.items.filter((item) => item.assetType === assetTypeFilter)

            if (filteredItems.length === 0) return null

            return (
            <article key={group.platform} className="rounded-xl border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-900">
              <h3 className="mb-3 text-sm font-semibold uppercase tracking-wide text-zinc-600 dark:text-zinc-300">
                {group.platform}
              </h3>

              <div className="space-y-2">
                {filteredItems.map((item) => (
                  <div key={item.id} className="rounded-lg border border-zinc-200 p-3 dark:border-zinc-800">
                    <div className="flex flex-wrap items-start justify-between gap-2">
                      <div>
                        <p className="font-medium text-zinc-900 dark:text-zinc-100">
                          {item.ticker} · {item.name}
                        </p>
                        <p className="mt-1 flex flex-wrap gap-1 text-[11px] font-medium text-zinc-500 dark:text-zinc-400">
                          <span className="rounded-full bg-zinc-100 px-2 py-0.5 dark:bg-zinc-800">{item.assetType}</span>
                        </p>
                        <p className="text-xs text-zinc-500 dark:text-zinc-400">
                          Units {item.units.toFixed(4)} · Avg {item.avgPrice != null ? currencyFormatter.format(item.avgPrice) : 'N/A'}
                        </p>
                        <p className="text-xs text-zinc-500 dark:text-zinc-400">
                          Price {item.marketPrice != null ? currencyFormatter.format(item.marketPrice) : 'N/A'}
                          {item.isStalePrice ? ' · stale price' : ''}
                          {' · '}
                          Value {item.positionValue != null ? currencyFormatter.format(item.positionValue) : 'N/A'}
                        </p>
                      </div>

                      <div className="flex flex-wrap gap-2">
                        <button
                          type="button"
                          onClick={() => startEdit(item)}
                          className="inline-flex items-center gap-1 rounded-lg border border-zinc-300 px-2 py-1 text-xs font-medium text-zinc-700 hover:bg-zinc-100 dark:border-zinc-700 dark:text-zinc-100 dark:hover:bg-zinc-800"
                        >
                          {icon('M4 20h4l10-10-4-4L4 16v4Z')}
                          Edit
                        </button>
                        <button
                          type="button"
                          onClick={() => toggleArchive(item)}
                          disabled={savingKey === item.id}
                          className="inline-flex items-center gap-1 rounded-lg border border-zinc-300 px-2 py-1 text-xs font-medium text-zinc-700 hover:bg-zinc-100 disabled:opacity-60 dark:border-zinc-700 dark:text-zinc-100 dark:hover:bg-zinc-800"
                        >
                          {item.archived ? icon('M5 12l4 4L19 6') : icon('M5 12h14')}
                          {item.archived ? 'Restore' : 'Archive'}
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </article>
            )
          })}
        </div>
      )}
    </section>
  )
}
