'use client'

import { CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'

type SavingsPoint = {
  monthLabel: string
  savingsRate: number
}

type SavingsRateChartProps = {
  data: SavingsPoint[]
}

export function SavingsRateChart({ data }: SavingsRateChartProps) {
  return (
    <div className="h-52 w-full">
      <ResponsiveContainer>
        <LineChart data={data}>
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
