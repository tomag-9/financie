'use client'

import { FormEvent, useEffect, useMemo, useState } from 'react'

type LiabilityItem = {
  id: string
  name: string
  totalAmount: number
  remaining: number
  dueDate: string | null
  category: string | null
  isActive: boolean
  createdAt: string
  updatedAt: string
}

type LiabilityFormState = {
  name: string
  totalAmount: string
  remaining: string
  dueDate: string
  category: string
  isActive: boolean
}

const DEFAULT_FORM: LiabilityFormState = {
  name: '',
  totalAmount: '',
  remaining: '',
  dueDate: '',
  category: '',
  isActive: true,
}

const currencyFormatter = new Intl.NumberFormat('sk-SK', {
  style: 'currency',
  currency: 'EUR',
  maximumFractionDigits: 2,
})

const dateFormatter = new Intl.DateTimeFormat('sk-SK', {
  day: '2-digit',
  month: '2-digit',
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

function normalizeForm(form: LiabilityFormState): LiabilityFormState {
  return {
    name: form.name.trim(),
    totalAmount: form.totalAmount.trim(),
    remaining: form.remaining.trim(),
    dueDate: form.dueDate.trim(),
    category: form.category.trim(),
    isActive: form.isActive,
  }
}

function parseDateInput(value: string | null): Date | null {
  if (!value) return null
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value)
  if (!match) return null
  const year = Number(match[1])
  const month = Number(match[2])
  const day = Number(match[3])
  if (!Number.isInteger(year) || !Number.isInteger(month) || !Number.isInteger(day)) return null
  return new Date(Date.UTC(year, month - 1, day))
}

function daysUntilDue(dueDate: string | null): number | null {
  if (!dueDate) return null
  const parsed = new Date(dueDate)
  if (Number.isNaN(parsed.getTime())) return null
  const startToday = Date.UTC(new Date().getUTCFullYear(), new Date().getUTCMonth(), new Date().getUTCDate())
  const startDue = Date.UTC(parsed.getUTCFullYear(), parsed.getUTCMonth(), parsed.getUTCDate())
  return Math.ceil((startDue - startToday) / (24 * 60 * 60 * 1000))
}

function isDueSoon(item: LiabilityItem): boolean {
  const days = daysUntilDue(item.dueDate)
  return item.isActive && days !== null && days >= 0 && days < 30
}

function formatDueDate(dueDate: string | null): string {
  if (!dueDate) return 'Bez termínu'
  const parsed = new Date(dueDate)
  if (Number.isNaN(parsed.getTime())) return 'Bez termínu'
  return dateFormatter.format(parsed)
}

export default function LiabilitiesPage() {
  const [liabilities, setLiabilities] = useState<LiabilityItem[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [notice, setNotice] = useState<string | null>(null)
  const [creating, setCreating] = useState(false)
  const [busyId, setBusyId] = useState<string | null>(null)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [newForm, setNewForm] = useState<LiabilityFormState>(DEFAULT_FORM)
  const [editForm, setEditForm] = useState<LiabilityFormState>(DEFAULT_FORM)

  const sortedLiabilities = useMemo(
    () => [...liabilities].sort((left, right) => {
      if (left.isActive !== right.isActive) return left.isActive ? -1 : 1
      const leftDays = daysUntilDue(left.dueDate)
      const rightDays = daysUntilDue(right.dueDate)
      if (leftDays === null && rightDays === null) return left.name.localeCompare(right.name, 'sk-SK')
      if (leftDays === null) return 1
      if (rightDays === null) return -1
      return leftDays - rightDays
    }),
    [liabilities],
  )

  const activeLiabilities = useMemo(
    () => sortedLiabilities.filter((item) => item.isActive),
    [sortedLiabilities],
  )

  const activeTotal = useMemo(
    () => activeLiabilities.reduce((acc, item) => acc + item.remaining, 0),
    [activeLiabilities],
  )

  const dueSoonItems = useMemo(
    () => activeLiabilities.filter((item) => isDueSoon(item)),
    [activeLiabilities],
  )

  const paidCount = useMemo(
    () => liabilities.filter((item) => !item.isActive).length,
    [liabilities],
  )

  async function fetchLiabilities() {
    setLoading(true)
    setError(null)

    try {
      const response = await fetch('/api/liabilities', { cache: 'no-store' })
      const data = (await response.json()) as { liabilities?: LiabilityItem[]; error?: string }
      if (!response.ok) {
        throw new Error(data.error ?? 'Nepodarilo sa načítať záväzky.')
      }

      setLiabilities(data.liabilities ?? [])
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Nepodarilo sa načítať záväzky.')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    void fetchLiabilities()
  }, [])

  function startEdit(item: LiabilityItem) {
    setEditingId(item.id)
    setEditForm({
      name: item.name,
      totalAmount: String(item.totalAmount),
      remaining: String(item.remaining),
      dueDate: item.dueDate ? item.dueDate.slice(0, 10) : '',
      category: item.category ?? '',
      isActive: item.isActive,
    })
    setNotice(null)
    setError(null)
  }

  function cancelEdit() {
    setEditingId(null)
    setEditForm(DEFAULT_FORM)
  }

  async function createLiability(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setNotice(null)
    setError(null)

    const payload = normalizeForm(newForm)
    const totalAmount = Number(payload.totalAmount.replace(',', '.'))
    const remaining = payload.remaining ? Number(payload.remaining.replace(',', '.')) : totalAmount
    const dueDate = parseDateInput(payload.dueDate)

    if (!payload.name || !Number.isFinite(totalAmount) || totalAmount < 0) {
      setError('Vyplň názov a celkovú sumu záväzku.')
      return
    }

    setCreating(true)
    try {
      const response = await fetch('/api/liabilities', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: payload.name,
          totalAmount,
          remaining: Number.isFinite(remaining) && remaining >= 0 ? remaining : totalAmount,
          dueDate: dueDate ? dueDate.toISOString().slice(0, 10) : null,
          category: payload.category || null,
          isActive: payload.isActive,
        }),
      })
      const data = (await response.json()) as { error?: string }
      if (!response.ok) {
        throw new Error(data.error ?? 'Záväzok sa nepodarilo vytvoriť.')
      }

      setNewForm(DEFAULT_FORM)
      setNotice('Záväzok bol pridaný.')
      await fetchLiabilities()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Záväzok sa nepodarilo vytvoriť.')
    } finally {
      setCreating(false)
    }
  }

  async function saveEdit(id: string) {
    const payload = normalizeForm(editForm)
    const totalAmount = Number(payload.totalAmount.replace(',', '.'))
    const remaining = payload.remaining ? Number(payload.remaining.replace(',', '.')) : totalAmount
    const dueDate = parseDateInput(payload.dueDate)

    if (!payload.name || !Number.isFinite(totalAmount) || totalAmount < 0) {
      setError('Vyplň názov a celkovú sumu záväzku.')
      return
    }

    setBusyId(id)
    setNotice(null)
    setError(null)

    try {
      const response = await fetch('/api/liabilities', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'edit',
          id,
          name: payload.name,
          totalAmount,
          remaining: Number.isFinite(remaining) && remaining >= 0 ? remaining : totalAmount,
          dueDate: dueDate ? dueDate.toISOString().slice(0, 10) : null,
          category: payload.category || null,
          isActive: payload.isActive,
        }),
      })
      const data = (await response.json()) as { error?: string }
      if (!response.ok) {
        throw new Error(data.error ?? 'Záväzok sa nepodarilo upraviť.')
      }

      setEditingId(null)
      setNotice('Záväzok bol upravený.')
      await fetchLiabilities()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Záväzok sa nepodarilo upraviť.')
    } finally {
      setBusyId(null)
    }
  }

  async function markPaid(id: string) {
    const confirmed = window.confirm('Naozaj chceš označiť záväzok ako splatený?')
    if (!confirmed) return

    setBusyId(id)
    setNotice(null)
    setError(null)

    try {
      const response = await fetch('/api/liabilities', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'mark-paid', id }),
      })
      const data = (await response.json()) as { error?: string }
      if (!response.ok) {
        throw new Error(data.error ?? 'Záväzok sa nepodarilo označiť ako splatený.')
      }

      if (editingId === id) {
        cancelEdit()
      }
      setNotice('Záväzok bol označený ako splatený.')
      await fetchLiabilities()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Záväzok sa nepodarilo označiť ako splatený.')
    } finally {
      setBusyId(null)
    }
  }

  return (
    <section className="space-y-6">
      <header className="space-y-2">
        <h2 className="text-2xl font-semibold tracking-tight">Záväzky</h2>
        <div className="flex flex-wrap items-center gap-2 text-xs">
          <span className="inline-flex items-center gap-1 rounded-full bg-rose-100 px-2 py-1 font-medium text-rose-700 dark:bg-rose-900/40 dark:text-rose-300">
            {icon('M4 12h16M12 4v16')}
            Aktívne {currencyFormatter.format(activeTotal)}
          </span>
          <span className="inline-flex items-center gap-1 rounded-full bg-amber-100 px-2 py-1 font-medium text-amber-700 dark:bg-amber-900/40 dark:text-amber-300">
            {icon('M12 9v4m0 4h.01M10.3 5.2 3.1 18a2 2 0 0 0 1.7 3h14.4a2 2 0 0 0 1.7-3L13.7 5.2a2 2 0 0 0-3.4 0Z')}
            Do 30 dní {dueSoonItems.length}
          </span>
          <span className="inline-flex items-center gap-1 rounded-full bg-zinc-100 px-2 py-1 font-medium text-zinc-700 dark:bg-zinc-800 dark:text-zinc-200">
            {icon('M5 12h14')}
            Splatené {paidCount}
          </span>
        </div>
      </header>

      {dueSoonItems.length > 0 ? (
        <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-amber-900 dark:border-amber-900/60 dark:bg-amber-950/30 dark:text-amber-200">
          <div className="flex items-start gap-2">
            <span className="mt-0.5">{icon('M12 9v4m0 4h.01M10.3 5.2 3.1 18a2 2 0 0 0 1.7 3h14.4a2 2 0 0 0 1.7-3L13.7 5.2a2 2 0 0 0-3.4 0Z')}</span>
            <div>
              <p className="font-semibold">Máme záväzky s blížiacim sa termínom</p>
              <p className="text-sm">
                {dueSoonItems
                  .slice(0, 3)
                  .map((item) => {
                    const days = daysUntilDue(item.dueDate)
                    const label = days === 0 ? 'dnes' : days === 1 ? 'zajtra' : `o ${days} dní`
                    return `${item.name} (${label})`
                  })
                  .join(', ')}
              </p>
            </div>
          </div>
        </div>
      ) : null}

      <form
        onSubmit={createLiability}
        className="rounded-xl border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-900"
      >
        <h3 className="mb-4 text-sm font-semibold uppercase tracking-wide text-zinc-600 dark:text-zinc-300">
          Pridať záväzok
        </h3>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          <input
            value={newForm.name}
            onChange={(event) => setNewForm((prev) => ({ ...prev, name: event.target.value }))}
            placeholder="Názov záväzku"
            className="rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm outline-none ring-zinc-400 focus:ring-2 dark:border-zinc-700 dark:bg-zinc-950"
          />
          <input
            value={newForm.totalAmount}
            onChange={(event) => setNewForm((prev) => ({ ...prev, totalAmount: event.target.value }))}
            type="number"
            inputMode="decimal"
            min="0"
            step="0.01"
            placeholder="Celková suma"
            className="rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm outline-none ring-zinc-400 focus:ring-2 dark:border-zinc-700 dark:bg-zinc-950"
          />
          <input
            value={newForm.remaining}
            onChange={(event) => setNewForm((prev) => ({ ...prev, remaining: event.target.value }))}
            type="number"
            inputMode="decimal"
            min="0"
            step="0.01"
            placeholder="Zostatok (voliteľné)"
            className="rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm outline-none ring-zinc-400 focus:ring-2 dark:border-zinc-700 dark:bg-zinc-950"
          />
          <input
            value={newForm.dueDate}
            onChange={(event) => setNewForm((prev) => ({ ...prev, dueDate: event.target.value }))}
            type="date"
            className="rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm outline-none ring-zinc-400 focus:ring-2 dark:border-zinc-700 dark:bg-zinc-950"
          />
          <input
            value={newForm.category}
            onChange={(event) => setNewForm((prev) => ({ ...prev, category: event.target.value }))}
            placeholder="Kategória (pôžička, kreditka, iné)"
            className="rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm outline-none ring-zinc-400 focus:ring-2 dark:border-zinc-700 dark:bg-zinc-950"
          />
          <label className="inline-flex items-center gap-2 rounded-lg border border-zinc-300 bg-zinc-50 px-3 py-2 text-sm text-zinc-700 dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-200">
            <input
              type="checkbox"
              checked={newForm.isActive}
              onChange={(event) => setNewForm((prev) => ({ ...prev, isActive: event.target.checked }))}
              className="size-4 rounded border-zinc-300"
            />
            Aktívny
          </label>
        </div>

        <div className="mt-4 flex justify-end">
          <button
            type="submit"
            disabled={creating}
            className="inline-flex items-center gap-1 rounded-lg bg-zinc-900 px-4 py-2 text-sm font-medium text-white transition hover:bg-zinc-700 disabled:cursor-not-allowed disabled:opacity-60 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-300"
          >
            {icon('M12 5v14M5 12h14')}
            {creating ? 'Ukladám...' : 'Pridať záväzok'}
          </button>
        </div>
      </form>

      {error ? (
        <p className="rounded-lg border border-red-300 bg-red-50 p-3 text-sm text-red-700 dark:border-red-900 dark:bg-red-950/40 dark:text-red-300">
          {error}
        </p>
      ) : null}

      {notice ? (
        <p className="rounded-lg border border-emerald-300 bg-emerald-50 p-3 text-sm text-emerald-700 dark:border-emerald-900 dark:bg-emerald-950/40 dark:text-emerald-300">
          {notice}
        </p>
      ) : null}

      <div className="grid gap-3">
        {loading ? (
          <p className="rounded-xl border border-zinc-200 bg-white p-4 text-sm text-zinc-500 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-400">
            Načítavam záväzky...
          </p>
        ) : sortedLiabilities.length === 0 ? (
          <p className="rounded-xl border border-zinc-200 bg-white p-4 text-sm text-zinc-500 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-400">
            Zatiaľ nemáš žiadny záväzok.
          </p>
        ) : (
          sortedLiabilities.map((item) => {
            const isEditing = editingId === item.id
            const days = daysUntilDue(item.dueDate)
            const dueSoon = isDueSoon(item)
            const overdue = item.isActive && days !== null && days < 0
            return (
              <article
                key={item.id}
                className={`rounded-xl border p-4 ${dueSoon ? 'border-amber-300 bg-amber-50/40 dark:border-amber-900/60 dark:bg-amber-950/20' : overdue ? 'border-rose-300 bg-rose-50/40 dark:border-rose-900/60 dark:bg-rose-950/20' : 'border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-900'}`}
              >
                {isEditing ? (
                  <div className="space-y-3">
                    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                      <input
                        value={editForm.name}
                        onChange={(event) => setEditForm((prev) => ({ ...prev, name: event.target.value }))}
                        className="rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm outline-none ring-zinc-400 focus:ring-2 dark:border-zinc-700 dark:bg-zinc-950"
                      />
                      <input
                        value={editForm.totalAmount}
                        onChange={(event) => setEditForm((prev) => ({ ...prev, totalAmount: event.target.value }))}
                        type="number"
                        inputMode="decimal"
                        min="0"
                        step="0.01"
                        className="rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm outline-none ring-zinc-400 focus:ring-2 dark:border-zinc-700 dark:bg-zinc-950"
                      />
                      <input
                        value={editForm.remaining}
                        onChange={(event) => setEditForm((prev) => ({ ...prev, remaining: event.target.value }))}
                        type="number"
                        inputMode="decimal"
                        min="0"
                        step="0.01"
                        className="rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm outline-none ring-zinc-400 focus:ring-2 dark:border-zinc-700 dark:bg-zinc-950"
                      />
                      <input
                        value={editForm.dueDate}
                        onChange={(event) => setEditForm((prev) => ({ ...prev, dueDate: event.target.value }))}
                        type="date"
                        className="rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm outline-none ring-zinc-400 focus:ring-2 dark:border-zinc-700 dark:bg-zinc-950"
                      />
                      <input
                        value={editForm.category}
                        onChange={(event) => setEditForm((prev) => ({ ...prev, category: event.target.value }))}
                        placeholder="Kategória"
                        className="rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm outline-none ring-zinc-400 focus:ring-2 dark:border-zinc-700 dark:bg-zinc-950"
                      />
                      <label className="inline-flex items-center gap-2 rounded-lg border border-zinc-300 bg-zinc-50 px-3 py-2 text-sm text-zinc-700 dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-200">
                        <input
                          type="checkbox"
                          checked={editForm.isActive}
                          onChange={(event) => setEditForm((prev) => ({ ...prev, isActive: event.target.checked }))}
                          className="size-4 rounded border-zinc-300"
                        />
                        Aktívny
                      </label>
                    </div>

                    <div className="flex flex-wrap justify-end gap-2">
                      <button
                        type="button"
                        onClick={cancelEdit}
                        className="inline-flex items-center gap-1 rounded-lg border border-zinc-300 px-3 py-2 text-sm font-medium text-zinc-700 hover:bg-zinc-100 dark:border-zinc-700 dark:text-zinc-100 dark:hover:bg-zinc-800"
                      >
                        {icon('M6 6l12 12M18 6 6 18')}
                        Zrušiť
                      </button>
                      <button
                        type="button"
                        onClick={() => saveEdit(item.id)}
                        disabled={busyId === item.id}
                        className="inline-flex items-center gap-1 rounded-lg bg-zinc-900 px-3 py-2 text-sm font-medium text-white hover:bg-zinc-700 disabled:opacity-60 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-300"
                      >
                        {icon('M5 12l4 4L19 6')}
                        Uložiť
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                    <div className="space-y-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <h3 className="font-semibold text-zinc-900 dark:text-zinc-100">{item.name}</h3>
                        {!item.isActive ? (
                          <span className="rounded-full bg-zinc-200 px-2 py-0.5 text-[10px] font-semibold text-zinc-700 dark:bg-zinc-700 dark:text-zinc-200">
                            splatené
                          </span>
                        ) : null}
                        {dueSoon ? (
                          <span className="rounded-full bg-amber-200 px-2 py-0.5 text-[10px] font-semibold text-amber-900 dark:bg-amber-900 dark:text-amber-100">
                            termín sa blíži
                          </span>
                        ) : null}
                        {overdue ? (
                          <span className="rounded-full bg-rose-200 px-2 py-0.5 text-[10px] font-semibold text-rose-900 dark:bg-rose-900 dark:text-rose-100">
                            po termíne
                          </span>
                        ) : null}
                      </div>
                      <p className="text-sm text-zinc-600 dark:text-zinc-300">
                        {item.category ?? 'Bez kategórie'} · Splatnosť {formatDueDate(item.dueDate)}
                        {days !== null && item.isActive ? ` · ${days === 0 ? 'dnes' : days === 1 ? 'zajtra' : days > 1 ? `o ${days} dní` : `${Math.abs(days)} dní po termíne`}` : ''}
                      </p>
                      <p className="text-sm text-zinc-600 dark:text-zinc-300">
                        Celkom {currencyFormatter.format(item.totalAmount)} · Zostatok {currencyFormatter.format(item.remaining)}
                      </p>
                    </div>

                    <div className="flex flex-wrap gap-2">
                      <button
                        type="button"
                        onClick={() => startEdit(item)}
                        className="inline-flex items-center gap-1 rounded-lg border border-zinc-300 px-3 py-2 text-sm font-medium text-zinc-700 hover:bg-zinc-100 dark:border-zinc-700 dark:text-zinc-100 dark:hover:bg-zinc-800"
                      >
                        {icon('M4 20h4l10-10-4-4L4 16v4Z')}
                        Upraviť
                      </button>
                      <button
                        type="button"
                        onClick={() => markPaid(item.id)}
                        disabled={busyId === item.id || !item.isActive}
                        className="inline-flex items-center gap-1 rounded-lg border border-zinc-300 px-3 py-2 text-sm font-medium text-zinc-700 hover:bg-zinc-100 disabled:opacity-60 dark:border-zinc-700 dark:text-zinc-100 dark:hover:bg-zinc-800"
                      >
                        {icon('M5 12l4 4L19 6')}
                        Splatené
                      </button>
                    </div>
                  </div>
                )}
              </article>
            )
          })
        )}
      </div>
    </section>
  )
}
