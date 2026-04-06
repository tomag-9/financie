'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useEffect, useMemo, useSyncExternalStore } from 'react'

type NavProps = {
  hasJojAlert: boolean
}

type NavItem = {
  href: string
  label: string
  icon: string
  showBadge?: boolean
}

const THEME_CHANGE_EVENT = 'financie-theme-change'

function isActivePath(pathname: string, href: string): boolean {
  if (href === '/dashboard') return pathname === '/dashboard'
  return pathname === href || pathname.startsWith(`${href}/`)
}

function ThemeToggle() {
  const isDark = useSyncExternalStore(
    (onStoreChange) => {
      window.addEventListener('storage', onStoreChange)
      window.addEventListener(THEME_CHANGE_EVENT, onStoreChange)
      const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)')
      mediaQuery.addEventListener('change', onStoreChange)

      return () => {
        window.removeEventListener('storage', onStoreChange)
        window.removeEventListener(THEME_CHANGE_EVENT, onStoreChange)
        mediaQuery.removeEventListener('change', onStoreChange)
      }
    },
    () => {
      const stored = window.localStorage.getItem('theme')
      if (stored === 'dark') return true
      if (stored === 'light') return false
      return window.matchMedia('(prefers-color-scheme: dark)').matches
    },
    () => false,
  )

  useEffect(() => {
    document.documentElement.classList.toggle('dark', isDark)
  }, [isDark])

  function toggleTheme() {
    const next = !isDark
    document.documentElement.classList.toggle('dark', next)
    window.localStorage.setItem('theme', next ? 'dark' : 'light')
    window.dispatchEvent(new Event(THEME_CHANGE_EVENT))
  }

  return (
    <button
      type="button"
      onClick={toggleTheme}
      className="rounded-full border border-zinc-300 px-3 py-1.5 text-xs font-medium text-zinc-700 transition hover:bg-zinc-100 dark:border-zinc-700 dark:text-zinc-200 dark:hover:bg-zinc-800"
      aria-label="Toggle theme"
    >
      {isDark ? 'Light theme' : 'Dark theme'}
    </button>
  )
}

function Icon({ path }: { path: string }) {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" className="size-5 fill-none stroke-current stroke-[2.25]">
      <path d={path} strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

export function AppNav({ hasJojAlert }: NavProps) {
  const pathname = usePathname()

  const items: NavItem[] = useMemo(
    () => [
      { href: '/dashboard', label: 'Dashboard', icon: 'M3 12h18M12 3v18' },
      { href: '/snapshots', label: 'Snapshots', icon: 'M8 2v4M16 2v4M3 10h18M5 6h14a2 2 0 0 1 2 2v10a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2Z' },
      { href: '/income', label: 'Income', icon: 'M4 14l4-4 3 3 5-6 4 4', showBadge: hasJojAlert },
      { href: '/investments', label: 'Investments', icon: 'M3 17l6-6 4 4 8-8' },
      { href: '/liabilities', label: 'Liabilities', icon: 'M4 12h16M12 4v16' },
      { href: '/settings', label: 'Settings', icon: 'M12 8a4 4 0 1 0 0 8 4 4 0 0 0 0-8Zm8 4-2.2.7a6.8 6.8 0 0 1-.4 1l1.3 1.9-1.9 1.9-1.9-1.3a6.8 6.8 0 0 1-1 .4L12 20l-2.7-2.2a6.8 6.8 0 0 1-1-.4l-1.9 1.3-1.9-1.9 1.3-1.9a6.8 6.8 0 0 1-.4-1L4 12l2.2-.7a6.8 6.8 0 0 1 .4-1L5.3 8.4l1.9-1.9 1.9 1.3a6.8 6.8 0 0 1 1-.4L12 4l2.7 2.2a6.8 6.8 0 0 1 1 .4l1.9-1.3 1.9 1.9-1.3 1.9c.17.33.3.67.4 1L20 12Z' },
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
                <span className="inline-flex items-center gap-2">
                  <Icon path={item.icon} />
                  {item.label}
                </span>
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
                  aria-label={item.label}
                  title={item.label}
                  className={`relative flex min-h-14 items-center justify-center rounded-xl border border-transparent px-1 transition ${
                    active
                        ? 'bg-zinc-900 text-white dark:bg-zinc-100 dark:text-zinc-900'
                    : 'text-zinc-600 hover:bg-zinc-100 dark:text-zinc-300 dark:hover:bg-zinc-800'
                  }`}
                >
                  <Icon path={item.icon} />
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
