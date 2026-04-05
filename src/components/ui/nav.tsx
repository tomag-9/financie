'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useEffect, useMemo, useState } from 'react'

type NavProps = {
  hasJojAlert: boolean
}

type NavItem = {
  href: string
  label: string
  shortLabel: string
  showBadge?: boolean
}

function isActivePath(pathname: string, href: string): boolean {
  if (href === '/dashboard') return pathname === '/dashboard'
  return pathname === href || pathname.startsWith(`${href}/`)
}

function ThemeToggle() {
  const [isDark, setIsDark] = useState(() => {
    if (typeof window === 'undefined') {
      return false
    }

    const stored = window.localStorage.getItem('theme')
    if (stored === 'dark') return true
    if (stored === 'light') return false
    return window.matchMedia('(prefers-color-scheme: dark)').matches
  })

  useEffect(() => {
    document.documentElement.classList.toggle('dark', isDark)
    window.localStorage.setItem('theme', isDark ? 'dark' : 'light')
  }, [isDark])

  function toggleTheme() {
    const next = !isDark
    setIsDark(next)
    document.documentElement.classList.toggle('dark', next)
    window.localStorage.setItem('theme', next ? 'dark' : 'light')
  }

  return (
    <button
      type="button"
      onClick={toggleTheme}
      className="rounded-lg border border-zinc-300 px-3 py-1.5 text-xs font-medium text-zinc-700 transition hover:bg-zinc-100 dark:border-zinc-700 dark:text-zinc-200 dark:hover:bg-zinc-800"
      aria-label="Prepnúť tému"
    >
      {isDark ? 'Svetlá téma' : 'Tmavá téma'}
    </button>
  )
}

export function AppNav({ hasJojAlert }: NavProps) {
  const pathname = usePathname()

  const items: NavItem[] = useMemo(
    () => [
      { href: '/dashboard', label: 'Dashboard', shortLabel: 'Domov' },
      { href: '/accounts', label: 'Účty', shortLabel: 'Účty' },
      { href: '/income', label: 'Zárobky', shortLabel: 'Príjem', showBadge: hasJojAlert },
      { href: '/investments', label: 'Investície', shortLabel: 'ETF' },
      { href: '/liabilities', label: 'Záväzky', shortLabel: 'Dlhy' },
      { href: '/settings', label: 'Nastavenia', shortLabel: 'Nastav.' },
    ],
    [hasJojAlert]
  )

  return (
    <>
      <aside className="hidden w-64 shrink-0 border-r border-zinc-200 bg-white/80 px-4 py-6 backdrop-blur dark:border-zinc-800 dark:bg-zinc-950/80 md:block">
        <div className="mb-6 flex items-center justify-between">
          <h2 className="text-lg font-semibold text-zinc-900 dark:text-zinc-100">Financie</h2>
          <ThemeToggle />
        </div>
        <nav className="space-y-1">
          {items.map((item) => {
            const active = isActivePath(pathname, item.href)
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`flex items-center justify-between rounded-lg px-3 py-2 text-sm transition ${
                  active
                    ? 'bg-zinc-900 text-white dark:bg-zinc-100 dark:text-zinc-900'
                    : 'text-zinc-700 hover:bg-zinc-100 dark:text-zinc-200 dark:hover:bg-zinc-800'
                }`}
              >
                <span>{item.label}</span>
                {item.showBadge ? (
                  <span className="rounded-full bg-rose-500 px-2 py-0.5 text-[10px] font-semibold text-white">JOJ</span>
                ) : null}
              </Link>
            )
          })}
        </nav>
      </aside>

      <nav className="fixed inset-x-0 bottom-0 z-40 border-t border-zinc-200 bg-white/95 px-2 py-1 backdrop-blur dark:border-zinc-800 dark:bg-zinc-950/95 md:hidden">
        <ul className="grid grid-cols-6 gap-1">
          {items.map((item) => {
            const active = isActivePath(pathname, item.href)
            return (
              <li key={item.href}>
                <Link
                  href={item.href}
                  className={`relative flex min-h-12 items-center justify-center rounded-md px-1 text-[11px] font-medium transition ${
                    active
                      ? 'bg-zinc-900 text-white dark:bg-zinc-100 dark:text-zinc-900'
                      : 'text-zinc-600 hover:bg-zinc-100 dark:text-zinc-300 dark:hover:bg-zinc-800'
                  }`}
                >
                  {item.shortLabel}
                  {item.showBadge ? (
                    <span className="absolute right-1 top-1 size-2 rounded-full bg-rose-500" aria-hidden="true" />
                  ) : null}
                </Link>
              </li>
            )
          })}
        </ul>
      </nav>
    </>
  )
}
