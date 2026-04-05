import Link from 'next/link'

export default function IncomePage() {
  return (
    <section className="space-y-4">
      <h2 className="text-2xl font-semibold tracking-tight">Zárobky</h2>
      <p className="rounded-lg border border-zinc-200 bg-white p-4 text-sm text-zinc-600 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-300">
        F3-1 a F3-2 budú doplnené v ďalšej fáze.
      </p>
      <Link
        href="/income/joj"
        className="inline-flex rounded-lg border border-zinc-300 px-3 py-2 text-sm font-medium text-zinc-700 hover:bg-zinc-100 dark:border-zinc-700 dark:text-zinc-200 dark:hover:bg-zinc-800"
      >
        Otvoriť JOJ detail
      </Link>
    </section>
  )
}
