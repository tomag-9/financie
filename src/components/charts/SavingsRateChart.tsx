'use client'

import { useMemo, useState } from 'react'
import { CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'

type SavingsPoint = {
  monthLabel: string
  savingsRate: number
}

type SavingsRateChartProps = {
  data: SavingsPoint[]
}

type HistoryRange = '6M' | '12M' | '24M' | 'ALL'

const HISTORY_OPTIONS: Array<{ value: HistoryRange; label: string; count?: number }> = [
  { value: '6M', label: '6M', count: 6 },
  { value: '12M', label: '12M', count: 12 },
  { value: '24M', label: '24M', count: 24 },
  { value: 'ALL', label: 'All' },
]

export function SavingsRateChart({ data }: SavingsRateChartProps) {
  const [range, setRange] = useState<HistoryRange>('12M')

  const visibleData = useMemo(() => {
    const option = HISTORY_OPTIONS.find((item) => item.value === range)
    if (!option?.count) return data
    return data.slice(-option.count)
  }, [data, range])

  return (
    <div className="h-52 w-full">
      <div className="mb-3 flex flex-wrap gap-2">
        {HISTORY_OPTIONS.map((option) => (
          <button
            key={option.value}
            type="button"
            onClick={() => setRange(option.value)}
            className={`rounded-full px-3 py-1 text-xs font-medium transition ${range === option.value ? 'bg-zinc-900 text-white dark:bg-zinc-100 dark:text-zinc-900' : 'border border-zinc-300 text-zinc-700 hover:bg-zinc-100 dark:border-zinc-700 dark:text-zinc-200 dark:hover:bg-zinc-800'}`}
          >
            {option.label}
          </button>
        ))}
      </div>
      <ResponsiveContainer>
        <LineChart data={visibleData}>
          <CartesianGrid strokeDasharray="3 3" stroke="#d4d4d8" />
          <XAxis dataKey="monthLabel" tick={{ fontSize: 12 }} />
          <YAxis tick={{ fontSize: 12 }} />
          <Tooltip formatter={(value) => `${Number(value).toFixed(2)} %`} />
          <Line type="monotone" dataKey="savingsRate" stroke="#2563eb" strokeWidth={2.5} dot={{ r: 3 }} />
        </LineChart>
      </ResponsiveContainer>
    </div>
  )
}
