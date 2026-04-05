'use client'

import Link from 'next/link'
import { useEffect, useMemo, useState } from 'react'

type InvestmentRow = {
  id: string
  ticker: string
  isin: string | null
  name: string
  platform: string
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
  units: '',
  avgPrice: '',
}

export default function InvestmentsPage() {
  const [groups, setGroups] = useState<Group[]>([])
  const [form, setForm] = useState<FormState>(EMPTY_FORM)
  const [editId, setEditId] = useState<string | null>(null)
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
        throw new Error(data.error ?? 'Nepodarilo sa načítať investície.')
      }

      setGroups((data.groups ?? []) as Group[])
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Nepodarilo sa načítať investície.')
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
        throw new Error(data.error ?? 'Nepodarilo sa uložiť investíciu.')
      }

      setMessage(editId ? 'Investícia bola upravená.' : 'Investícia bola pridaná.')
      setEditId(null)
      setForm(EMPTY_FORM)
      await loadInvestments()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Nepodarilo sa uložiť investíciu.')
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
        throw new Error(data.error ?? 'Nepodarilo sa zmeniť stav investície.')
      }

      setMessage(item.archived ? 'Investícia je opäť aktívna.' : 'Investícia bola archivovaná.')
      await loadInvestments()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Nepodarilo sa zmeniť stav investície.')
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
        throw new Error(data.error ?? 'Nepodarilo sa obnoviť market ceny.')
      }

      setMessage(force ? 'Market ceny boli manuálne obnovené.' : 'Market cache bola skontrolovaná.')
      await loadInvestments()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Nepodarilo sa obnoviť market ceny.')
    } finally {
      setSavingKey(null)
    }
  }

  return (
    <section className="space-y-5">
      <header className="space-y-2">
        <h2 className="text-2xl font-semibold tracking-tight">Investície</h2>
        <div className="flex flex-wrap items-center gap-2">
          <span className="inline-flex items-center gap-1 rounded-full bg-emerald-100 px-2 py-1 text-xs font-medium text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300">
            {icon('M3 17l6-6 4 4 8-8')}
            Hodnota {currencyFormatter.format(totalPortfolioValue)}
          </span>
          <Link
            href="/investments/stats"
            className="inline-flex items-center gap-1 rounded-full border border-zinc-300 px-2 py-1 text-xs font-medium text-zinc-700 hover:bg-zinc-100 dark:border-zinc-700 dark:text-zinc-100 dark:hover:bg-zinc-800"
          >
            {icon('M4 12h16M4 12l4 4m-4-4 4-4')}
            Štatistiky
          </Link>
          <Link
            href={monthEntriesHref}
            className="inline-flex items-center gap-1 rounded-full border border-zinc-300 px-2 py-1 text-xs font-medium text-zinc-700 hover:bg-zinc-100 dark:border-zinc-700 dark:text-zinc-100 dark:hover:bg-zinc-800"
          >
            {icon('M8 2v4M16 2v4M3 10h18')}
            Mesačné záznamy
          </Link>
          <button
            type="button"
            onClick={() => refreshPrices(true)}
            disabled={savingKey === 'refresh'}
            className="inline-flex items-center gap-1 rounded-full border border-zinc-300 px-2 py-1 text-xs font-medium text-zinc-700 hover:bg-zinc-100 disabled:opacity-60 dark:border-zinc-700 dark:text-zinc-100 dark:hover:bg-zinc-800"
          >
            {icon('M4 4v6h6M20 20v-6h-6M5 19A9 9 0 1 1 19 5')}
            Obnoviť ceny
          </button>
        </div>
      </header>

      <div className="rounded-xl border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-900">
        <h3 className="mb-3 text-sm font-semibold text-zinc-700 dark:text-zinc-100">
          {editId ? 'Upraviť pozíciu' : 'Pridať pozíciu'}
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
            placeholder="ISIN (voliteľné)"
            className="rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 outline-none focus:border-zinc-500 dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-100"
          />
          <input
            value={form.name}
            onChange={(event) => setForm((prev) => ({ ...prev, name: event.target.value }))}
            placeholder="Názov"
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
          <input
            type="number"
            inputMode="decimal"
            min="0"
            step="0.0001"
            value={form.units}
            onChange={(event) => setForm((prev) => ({ ...prev, units: event.target.value }))}
            placeholder="Počet kusov"
            className="rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 outline-none focus:border-zinc-500 dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-100"
          />
          <input
            type="number"
            inputMode="decimal"
            min="0"
            step="0.01"
            value={form.avgPrice}
            onChange={(event) => setForm((prev) => ({ ...prev, avgPrice: event.target.value }))}
            placeholder="Priemerná cena"
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
            {editId ? 'Uložiť zmeny' : 'Pridať pozíciu'}
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
          Načítavam investície...
        </p>
      ) : groups.length === 0 ? (
        <p className="rounded-xl border border-zinc-200 bg-white p-4 text-sm text-zinc-600 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-300">
          Nemáš žiadne investičné pozície.
        </p>
      ) : (
        <div className="space-y-4">
          {groups.map((group) => (
            <article key={group.platform} className="rounded-xl border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-900">
              <h3 className="mb-3 text-sm font-semibold uppercase tracking-wide text-zinc-600 dark:text-zinc-300">
                {group.platform}
              </h3>

              <div className="space-y-2">
                {group.items.map((item) => (
                  <div key={item.id} className="rounded-lg border border-zinc-200 p-3 dark:border-zinc-800">
                    <div className="flex flex-wrap items-start justify-between gap-2">
                      <div>
                        <p className="font-medium text-zinc-900 dark:text-zinc-100">
                          {item.ticker} · {item.name}
                        </p>
                        <p className="text-xs text-zinc-500 dark:text-zinc-400">
                          Kusy {item.units.toFixed(4)} · Avg {item.avgPrice != null ? currencyFormatter.format(item.avgPrice) : 'N/A'}
                        </p>
                        <p className="text-xs text-zinc-500 dark:text-zinc-400">
                          Cena {item.marketPrice != null ? currencyFormatter.format(item.marketPrice) : 'N/A'}
                          {item.isStalePrice ? ' · stará cena' : ''}
                          {' · '}
                          Hodnota {item.positionValue != null ? currencyFormatter.format(item.positionValue) : 'N/A'}
                        </p>
                      </div>

                      <div className="flex flex-wrap gap-2">
                        <button
                          type="button"
                          onClick={() => startEdit(item)}
                          className="inline-flex items-center gap-1 rounded-lg border border-zinc-300 px-2 py-1 text-xs font-medium text-zinc-700 hover:bg-zinc-100 dark:border-zinc-700 dark:text-zinc-100 dark:hover:bg-zinc-800"
                        >
                          {icon('M4 20h4l10-10-4-4L4 16v4Z')}
                          Upraviť
                        </button>
                        <button
                          type="button"
                          onClick={() => toggleArchive(item)}
                          disabled={savingKey === item.id}
                          className="inline-flex items-center gap-1 rounded-lg border border-zinc-300 px-2 py-1 text-xs font-medium text-zinc-700 hover:bg-zinc-100 disabled:opacity-60 dark:border-zinc-700 dark:text-zinc-100 dark:hover:bg-zinc-800"
                        >
                          {item.archived ? icon('M5 12l4 4L19 6') : icon('M5 12h14')}
                          {item.archived ? 'Obnoviť' : 'Archivovať'}
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </article>
          ))}
        </div>
      )}
    </section>
  )
}
