'use client'

import { usePathname, useRouter } from 'next/navigation'
import { useMemo } from 'react'

type ModeOption = {
  label: string
  value: 'finance' | 'ai-alarm'
  href: string
}

export function HeaderModeSelect() {
  const router = useRouter()
  const pathname = usePathname()

  const options = useMemo<ModeOption[]>(
    () => [
      { label: 'AI Alarm', value: 'ai-alarm', href: '/ai-alarm' },
      { label: 'Finance', value: 'finance', href: '/dashboard' },
    ],
    []
  )

  const current = pathname.startsWith('/ai-alarm') ? 'ai-alarm' : 'finance'

  return (
    <select
      aria-label="App mode"
      value={current}
      onChange={(event) => {
        const selected = options.find((option) => option.value === event.target.value)
        if (selected) {
          router.push(selected.href)
        }
      }}
      className="w-full rounded-lg border border-zinc-200 bg-white px-3 py-2 text-sm font-semibold text-zinc-900 shadow-sm transition focus:border-zinc-400 focus:outline-none dark:border-zinc-800 dark:bg-zinc-950 dark:text-zinc-100"
    >
      {options.map((option) => (
        <option key={option.value} value={option.value}>
          {option.label}
        </option>
      ))}
    </select>
  )
}
