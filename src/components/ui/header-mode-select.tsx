
'use client'

import { usePathname, useRouter } from 'next/navigation'
import { useEffect, useMemo, useState } from 'react'

type ModeOption = {
  label: string
  value: 'finance' | 'ai-runner'
  href: string
}

export function HeaderModeSelect() {
  const router = useRouter()
  const pathname = usePathname()
  const [isOpen, setIsOpen] = useState(false)

  const options = useMemo<ModeOption[]>(
    () => [
      { label: 'AI Runner', value: 'ai-runner', href: '/ai-runner' },
      { label: 'Finance', value: 'finance', href: '/finance/dashboard' },
    ],
    []
  )

  const current = pathname.startsWith('/ai-runner') ? 'ai-runner' : 'finance'
  const currentLabel = options.find((option) => option.value === current)?.label ?? 'Finance'

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      const target = event.target as HTMLElement | null
      if (!target?.closest('[data-mode-select]')) {
        setIsOpen(false)
      }
    }

    if (isOpen) {
      window.addEventListener('click', handleClickOutside)
    }

    return () => {
      window.removeEventListener('click', handleClickOutside)
    }
  }, [isOpen])

  return (
    <div className="relative" data-mode-select>
      <button
        type="button"
        aria-label="App mode"
        aria-expanded={isOpen}
        onClick={() => setIsOpen((prev) => !prev)}
        className="flex w-full items-center justify-between rounded-lg border border-zinc-200 bg-white px-3 py-2 text-sm font-semibold text-zinc-900 shadow-sm transition focus:border-zinc-400 focus:outline-none dark:border-zinc-800 dark:bg-zinc-950 dark:text-zinc-100"
      >
        <span>{currentLabel}</span>
        <span className="text-xs text-zinc-400">Change</span>
      </button>
      {isOpen ? (
        <div className="absolute left-0 right-0 z-20 mt-2 overflow-hidden rounded-xl border border-zinc-200 bg-white shadow-lg dark:border-zinc-800 dark:bg-zinc-950">
          {options.map((option) => (
            <button
              key={option.value}
              type="button"
              onClick={() => {
                setIsOpen(false)
                router.push(option.href)
              }}
              className={`flex w-full items-center justify-between px-3 py-2 text-sm transition ${
                option.value === current
                  ? 'bg-zinc-900 text-white dark:bg-zinc-100 dark:text-zinc-900'
                  : 'text-zinc-700 hover:bg-zinc-100 dark:text-zinc-300 dark:hover:bg-zinc-900'
              }`}
            >
              <span>{option.label}</span>
              {option.value === current ? <span className="text-xs">Active</span> : null}
            </button>
          ))}
        </div>
      ) : null}
    </div>
  )
}
