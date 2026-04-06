'use client'

import { useRouter } from 'next/navigation'
import { MonthPicker } from '@/components/ui/MonthPicker'

type MonthOption = {
  key: string
  label: string
}

type DashboardMonthSelectProps = {
  selectedMonthKey: string
}

export function DashboardMonthSelect({ selectedMonthKey }: DashboardMonthSelectProps) {
  const router = useRouter()

  return (
    <MonthPicker
      value={selectedMonthKey}
      onChange={(month) => {
        router.push(`/dashboard?month=${month}`)
      }}
      className="w-full sm:w-[22rem]"
    />
  )
}
