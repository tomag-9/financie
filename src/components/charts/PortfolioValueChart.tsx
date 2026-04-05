'use client'

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

const currencyFormatter = new Intl.NumberFormat('sk-SK', {
  style: 'currency',
  currency: 'EUR',
  maximumFractionDigits: 2,
})

export function PortfolioValueChart({ data, hasBenchmark }: PortfolioValueChartProps) {
  return (
    <div className="h-72 w-full">
      <ResponsiveContainer>
        <LineChart data={data} margin={{ top: 8, right: 12, left: 8, bottom: 0 }}>
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
  )
}
