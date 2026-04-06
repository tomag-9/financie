'use client'

import { useEffect, useState } from 'react'
import { useSearchParams } from 'next/navigation'
import { MonthPicker } from '@/components/ui/MonthPicker'

type EntryMode = 'RECURRING' | 'ONE_OFF'

type Account = {
  id: string
  name: string
  currency: string
}

type InvestmentRow = {
  id: string
  accountId: string
  accountName: string
  currency: string
  mode: EntryMode
  amount: number
}

type ApiResponse = {
  month: string
  accounts: Account[]
  rows: InvestmentRow[]
  totalInvested: number
}

const currencyFormatter = new Intl.NumberFormat('sk-SK', {
  style: 'currency',
  currency: 'EUR',
  maximumFractionDigits: 2,
})

function currentMonthKeyUtc(): string {
  const now = new Date()
  return `${now.getUTCFullYear()}-${String(now.getUTCMonth() + 1).padStart(2, '0')}`
}

function amountToInput(value: number): string {
  return Number.isFinite(value) && value > 0 ? String(value) : ''
}

export default function InvestmentsPage() {
  const searchParams = useSearchParams()
  const queryMonth = searchParams.get('month')
  const initialMonth = queryMonth && /^\d{4}-\d{2}$/.test(queryMonth) ? queryMonth : currentMonthKeyUtc()

  const [month, setMonth] = useState(initialMonth)
  const [accounts, setAccounts] = useState<Account[]>([])
  const [rows, setRows] = useState<InvestmentRow[]>([])
  const [totalInvested, setTotalInvested] = useState(0)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [message, setMessage] = useState<string | null>(null)

  const [showCreate, setShowCreate] = useState(false)
  const [createAccountId, setCreateAccountId] = useState('')
  const [createMode, setCreateMode] = useState<EntryMode>('RECURRING')
  const [createAmount, setCreateAmount] = useState('')

  const [editAmounts, setEditAmounts] = useState<Record<string, string>>({})
  const [editModes, setEditModes] = useState<Record<string, EntryMode>>({})

  useEffect(() => {
    if (month !== initialMonth) {
      window.history.replaceState(null, '', `/investments?month=${month}`)
    }
  }, [initialMonth, month])

  async function loadData(targetMonth: string) {
    setLoading(true)
    setError(null)

    try {
      const response = await fetch(`/api/investments?month=${targetMonth}`, { cache: 'no-store' })
      const data = (await response.json()) as ApiResponse | { error?: string }

      if (!response.ok) {
        throw new Error('error' in data ? data.error ?? 'Failed to load investments.' : 'Failed to load investments.')
      }

      const okData = data as ApiResponse
      setAccounts(okData.accounts)
      setRows(okData.rows)
      setTotalInvested(okData.totalInvested)

      const nextEditAmounts: Record<string, string> = {}
      const nextEditModes: Record<string, EntryMode> = {}
      for (const row of okData.rows) {
        nextEditAmounts[row.id] = amountToInput(row.amount)
        nextEditModes[row.id] = row.mode
      }
      setEditAmounts(nextEditAmounts)
      setEditModes(nextEditModes)

      if (!createAccountId && okData.accounts.length > 0) {
        setCreateAccountId(okData.accounts[0].id)
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load investments.')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    void loadData(month)
  }, [month])

  async function createEntry() {
    setSaving(true)
    setError(null)
    setMessage(null)

    try {
      const response = await fetch('/api/investments', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          month,
          accountId: createAccountId,
          mode: createMode,
          amount: createAmount,
        }),
      })

      const data = await response.json()
      if (!response.ok) {
        throw new Error(data.error ?? 'Failed to create investment entry.')
      }

      setShowCreate(false)
      setCreateAmount('')
      setMessage('Investment entry created.')
      await loadData(month)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create investment entry.')
    } finally {
      setSaving(false)
    }
  }

  async function updateEntry(row: InvestmentRow) {
    setSaving(true)
    setError(null)
    setMessage(null)

    try {
      const response = await fetch('/api/investments', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          month,
          accountId: row.accountId,
          mode: editModes[row.id] ?? row.mode,
          amount: editAmounts[row.id] ?? amountToInput(row.amount),
        }),
      })

      const data = await response.json()
      if (!response.ok) {
        throw new Error(data.error ?? 'Failed to update investment entry.')
      }

      const mode = editModes[row.id] ?? row.mode
      setMessage(`${mode === 'RECURRING' ? 'Monthly' : 'One-time'} investment updated.`)
      await loadData(month)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update investment entry.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <section className="space-y-6">
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div className="space-y-1">
          <h2 className="text-2xl font-semibold tracking-tight">Investments</h2>
          <p className="text-sm text-zinc-600 dark:text-zinc-300">
            Actual investments for selected month with quick add and monthly amount updates.
          </p>
          <div className="flex flex-wrap items-center gap-2">
            <span className="inline-flex items-center rounded-full bg-emerald-100 px-2 py-1 text-xs font-medium text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300">
              Total {currencyFormatter.format(totalInvested)}
            </span>
          </div>
        </div>
      </header>

      <div className="rounded-3xl border border-zinc-200 bg-white p-4 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <MonthPicker value={month} onChange={setMonth} className="w-full sm:w-[22rem]" />
        </div>

        <div className="mt-4 flex justify-end">
          <button
            type="button"
            onClick={() => setShowCreate((prev) => !prev)}
            className="inline-flex items-center gap-2 rounded-2xl bg-zinc-900 px-4 py-2.5 text-sm font-medium text-white transition hover:bg-zinc-700 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-300"
          >
            <span aria-hidden="true" className="text-base leading-none">+</span>
            Add investment
          </button>
        </div>
      </div>

      {showCreate ? (
        <div className="rounded-xl border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-900">
          <h3 className="mb-3 text-sm font-semibold text-zinc-700 dark:text-zinc-200">New investment entry</h3>
          <div className="grid gap-2 sm:grid-cols-3">
            <select
              value={createAccountId}
              onChange={(event) => setCreateAccountId(event.target.value)}
              className="rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 outline-none focus:border-zinc-500 dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-100"
            >
              {accounts.map((account) => (
                <option key={account.id} value={account.id}>
                  {account.name}
                </option>
              ))}
            </select>

            <select
              value={createMode}
              onChange={(event) => setCreateMode(event.target.value as EntryMode)}
              className="rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 outline-none focus:border-zinc-500 dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-100"
            >
              <option value="RECURRING">Monthly</option>
              <option value="ONE_OFF">One-time</option>
            </select>

            <input
              type="number"
              min="0"
              step="0.01"
              inputMode="decimal"
              value={createAmount}
              onChange={(event) => setCreateAmount(event.target.value)}
              placeholder="Amount"
              className="rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 outline-none focus:border-zinc-500 dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-100"
            />
          </div>

          <div className="mt-3 flex justify-end">
            <button
              type="button"
              onClick={createEntry}
              disabled={saving || !createAccountId}
              className="inline-flex items-center justify-center rounded-lg bg-zinc-900 px-4 py-2 text-sm font-medium text-white hover:bg-zinc-700 disabled:opacity-60 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-300"
            >
              {saving ? 'Saving...' : 'Create'}
            </button>
          </div>
        </div>
      ) : null}

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
      ) : rows.length === 0 ? (
        <p className="rounded-xl border border-zinc-200 bg-white p-4 text-sm text-zinc-600 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-300">
          No investment entries yet for this month. Use + Add investment.
        </p>
      ) : (
        <div className="space-y-3">
          {rows.map((row) => (
            <article key={row.id} className="rounded-xl border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-900">
              <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
                <div>
                  <p className="font-medium text-zinc-900 dark:text-zinc-100">{row.accountName}</p>
                  <p className="text-xs text-zinc-500 dark:text-zinc-400">{(editModes[row.id] ?? row.mode) === 'RECURRING' ? 'Monthly investment' : 'One-time investment'}</p>
                </div>
                <span className="rounded-full bg-zinc-100 px-2 py-1 text-xs font-medium text-zinc-700 dark:bg-zinc-800 dark:text-zinc-200">
                  {row.currency}
                </span>
              </div>

              <div className="grid gap-2 sm:grid-cols-[1fr_1fr_auto]">
                <select
                  value={editModes[row.id] ?? row.mode}
                  onChange={(event) =>
                    setEditModes((prev) => ({
                      ...prev,
                      [row.id]: event.target.value as EntryMode,
                    }))
                  }
                  className="rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 outline-none focus:border-zinc-500 dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-100"
                >
                  <option value="RECURRING">Monthly</option>
                  <option value="ONE_OFF">One-time</option>
                </select>

                <input
                  type="number"
                  min="0"
                  step="0.01"
                  inputMode="decimal"
                  value={editAmounts[row.id] ?? amountToInput(row.amount)}
                  onChange={(event) =>
                    setEditAmounts((prev) => ({
                      ...prev,
                      [row.id]: event.target.value,
                    }))
                  }
                  className="rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 outline-none focus:border-zinc-500 dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-100"
                />

                <button
                  type="button"
                  onClick={() => updateEntry(row)}
                  disabled={saving}
                  className="inline-flex items-center justify-center rounded-lg bg-zinc-900 px-4 py-2 text-sm font-medium text-white hover:bg-zinc-700 disabled:opacity-60 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-300"
                >
                  Update
                </button>
              </div>
            </article>
          ))}
        </div>
      )}
    </section>
  )
}
