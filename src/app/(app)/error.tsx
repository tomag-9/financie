'use client'

import { useEffect } from 'react'

export default function AppError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => { console.error('[ui] App route failed', error) }, [error])
  return <section className="mx-auto mt-16 max-w-xl rounded-2xl border border-rose-200 bg-white p-8 text-center shadow-sm dark:border-rose-900 dark:bg-zinc-950">
    <p className="text-xs font-semibold uppercase tracking-[0.2em] text-rose-600">Niečo sa pokazilo</p>
    <h1 className="mt-2 text-2xl font-semibold">Sekciu sa nepodarilo načítať</h1>
    <p className="mt-2 text-sm text-zinc-600 dark:text-zinc-400">Skús požiadavku zopakovať. Ak problém ostane, pozri systémové logy.</p>
    {error.digest ? <p className="mt-3 font-mono text-xs text-zinc-400">ID: {error.digest}</p> : null}
    <button type="button" onClick={reset} className="mt-6 rounded-xl bg-zinc-900 px-4 py-2 text-sm font-semibold text-white dark:bg-zinc-100 dark:text-zinc-900">Skúsiť znova</button>
  </section>
}
