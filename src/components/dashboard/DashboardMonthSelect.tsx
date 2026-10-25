'use client'

import { useRouter } from 'next/navigation'
import { MonthPicker } from '@/components/ui/MonthPicker'

type DashboardMonthSelectProps = {
  selectedMonthKey: string
}

export function DashboardMonthSelect({ selectedMonthKey }: DashboardMonthSelectProps) {
  const router = useRouter()

  return (
    <MonthPicker
      value={selectedMonthKey}
      onChange={(month) => {
        router.push(`/finance/dashboard?month=${month}`)
      }}
      className="w-full sm:w-[22rem]"
    />
  )
}
