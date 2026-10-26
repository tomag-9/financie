import Link from 'next/link'
import { cookies } from 'next/headers'
import type { Prisma } from '@prisma/client'
import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { auth, signOut } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import type { SettingsData } from '@/types'

// Settings reads user data from SQLite and must never run during image build.
export const dynamic = 'force-dynamic'

function IconLogout() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" className="size-5 fill-none stroke-current stroke-[2.25]">
      <path d="M16 17l5-5-5-5M21 12H9m6 7v2a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h8a2 2 0 0 1 2 2v2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

async function logoutAction(): Promise<void> {
  'use server'

  const cookieStore = await cookies()
  cookieStore.delete('totp_verified')
  await signOut({ redirectTo: '/login' })
}

async function saveFinanceSettings(formData: FormData): Promise<void> {
  'use server'

  if (!(await auth())) redirect('/login')
  const parsed = Number(String(formData.get('savingsGoalPct') ?? '').replace(',', '.'))
  if (!Number.isFinite(parsed) || parsed < 0 || parsed > 1000) return

  const settings = await prisma.settings.findUnique({ where: { id: 'singleton' }, select: { data: true } })
  const current = (settings?.data ?? {}) as SettingsData
  const nextData = { ...current, savings_goal_pct: parsed } as unknown as Prisma.InputJsonValue
  await prisma.settings.upsert({
    where: { id: 'singleton' },
    create: { id: 'singleton', data: nextData },
    update: { data: nextData },
  })
  revalidatePath('/settings')
  revalidatePath('/finance/dashboard')
}

export default async function SettingsPage() {
  const settings = await prisma.settings.findUnique({ where: { id: 'singleton' }, select: { data: true } })
  const settingsData = (settings?.data ?? {}) as SettingsData
  const savingsGoalPct = settingsData.savings_goal_pct ?? 20

  return (
    <section className="space-y-4">
      <div className="space-y-1">
        <h2 className="text-2xl font-semibold tracking-tight">Settings</h2>
        <p className="text-sm text-zinc-600 dark:text-zinc-300">
          TOTP, accounts, custom fields, and notifications are managed here.
        </p>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <Link
          href="/finance/accounts"
          className="rounded-xl border border-zinc-200 bg-white p-4 transition hover:border-zinc-300 hover:bg-zinc-50 dark:border-zinc-800 dark:bg-zinc-900 dark:hover:border-zinc-700 dark:hover:bg-zinc-800/70"
        >
          <p className="text-xs uppercase tracking-wide text-zinc-500 dark:text-zinc-400">Data setup</p>
          <h3 className="mt-2 text-base font-semibold text-zinc-900 dark:text-zinc-100">Accounts</h3>
          <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-300">Add, edit, deactivate, and reorder accounts.</p>
        </Link>

        <Link
          href="/settings/totp"
          className="rounded-xl border border-zinc-200 bg-white p-4 transition hover:border-zinc-300 hover:bg-zinc-50 dark:border-zinc-800 dark:bg-zinc-900 dark:hover:border-zinc-700 dark:hover:bg-zinc-800/70"
        >
          <p className="text-xs uppercase tracking-wide text-zinc-500 dark:text-zinc-400">Security</p>
          <h3 className="mt-2 text-base font-semibold text-zinc-900 dark:text-zinc-100">TOTP</h3>
          <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-300">Two-factor login and backup codes.</p>
        </Link>

        <Link
          href="/settings/custom-fields"
          className="rounded-xl border border-zinc-200 bg-white p-4 transition hover:border-zinc-300 hover:bg-zinc-50 dark:border-zinc-800 dark:bg-zinc-900 dark:hover:border-zinc-700 dark:hover:bg-zinc-800/70"
        >
          <p className="text-xs uppercase tracking-wide text-zinc-500 dark:text-zinc-400">Snapshots</p>
          <h3 className="mt-2 text-base font-semibold text-zinc-900 dark:text-zinc-100">Custom fields</h3>
          <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-300">Extra columns for monthly snapshot inputs.</p>
        </Link>

        <Link
          href="/settings/notifications"
          className="rounded-xl border border-zinc-200 bg-white p-4 transition hover:border-zinc-300 hover:bg-zinc-50 dark:border-zinc-800 dark:bg-zinc-900 dark:hover:border-zinc-700 dark:hover:bg-zinc-800/70"
        >
          <p className="text-xs uppercase tracking-wide text-zinc-500 dark:text-zinc-400">PWA</p>
          <h3 className="mt-2 text-base font-semibold text-zinc-900 dark:text-zinc-100">Notifications</h3>
          <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-300">Push alerts and subscription settings.</p>
        </Link>
      </div>

      <form action={saveFinanceSettings} className="max-w-xl rounded-xl border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-900">
        <p className="text-xs uppercase tracking-wide text-zinc-500 dark:text-zinc-400">Finance</p>
        <h3 className="mt-2 text-base font-semibold text-zinc-900 dark:text-zinc-100">Savings goal</h3>
        <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-300">Target share of monthly income invested. Rates above 100 % remain visible in analytics.</p>
        <div className="mt-3 flex items-end gap-2">
          <label className="flex-1 text-sm text-zinc-700 dark:text-zinc-200">
            Target (%)
            <input
              name="savingsGoalPct"
              type="number"
              min="0"
              max="1000"
              step="0.1"
              defaultValue={savingsGoalPct}
              className="mt-1 w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-zinc-900 dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-100"
            />
          </label>
          <button type="submit" className="rounded-lg bg-zinc-900 px-4 py-2 text-sm font-medium text-white dark:bg-zinc-100 dark:text-zinc-900">Save</button>
        </div>
      </form>

      <div className="pt-2">
        <form action={logoutAction}>
          <button
            type="submit"
            className="inline-flex items-center gap-2 rounded-lg border border-rose-300 bg-rose-50 px-4 py-2 text-sm font-medium text-rose-700 transition hover:bg-rose-100 dark:border-rose-900/60 dark:bg-rose-950/30 dark:text-rose-300"
          >
            <IconLogout />
            <span>Logout</span>
          </button>
        </form>
      </div>
    </section>
  )
}
