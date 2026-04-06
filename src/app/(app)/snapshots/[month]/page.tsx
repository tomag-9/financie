import Link from 'next/link'
import { redirect } from 'next/navigation'
import { CustomFieldType } from '@prisma/client'
import { auth } from '@/lib/auth'
import { parseSnapshotCustomValues, serializeSnapshotCustomValues } from '@/lib/custom-fields'
import { prisma } from '@/lib/prisma'

type MonthSnapshotsPageProps = {
  params: Promise<{
    month: string
  }>
}

type ActiveAccountWithSnapshot = {
  id: string
  name: string
  type: string
  currency: string
  snapshotBalance: string | null
  customValues: Record<string, string | number | boolean | null>
}

function isValidMonthKey(month: string): boolean {
  return /^\d{4}-\d{2}$/.test(month)
}

function toMonthKeyInUtc(date: Date): string {
  const year = date.getUTCFullYear()
  const month = String(date.getUTCMonth() + 1).padStart(2, '0')
  return `${year}-${month}`
}

function parseMonthToUtcDate(monthKey: string): Date | null {
  if (!isValidMonthKey(monthKey)) return null

  const [yearPart, monthPart] = monthKey.split('-')
  const year = Number(yearPart)
  const monthIndex = Number(monthPart) - 1

  if (!Number.isInteger(year) || !Number.isInteger(monthIndex) || monthIndex < 0 || monthIndex > 11) {
    return null
  }

  return new Date(Date.UTC(year, monthIndex, 1, 0, 0, 0, 0))
}

function normalizeDecimalInput(raw: FormDataEntryValue | null): string | null {
  if (typeof raw !== 'string') return null

  const trimmed = raw.trim()
  if (!trimmed) return null

  return trimmed.replace(',', '.')
}

function normalizeCustomFieldValue(
  fieldType: CustomFieldType,
  raw: FormDataEntryValue | null,
): string | number | boolean | null | undefined {
  if (fieldType === 'BOOLEAN') {
    if (raw === null) return null
    const normalized = String(raw).trim().toLowerCase()
    if (!normalized) return null
    if (normalized === 'true') return true
    if (normalized === 'false') return false
    return null
  }

  if (typeof raw !== 'string') return null
  const trimmed = raw.trim()
  if (!trimmed) return null

  if (fieldType === 'NUMBER') {
    const normalized = Number(trimmed.replace(',', '.'))
    if (!Number.isFinite(normalized)) return undefined
    return normalized
  }

  return trimmed
}

async function saveAllBalances(monthKey: string, formData: FormData): Promise<void> {
  'use server'

  const session = await auth()
  if (!session) {
    redirect('/login')
  }

  const monthDate = parseMonthToUtcDate(monthKey)
  if (!monthDate) {
    redirect('/snapshots')
  }

  const activeAccounts = await prisma.account.findMany({
    where: { isActive: true },
    select: { id: true },
  })

  const activeCustomFields = await prisma.customField.findMany({
    where: { entityType: 'snapshot', isActive: true },
    orderBy: [{ sortOrder: 'asc' }, { id: 'asc' }],
    select: { id: true, fieldType: true },
  })

  await prisma.$transaction(
    activeAccounts.map((account) => {
      const rawValue = formData.get(`balance:${account.id}`)
      const normalizedValue = normalizeDecimalInput(rawValue)

      const customValues: Record<string, string | number | boolean | null> = {}
      for (const field of activeCustomFields) {
        const rawCustom = formData.get(`custom:${account.id}:${field.id}`)
        const normalizedCustom = normalizeCustomFieldValue(field.fieldType, rawCustom)
        if (normalizedCustom !== undefined) {
          customValues[field.id] = normalizedCustom
        }
      }

      const serializedCustomValues = serializeSnapshotCustomValues(customValues)

      return prisma.snapshot.upsert({
        where: {
          accountId_month: {
            accountId: account.id,
            month: monthDate,
          },
        },
        create: {
          accountId: account.id,
          month: monthDate,
          balance: normalizedValue,
          note: serializedCustomValues,
        },
        update: {
          balance: normalizedValue,
          note: serializedCustomValues,
        },
      })
    })
  )

  redirect('/dashboard')
}

async function loadActiveAccounts(monthDate: Date): Promise<ActiveAccountWithSnapshot[]> {
  const accounts = await prisma.account.findMany({
    where: { isActive: true },
    orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }],
    select: {
      id: true,
      name: true,
      type: true,
      currency: true,
      snapshots: {
        where: { month: monthDate },
        select: { balance: true, note: true },
      },
    },
  })

  return accounts.map((account) => ({
    id: account.id,
    name: account.name,
    type: account.type,
    currency: account.currency,
    snapshotBalance: account.snapshots[0]?.balance?.toString() ?? null,
    customValues: parseSnapshotCustomValues(account.snapshots[0]?.note),
  }))
}

export default async function MonthSnapshotsPage({ params }: MonthSnapshotsPageProps) {
  const { month: monthParam } = await params

  const monthDate = parseMonthToUtcDate(monthParam)
  if (!monthDate) {
    redirect(`/snapshots/${toMonthKeyInUtc(new Date())}`)
  }

  const monthKey = toMonthKeyInUtc(monthDate)
  const monthLabel = new Intl.DateTimeFormat('sk-SK', {
    month: 'long',
    year: 'numeric',
    timeZone: 'UTC',
  }).format(monthDate)

  const activeAccounts = await loadActiveAccounts(monthDate)
  const activeCustomFields = await prisma.customField.findMany({
    where: { entityType: 'snapshot', isActive: true },
    orderBy: [{ sortOrder: 'asc' }, { id: 'asc' }],
    select: { id: true, label: true, fieldType: true },
  })
  const saveForMonth = saveAllBalances.bind(null, monthKey)

  return (
    <section className="space-y-6">
      <header className="space-y-2">
        <h2 className="text-2xl font-semibold tracking-tight">Monthly snapshots</h2>
        <p className="text-sm text-zinc-600 dark:text-zinc-300">
          Enter balances for all active accounts. Empty fields are saved as null.
        </p>
      </header>

      <div className="rounded-xl border border-zinc-200 bg-white p-4 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
          <form action="/snapshots" method="get" className="flex items-end gap-2">
            <label htmlFor="month-picker" className="text-sm font-medium text-zinc-700 dark:text-zinc-200">
              Month
            </label>
            <input
              id="month-picker"
              name="month"
              type="month"
              defaultValue={monthKey}
              className="rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 outline-none ring-emerald-500 transition focus:ring-2 dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-100"
            />
            <button
              type="submit"
              className="rounded-lg border border-zinc-300 px-3 py-2 text-sm font-medium text-zinc-700 transition hover:bg-zinc-100 dark:border-zinc-700 dark:text-zinc-200 dark:hover:bg-zinc-800"
            >
              Open
            </button>
          </form>

          <p className="text-sm text-zinc-600 dark:text-zinc-300">Active month: {monthLabel}</p>
        </div>
      </div>

      <form action={saveForMonth} className="space-y-4">
        <div className="grid gap-3 md:grid-cols-2">
          {activeAccounts.map((account) => {
            const hasValue = account.snapshotBalance !== null

            return (
              <div
                key={account.id}
                className={`rounded-xl border p-4 transition ${
                  hasValue
                    ? 'border-emerald-200 bg-emerald-50/70 dark:border-emerald-900/70 dark:bg-emerald-950/20'
                    : 'border-zinc-200 bg-zinc-50/70 dark:border-zinc-800 dark:bg-zinc-900/70'
                }`}
              >
                <div className="mb-3 flex items-start justify-between gap-3">
                  <div>
                    <p className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">{account.name}</p>
                    <p className="text-xs uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
                      {account.type} • {account.currency}
                    </p>
                  </div>
                  <span
                    className={`rounded-full px-2 py-1 text-[11px] font-medium ${
                      hasValue
                        ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300'
                        : 'bg-zinc-200 text-zinc-700 dark:bg-zinc-800 dark:text-zinc-300'
                    }`}
                  >
                    {hasValue ? 'Filled' : 'Empty'}
                  </span>
                </div>

                <label htmlFor={`balance-${account.id}`} className="sr-only">
                  Balance for {account.name}
                </label>
                <input
                  id={`balance-${account.id}`}
                  name={`balance:${account.id}`}
                  type="number"
                  step="0.01"
                  inputMode="decimal"
                  placeholder=""
                  defaultValue={account.snapshotBalance ?? ''}
                  className={`w-full rounded-lg border px-3 py-2 text-sm text-zinc-900 outline-none ring-emerald-500 transition focus:ring-2 dark:text-zinc-100 ${
                    hasValue
                      ? 'border-emerald-300 bg-emerald-50 dark:border-emerald-900/70 dark:bg-emerald-950/30'
                      : 'border-zinc-300 bg-white dark:border-zinc-700 dark:bg-zinc-950'
                  }`}
                />

                {activeCustomFields.length > 0 ? (
                  <div className="mt-4 space-y-3 border-t border-zinc-200 pt-3 dark:border-zinc-800">
                    <p className="text-xs font-medium uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
                      Custom fields
                    </p>
                    {activeCustomFields.map((field) => {
                      const fieldName = `custom:${account.id}:${field.id}`
                      const defaultValue = account.customValues[field.id]

                      return (
                        <div key={field.id} className="space-y-1">
                          <label htmlFor={`${fieldName}-input`} className="block text-xs font-medium text-zinc-600 dark:text-zinc-300">
                            {field.label}
                          </label>

                          {field.fieldType === 'BOOLEAN' ? (
                            <select
                              id={`${fieldName}-input`}
                              name={fieldName}
                              defaultValue={
                                typeof defaultValue === 'boolean'
                                  ? defaultValue
                                    ? 'true'
                                    : 'false'
                                  : ''
                              }
                              className="w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 outline-none focus:border-zinc-500 dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-100"
                            >
                              <option value="">Not set</option>
                              <option value="true">Yes</option>
                              <option value="false">No</option>
                            </select>
                          ) : field.fieldType === 'NUMBER' ? (
                            <input
                              id={`${fieldName}-input`}
                              name={fieldName}
                              type="number"
                              step="0.01"
                              inputMode="decimal"
                              defaultValue={typeof defaultValue === 'number' ? defaultValue : ''}
                              className="w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 outline-none focus:border-zinc-500 dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-100"
                            />
                          ) : (
                            <input
                              id={`${fieldName}-input`}
                              name={fieldName}
                              type="text"
                              defaultValue={typeof defaultValue === 'string' ? defaultValue : ''}
                              className="w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 outline-none focus:border-zinc-500 dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-100"
                            />
                          )}
                        </div>
                      )
                    })}
                  </div>
                ) : null}
              </div>
            )
          })}
        </div>

        {activeAccounts.length === 0 ? (
          <div className="rounded-xl border border-dashed border-zinc-300 bg-zinc-50 p-5 text-sm text-zinc-600 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-300">
            There are no active accounts. Add an account in Accounts.
          </div>
        ) : null}

        <div className="flex flex-wrap items-center gap-3">
          <button
            type="submit"
            className="rounded-lg bg-zinc-900 px-4 py-2 text-sm font-semibold text-white transition hover:bg-zinc-800 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-200"
          >
            Save all balances
          </button>
          <Link
            href="/dashboard"
            className="rounded-lg border border-zinc-300 px-4 py-2 text-sm font-medium text-zinc-700 transition hover:bg-zinc-100 dark:border-zinc-700 dark:text-zinc-200 dark:hover:bg-zinc-800"
          >
            Cancel
          </Link>
        </div>
      </form>
    </section>
  )
}
