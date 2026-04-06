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
    <div className="w-full min-w-0">
      <div className="mb-3 sm:hidden">
        <select
          value={range}
          onChange={(event) => setRange(event.target.value as HistoryRange)}
          className="w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-xs font-medium text-zinc-700 outline-none ring-zinc-400 focus:ring-2 dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-200"
        >
          {HISTORY_OPTIONS.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
      </div>

      <div className="mb-3 hidden gap-2 sm:flex sm:flex-wrap">
        {HISTORY_OPTIONS.map((option) => (
          <button
            key={option.value}
            type="button"
            onClick={() => setRange(option.value)}
            className={`shrink-0 rounded-full px-3 py-1 text-xs font-medium transition ${range === option.value ? 'bg-zinc-900 text-white dark:bg-zinc-100 dark:text-zinc-900' : 'border border-zinc-300 text-zinc-700 hover:bg-zinc-100 dark:border-zinc-700 dark:text-zinc-200 dark:hover:bg-zinc-800'}`}
          >
            {option.label}
          </button>
        ))}
      </div>
      <div className="h-52 w-full min-w-0">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={visibleData}>
            <CartesianGrid strokeDasharray="3 3" stroke="#d4d4d8" />
            <XAxis dataKey="monthLabel" tick={{ fontSize: 12, fill: '#52525b' }} axisLine={{ stroke: '#a1a1aa' }} tickLine={{ stroke: '#a1a1aa' }} />
            <YAxis tick={{ fontSize: 12, fill: '#52525b' }} axisLine={{ stroke: '#a1a1aa' }} tickLine={{ stroke: '#a1a1aa' }} />
            <Tooltip
              formatter={(value) => `${Math.round(Number(value))} %`}
              contentStyle={{
                backgroundColor: '#ffffff',
                border: '1px solid #d4d4d8',
                borderRadius: '12px',
                color: '#18181b',
              }}
              labelStyle={{ color: '#52525b' }}
              itemStyle={{ color: '#18181b' }}
            />
            <Line type="monotone" dataKey="savingsRate" stroke="#2563eb" strokeWidth={2.5} dot={{ r: 3 }} />
          </LineChart>
        </ResponsiveContainer>
      </div>
    </div>
  )
}
