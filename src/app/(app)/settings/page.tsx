import Link from 'next/link'

export default function SettingsPage() {
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
          href="/accounts"
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
    </section>
  )
}
