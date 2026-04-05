import Link from 'next/link'

export default function SettingsPage() {
  return (
    <section className="space-y-4">
      <h2 className="text-2xl font-semibold tracking-tight">Nastavenia</h2>
      <p className="rounded-lg border border-zinc-200 bg-white p-4 text-sm text-zinc-600 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-300">
        Tu sa bude spravovať TOTP, custom fields a notifikácie.
      </p>
      <Link
        href="/settings/totp"
        className="inline-flex rounded-lg bg-zinc-900 px-3 py-2 text-sm font-medium text-white hover:bg-zinc-700 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-300"
      >
        Otvoriť TOTP nastavenia
      </Link>
    </section>
  )
}
