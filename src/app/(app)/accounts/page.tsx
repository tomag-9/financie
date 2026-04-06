'use client'

import { FormEvent, useEffect, useMemo, useState } from 'react'

type AccountType = 'BANK' | 'INVESTMENT' | 'CASH' | 'PENSION'

type AccountItem = {
  id: string
  name: string
  type: AccountType
  currency: string
  isActive: boolean
  sortOrder: number
}

type AccountFormState = {
  name: string
  type: AccountType
  currency: string
}

const ACCOUNT_TYPES: AccountType[] = ['BANK', 'INVESTMENT', 'CASH', 'PENSION']

const DEFAULT_NEW_ACCOUNT: AccountFormState = {
  name: '',
  type: 'BANK',
  currency: 'EUR',
}

function normalizeForm(form: AccountFormState): AccountFormState {
  return {
    name: form.name.trim(),
    type: form.type,
    currency: form.currency.trim().toUpperCase(),
  }
}

export default function AccountsPage() {
  const [accounts, setAccounts] = useState<AccountItem[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [notice, setNotice] = useState<string | null>(null)

  const [newForm, setNewForm] = useState<AccountFormState>(DEFAULT_NEW_ACCOUNT)
  const [creating, setCreating] = useState(false)

  const [editingId, setEditingId] = useState<string | null>(null)
  const [editForm, setEditForm] = useState<AccountFormState>(DEFAULT_NEW_ACCOUNT)
  const [busyId, setBusyId] = useState<string | null>(null)

  const sortedAccounts = useMemo(
    () => [...accounts].sort((a, b) => a.sortOrder - b.sortOrder),
    [accounts],
  )

  const canCreate = useMemo(() => {
    const normalized = normalizeForm(newForm)
    return normalized.name.length > 0 && normalized.currency.length > 0
  }, [newForm])

  async function fetchAccounts() {
    setLoading(true)
    setError(null)

    try {
      const response = await fetch('/api/accounts', { cache: 'no-store' })
      const data = (await response.json()) as { accounts?: AccountItem[]; error?: string }

      if (!response.ok) {
        throw new Error(data.error ?? 'Failed to load accounts.')
      }

      setAccounts(data.accounts ?? [])
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load accounts.')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    void fetchAccounts()
  }, [])

  async function createAccount(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setNotice(null)
    setError(null)

    const payload = normalizeForm(newForm)
    if (!payload.name || !payload.currency) {
      setError('Enter the account name and currency.')
      return
    }

    setCreating(true)
    try {
      const response = await fetch('/api/accounts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })

      const data = (await response.json()) as { error?: string }

      if (!response.ok) {
        throw new Error(data.error ?? 'Failed to create the account.')
      }

      setNewForm(DEFAULT_NEW_ACCOUNT)
      setNotice('Account created.')
      await fetchAccounts()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create the account.')
    } finally {
      setCreating(false)
    }
  }

  function startEdit(account: AccountItem) {
    setEditingId(account.id)
    setEditForm({
      name: account.name,
      type: account.type,
      currency: account.currency,
    })
    setNotice(null)
    setError(null)
  }

  function cancelEdit() {
    setEditingId(null)
    setEditForm(DEFAULT_NEW_ACCOUNT)
  }

  async function saveEdit(id: string) {
    const payload = normalizeForm(editForm)
    if (!payload.name || !payload.currency) {
      setError('Enter the account name and currency.')
      return
    }

    setBusyId(id)
    setNotice(null)
    setError(null)

    try {
      const response = await fetch('/api/accounts', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'edit',
          id,
          ...payload,
        }),
      })
      const data = (await response.json()) as { error?: string }

      if (!response.ok) {
        throw new Error(data.error ?? 'Failed to update the account.')
      }

      setEditingId(null)
      setNotice('Account updated.')
      await fetchAccounts()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update the account.')
    } finally {
      setBusyId(null)
    }
  }

  async function deactivateAccount(id: string) {
    const confirmed = window.confirm('Do you really want to deactivate this account?')
    if (!confirmed) return

    setBusyId(id)
    setNotice(null)
    setError(null)

    try {
      const response = await fetch('/api/accounts', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'deactivate', id }),
      })
      const data = (await response.json()) as { error?: string }

      if (!response.ok) {
        throw new Error(data.error ?? 'Failed to deactivate the account.')
      }

      if (editingId === id) {
        cancelEdit()
      }
      setNotice('Account deactivated.')
      await fetchAccounts()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to deactivate the account.')
    } finally {
      setBusyId(null)
    }
  }

  async function moveAccount(id: string, direction: 'up' | 'down') {
    setBusyId(id)
    setNotice(null)
    setError(null)

    try {
      const response = await fetch('/api/accounts', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'move', id, direction }),
      })
      const data = (await response.json()) as { error?: string }

      if (!response.ok) {
        throw new Error(data.error ?? 'Failed to change the order.')
      }

      await fetchAccounts()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to change the order.')
    } finally {
      setBusyId(null)
    }
  }

  return (
    <section className="space-y-6">
      <div className="space-y-1">
        <h2 className="text-2xl font-semibold tracking-tight">Accounts</h2>
        <p className="text-sm text-zinc-600 dark:text-zinc-300">
          Manage accounts with simple CRUD, deactivation, and display order.
        </p>
      </div>

      <form
        onSubmit={createAccount}
        className="rounded-lg border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-900"
      >
          <h3 className="mb-4 text-sm font-semibold uppercase tracking-wide text-zinc-600 dark:text-zinc-300">
          Add account
        </h3>
        <div className="grid gap-3 sm:grid-cols-3">
          <input
            value={newForm.name}
            onChange={(event) => setNewForm((prev) => ({ ...prev, name: event.target.value }))}
            placeholder="Account name"
            className="rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm outline-none ring-zinc-400 focus:ring-2 dark:border-zinc-700 dark:bg-zinc-950"
          />

          <select
            value={newForm.type}
            onChange={(event) =>
              setNewForm((prev) => ({ ...prev, type: event.target.value as AccountType }))
            }
            className="rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm outline-none ring-zinc-400 focus:ring-2 dark:border-zinc-700 dark:bg-zinc-950"
          >
            {ACCOUNT_TYPES.map((type) => (
              <option key={type} value={type}>
                {type}
              </option>
            ))}
          </select>

          <input
            value={newForm.currency}
            onChange={(event) =>
              setNewForm((prev) => ({ ...prev, currency: event.target.value.toUpperCase() }))
            }
            maxLength={10}
            placeholder="Currency (EUR)"
            className="rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm uppercase outline-none ring-zinc-400 focus:ring-2 dark:border-zinc-700 dark:bg-zinc-950"
          />
        </div>

        <div className="mt-4 flex justify-end">
          <button
            type="submit"
            disabled={creating || !canCreate}
            className="rounded-md bg-zinc-900 px-4 py-2 text-sm font-medium text-white transition hover:bg-zinc-700 disabled:cursor-not-allowed disabled:opacity-60 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-300"
          >
            {creating ? 'Saving...' : 'Add account'}
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

      <div className="overflow-x-auto rounded-lg border border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-900">
        <table className="min-w-full divide-y divide-zinc-200 text-sm dark:divide-zinc-800">
          <thead className="bg-zinc-50 text-left text-xs uppercase tracking-wide text-zinc-600 dark:bg-zinc-950 dark:text-zinc-400">
            <tr>
              <th className="px-4 py-3">Názov</th>
              <th className="px-4 py-3">Typ</th>
              <th className="px-4 py-3">Mena</th>
              <th className="px-4 py-3">Poradie</th>
              <th className="px-4 py-3">Stav</th>
              <th className="px-4 py-3 text-right">Akcie</th>
            </tr>
          </thead>

          <tbody className="divide-y divide-zinc-200 dark:divide-zinc-800">
            {loading ? (
              <tr>
                <td colSpan={6} className="px-4 py-6 text-center text-zinc-500 dark:text-zinc-400">
                  Loading accounts...
                </td>
              </tr>
            ) : sortedAccounts.length === 0 ? (
              <tr>
                <td colSpan={6} className="px-4 py-6 text-center text-zinc-500 dark:text-zinc-400">
                  You do not have any accounts yet.
                </td>
              </tr>
            ) : (
              sortedAccounts.map((account, index) => {
                const isEditing = editingId === account.id
                const isBusy = busyId === account.id

                return (
                  <tr key={account.id}>
                    <td className="px-4 py-3 align-top">
                      {isEditing ? (
                        <input
                          value={editForm.name}
                          onChange={(event) =>
                            setEditForm((prev) => ({ ...prev, name: event.target.value }))
                          }
                          className="w-full rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm outline-none ring-zinc-400 focus:ring-2 dark:border-zinc-700 dark:bg-zinc-950"
                        />
                      ) : (
                        <span className="font-medium text-zinc-900 dark:text-zinc-100">{account.name}</span>
                      )}
                    </td>

                    <td className="px-4 py-3 align-top">
                      {isEditing ? (
                        <select
                          value={editForm.type}
                          onChange={(event) =>
                            setEditForm((prev) => ({
                              ...prev,
                              type: event.target.value as AccountType,
                            }))
                          }
                          className="w-full rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm outline-none ring-zinc-400 focus:ring-2 dark:border-zinc-700 dark:bg-zinc-950"
                        >
                          {ACCOUNT_TYPES.map((type) => (
                            <option key={type} value={type}>
                              {type}
                            </option>
                          ))}
                        </select>
                      ) : (
                        <span className="text-zinc-700 dark:text-zinc-300">{account.type}</span>
                      )}
                    </td>

                    <td className="px-4 py-3 align-top">
                      {isEditing ? (
                        <input
                          value={editForm.currency}
                          onChange={(event) =>
                            setEditForm((prev) => ({
                              ...prev,
                              currency: event.target.value.toUpperCase(),
                            }))
                          }
                          maxLength={10}
                          className="w-full rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm uppercase outline-none ring-zinc-400 focus:ring-2 dark:border-zinc-700 dark:bg-zinc-950"
                        />
                      ) : (
                        <span className="font-medium text-zinc-700 dark:text-zinc-300">{account.currency}</span>
                      )}
                    </td>

                    <td className="px-4 py-3 align-top text-zinc-600 dark:text-zinc-300">
                      {account.sortOrder}
                    </td>

                    <td className="px-4 py-3 align-top">
                      <span
                        className={`inline-flex rounded-full px-2 py-1 text-xs font-medium ${
                          account.isActive
                            ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300'
                            : 'bg-zinc-200 text-zinc-700 dark:bg-zinc-800 dark:text-zinc-300'
                        }`}
                      >
                        {account.isActive ? 'Active' : 'Inactive'}
                      </span>
                    </td>

                    <td className="px-4 py-3 align-top">
                      <div className="flex flex-wrap justify-end gap-2">
                        <button
                          type="button"
                          onClick={() => moveAccount(account.id, 'up')}
                          disabled={isBusy || index === 0}
                          className="rounded-md border border-zinc-300 px-2 py-1 text-xs font-medium text-zinc-700 transition hover:bg-zinc-100 disabled:cursor-not-allowed disabled:opacity-50 dark:border-zinc-700 dark:text-zinc-200 dark:hover:bg-zinc-800"
                        >
                          Up
                        </button>

                        <button
                          type="button"
                          onClick={() => moveAccount(account.id, 'down')}
                          disabled={isBusy || index === sortedAccounts.length - 1}
                          className="rounded-md border border-zinc-300 px-2 py-1 text-xs font-medium text-zinc-700 transition hover:bg-zinc-100 disabled:cursor-not-allowed disabled:opacity-50 dark:border-zinc-700 dark:text-zinc-200 dark:hover:bg-zinc-800"
                        >
                          Down
                        </button>

                        {isEditing ? (
                          <>
                            <button
                              type="button"
                              onClick={() => saveEdit(account.id)}
                              disabled={isBusy}
                              className="rounded-md bg-zinc-900 px-2 py-1 text-xs font-medium text-white transition hover:bg-zinc-700 disabled:cursor-not-allowed disabled:opacity-50 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-300"
                            >
                              Save
                            </button>
                            <button
                              type="button"
                              onClick={cancelEdit}
                              disabled={isBusy}
                              className="rounded-md border border-zinc-300 px-2 py-1 text-xs font-medium text-zinc-700 transition hover:bg-zinc-100 disabled:cursor-not-allowed disabled:opacity-50 dark:border-zinc-700 dark:text-zinc-200 dark:hover:bg-zinc-800"
                            >
                              Cancel
                            </button>
                          </>
                        ) : (
                          <button
                            type="button"
                            onClick={() => startEdit(account)}
                            disabled={isBusy}
                            className="rounded-md border border-zinc-300 px-2 py-1 text-xs font-medium text-zinc-700 transition hover:bg-zinc-100 disabled:cursor-not-allowed disabled:opacity-50 dark:border-zinc-700 dark:text-zinc-200 dark:hover:bg-zinc-800"
                          >
                            Edit
                          </button>
                        )}

                        <button
                          type="button"
                          onClick={() => deactivateAccount(account.id)}
                          disabled={isBusy || !account.isActive}
                          className="rounded-md border border-red-300 px-2 py-1 text-xs font-medium text-red-700 transition hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-50 dark:border-red-800 dark:text-red-300 dark:hover:bg-red-950/40"
                        >
                          Deactivate
                        </button>
                      </div>
                    </td>
                  </tr>
                )
              })
            )}
          </tbody>
        </table>
      </div>
    </section>
  )
}
