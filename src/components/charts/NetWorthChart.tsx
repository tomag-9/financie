'use client'

import { useMemo, useState } from 'react'
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'

type LinePoint = {
  monthLabel: string
  netWorth: number
}

type BarPoint = {
  accountName: string
  amount: number
}

type NetWorthChartProps = {
  lineData: LinePoint[]
  distributionData: BarPoint[]
}

type HistoryRange = '6M' | '12M' | '24M' | 'ALL'

const HISTORY_OPTIONS: Array<{ value: HistoryRange; label: string; count?: number }> = [
  { value: '6M', label: '6M', count: 6 },
  { value: '12M', label: '12M', count: 12 },
  { value: '24M', label: '24M', count: 24 },
  { value: 'ALL', label: 'All' },
]

const BAR_COLORS = ['#0f766e', '#0369a1', '#d97706', '#be123c', '#334155', '#15803d', '#a16207']

const currencyFormatter = new Intl.NumberFormat('sk-SK', {
  style: 'currency',
  currency: 'EUR',
  maximumFractionDigits: 2,
})

function formatTooltipValue(value: number | string | ReadonlyArray<number | string> | undefined): string {
  if (Array.isArray(value)) {
    const firstValue = Number(value[0] ?? 0)
    return currencyFormatter.format(firstValue)
  }

  return currencyFormatter.format(Number(value ?? 0))
}

export function NetWorthChart({ lineData, distributionData }: NetWorthChartProps) {
  const [range, setRange] = useState<HistoryRange>('12M')

  const visibleLineData = useMemo(() => {
    const option = HISTORY_OPTIONS.find((item) => item.value === range)
    if (!option?.count) return lineData
    return lineData.slice(-option.count)
  }, [lineData, range])

  return (
    <div className="grid gap-4 xl:grid-cols-2">
      <div className="rounded-xl border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-900">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
          <h3 className="text-sm font-semibold text-zinc-700 dark:text-zinc-200">Net worth over time</h3>
          <div className="flex flex-wrap gap-2">
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
        </div>
        <div className="h-72 w-full">
          <ResponsiveContainer>
            <LineChart data={visibleLineData} margin={{ top: 8, right: 12, left: 8, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#d4d4d8" />
              <XAxis dataKey="monthLabel" tick={{ fontSize: 12 }} />
              <YAxis tickFormatter={(value) => currencyFormatter.format(Number(value))} width={110} tick={{ fontSize: 12 }} />
              <Tooltip formatter={(value) => formatTooltipValue(value)} />
              <Line type="monotone" dataKey="netWorth" stroke="#0f766e" strokeWidth={2.5} dot={{ r: 3 }} />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>

      <div className="rounded-xl border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-900">
        <h3 className="mb-3 text-sm font-semibold text-zinc-700 dark:text-zinc-200">Asset distribution by account (latest)</h3>
        <div className="h-72 w-full">
          <ResponsiveContainer>
            <BarChart data={distributionData} margin={{ top: 8, right: 12, left: 8, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#d4d4d8" />
              <XAxis dataKey="accountName" tick={{ fontSize: 12 }} interval={0} angle={-20} textAnchor="end" height={60} />
              <YAxis tickFormatter={(value) => currencyFormatter.format(Number(value))} width={110} tick={{ fontSize: 12 }} />
              <Tooltip formatter={(value) => formatTooltipValue(value)} />
              <Bar dataKey="amount" radius={[4, 4, 0, 0]}>
                {distributionData.map((entry, index) => (
                  <Cell key={`${entry.accountName}-${index}`} fill={BAR_COLORS[index % BAR_COLORS.length]} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>
    </div>
  )
}
