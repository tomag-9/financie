'use client'

import { useRouter } from 'next/navigation'
import { MonthPicker } from '@/components/ui/MonthPicker'

type SnapshotMonthPickerProps = {
  value: string
}

export function SnapshotMonthPicker({ value }: SnapshotMonthPickerProps) {
  const router = useRouter()

  return (
    <MonthPicker
      value={value}
      onChange={(month) => {
        router.push(`/snapshots/${month}`)
      }}
      className="w-full sm:w-[22rem]"
    />
  )
}