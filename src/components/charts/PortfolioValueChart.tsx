'use client'

import { useMemo, useState } from 'react'
import { CartesianGrid, Legend, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'

type PortfolioPoint = {
  monthLabel: string
  portfolioValue: number
  benchmarkValue?: number | null
}

type PortfolioValueChartProps = {
  data: PortfolioPoint[]
  hasBenchmark: boolean
}

type HistoryRange = '6M' | '12M' | '24M' | 'ALL'

const HISTORY_OPTIONS: Array<{ value: HistoryRange; label: string; count?: number }> = [
  { value: '6M', label: '6M', count: 6 },
  { value: '12M', label: '12M', count: 12 },
  { value: '24M', label: '24M', count: 24 },
  { value: 'ALL', label: 'All' },
]

const currencyFormatter = new Intl.NumberFormat('sk-SK', {
  style: 'currency',
  currency: 'EUR',
  maximumFractionDigits: 2,
})

export function PortfolioValueChart({ data, hasBenchmark }: PortfolioValueChartProps) {
  const [range, setRange] = useState<HistoryRange>('12M')

  const visibleData = useMemo(() => {
    const option = HISTORY_OPTIONS.find((item) => item.value === range)
    if (!option?.count) return data
    return data.slice(-option.count)
  }, [data, range])

  return (
    <div className="w-full min-w-0">
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
      <div className="h-72 w-full min-w-0">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={visibleData} margin={{ top: 8, right: 12, left: 8, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#d4d4d8" />
            <XAxis dataKey="monthLabel" tick={{ fontSize: 12 }} />
            <YAxis tick={{ fontSize: 12 }} width={110} tickFormatter={(value) => currencyFormatter.format(Number(value))} />
            <Tooltip formatter={(value) => currencyFormatter.format(Number(value ?? 0))} />
            <Legend />
            <Line
              type="monotone"
              dataKey="portfolioValue"
              name="Portfólio"
              stroke="#0f766e"
              strokeWidth={2.5}
              dot={{ r: 2.5 }}
            />
            {hasBenchmark ? (
              <Line
                type="monotone"
                dataKey="benchmarkValue"
                name="Benchmark"
                stroke="#1d4ed8"
                strokeWidth={2}
                strokeDasharray="5 5"
                dot={false}
              />
            ) : null}
          </LineChart>
        </ResponsiveContainer>
      </div>
    </div>
  )
}
