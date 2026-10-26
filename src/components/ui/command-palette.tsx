'use client'

import Link from 'next/link'
import { useEffect, useMemo, useRef, useState } from 'react'

const destinations = [
  { href: '/home', label: 'Prehľad', keywords: 'domov stav upozornenia' },
  { href: '/finance/dashboard', label: 'Finančný dashboard', keywords: 'peniaze majetok trendy' },
  { href: '/finance/snapshots', label: 'Mesačné snapshoty', keywords: 'zostatky účty' },
  { href: '/finance/income', label: 'Príjmy', keywords: 'joj honorár' },
  { href: '/finance/investments', label: 'Investície', keywords: 'etf portfólio vklady' },
  { href: '/finance/liabilities', label: 'Záväzky', keywords: 'dlhy' },
  { href: '/ai-runner', label: 'AI alarmy', keywords: 'claude codex automatizácia' },
  { href: '/proxmox', label: 'Proxmox', keywords: 'lxc kontajnery server' },
  { href: '/logs', label: 'Systémové logy', keywords: 'chyby diagnostika udalosti' },
  { href: '/settings', label: 'Nastavenia', keywords: 'totp notifikácie bezpečnosť' },
]

export function CommandPalette() {
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState('')
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'k') {
        event.preventDefault()
        setOpen((value) => !value)
      }
      if (event.key === 'Escape') setOpen(false)
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [])

  useEffect(() => {
    if (open) window.setTimeout(() => inputRef.current?.focus(), 0)
    else setQuery('')
  }, [open])

  const results = useMemo(() => {
    const needle = query.trim().toLocaleLowerCase('sk')
    if (!needle) return destinations
    return destinations.filter((item) => `${item.label} ${item.keywords}`.toLocaleLowerCase('sk').includes(needle))
  }, [query])

  return (
    <>
      <button type="button" onClick={() => setOpen(true)} className="inline-flex items-center gap-2 rounded-xl border border-zinc-200 bg-white px-3 py-2 text-xs font-medium text-zinc-600 shadow-sm transition hover:bg-zinc-50 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-300 dark:hover:bg-zinc-800">
        Rýchlo otvoriť <kbd className="rounded border border-zinc-200 px-1.5 py-0.5 font-mono text-[10px] dark:border-zinc-700">⌘ K</kbd>
      </button>
      {open ? (
        <div className="fixed inset-0 z-[100] flex items-start justify-center bg-zinc-950/55 px-4 pt-[12vh] backdrop-blur-sm" role="dialog" aria-modal="true" aria-label="Rýchla navigácia" onMouseDown={(event) => { if (event.target === event.currentTarget) setOpen(false) }}>
          <div className="w-full max-w-xl overflow-hidden rounded-2xl border border-zinc-200 bg-white shadow-2xl dark:border-zinc-700 dark:bg-zinc-900">
            <input ref={inputRef} value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Kam chceš ísť?" className="w-full border-b border-zinc-200 bg-transparent px-5 py-4 text-base outline-none dark:border-zinc-800" />
            <div className="max-h-80 overflow-y-auto p-2">
              {results.map((item) => <Link key={item.href} href={item.href} onClick={() => setOpen(false)} className="flex items-center justify-between rounded-xl px-3 py-3 text-sm font-medium hover:bg-zinc-100 dark:hover:bg-zinc-800">{item.label}<span className="text-zinc-400">→</span></Link>)}
              {results.length === 0 ? <p className="px-3 py-8 text-center text-sm text-zinc-500">Nič som nenašiel.</p> : null}
            </div>
          </div>
        </div>
      ) : null}
    </>
  )
}
