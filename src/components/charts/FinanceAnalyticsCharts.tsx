'use client'

import { useState } from 'react'
import { Bar, BarChart, CartesianGrid, Cell, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'

type CashFlowPoint = {
  monthLabel: string
  income: number
  invested: number
}

type ChangePoint = {
  monthLabel: string
  change: number
}

type FinanceAnalyticsChartsProps = {
  cashFlowData: CashFlowPoint[]
  changeData: ChangePoint[]
  quarterlyCashFlowData: CashFlowPoint[]
  quarterlyChangeData: ChangePoint[]
}

const currencyFormatter = new Intl.NumberFormat('sk-SK', {
  style: 'currency',
  currency: 'EUR',
  maximumFractionDigits: 0,
})

const compactCurrencyFormatter = new Intl.NumberFormat('sk-SK', {
  style: 'currency',
  currency: 'EUR',
  notation: 'compact',
  maximumFractionDigits: 0,
})

function formatCurrency(value: number | string | ReadonlyArray<number | string> | undefined): string {
  return currencyFormatter.format(Number(Array.isArray(value) ? value[0] ?? 0 : value ?? 0))
}

function chartTooltipStyle() {
  return {
    backgroundColor: '#ffffff',
    border: '1px solid #d4d4d8',
    borderRadius: '12px',
    color: '#18181b',
  }
}

export function FinanceAnalyticsCharts({
  cashFlowData,
  changeData,
  quarterlyCashFlowData,
  quarterlyChangeData,
}: FinanceAnalyticsChartsProps) {
  const [period, setPeriod] = useState<'month' | 'quarter'>('month')
  const visibleCashFlowData = period === 'month' ? cashFlowData : quarterlyCashFlowData
  const visibleChangeData = period === 'month' ? changeData : quarterlyChangeData

  return (
    <section className="space-y-4" aria-labelledby="analytics-heading">
      <div>
        <p className="text-xs font-medium uppercase tracking-[0.16em] text-teal-700 dark:text-teal-400">Analýza</p>
        <h3 id="analytics-heading" className="mt-1 text-lg font-semibold tracking-tight">
          Finančné trendy
        </h3>
        <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">Porovnanie peňazí, ktoré prichádzajú, investujú sa a zostávajú v majetku.</p>
        <div className="mt-3 inline-flex rounded-lg border border-zinc-200 bg-zinc-100 p-1 dark:border-zinc-800 dark:bg-zinc-900">
          {([
            ['month', 'Mesiace'],
            ['quarter', 'Kvartály'],
          ] as const).map(([value, label]) => (
            <button
              key={value}
              type="button"
              onClick={() => setPeriod(value)}
              className={`rounded-md px-3 py-1.5 text-xs font-medium transition ${
                period === value
                  ? 'bg-white text-zinc-900 shadow-sm dark:bg-zinc-700 dark:text-white'
                  : 'text-zinc-500 dark:text-zinc-400'
              }`}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      <article className="min-w-0 rounded-2xl border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-900">
        <div className="mb-3 flex flex-wrap items-start justify-between gap-2">
          <div>
            <h4 className="text-sm font-semibold text-zinc-800 dark:text-zinc-100">Príjem vs. investície</h4>
            <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">
              {period === 'month' ? 'Mesačný objem za posledných 12 mesiacov' : 'Súhrn za posledné 4 kvartály'}
            </p>
          </div>
          <div className="flex shrink-0 gap-3 text-[11px] text-zinc-500 dark:text-zinc-400">
            <p><span className="mr-1 inline-block size-2 rounded-full bg-sky-600" />príjem</p>
            <p><span className="mr-1 inline-block size-2 rounded-full bg-teal-600" />investície</p>
          </div>
        </div>
        <div className="h-48 w-full min-w-0 overflow-hidden sm:h-56">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={visibleCashFlowData} margin={{ top: 8, right: 4, left: 0, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#d4d4d8" />
              <XAxis dataKey="monthLabel" interval={period === 'month' ? 2 : 0} tick={{ fontSize: 10, fill: '#71717a' }} axisLine={false} tickLine={false} />
              <YAxis tickFormatter={(value) => compactCurrencyFormatter.format(Number(value))} width={62} tick={{ fontSize: 10, fill: '#71717a' }} axisLine={false} tickLine={false} />
              <Tooltip formatter={(value) => formatCurrency(value)} contentStyle={chartTooltipStyle()} labelStyle={{ color: '#52525b' }} />
              <Bar dataKey="income" name="Príjem" fill="#0369a1" radius={[3, 3, 0, 0]} />
              <Bar dataKey="invested" name="Investície" fill="#0f766e" radius={[3, 3, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </article>

      <article className="min-w-0 rounded-2xl border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-900">
        <div className="mb-3">
          <h4 className="text-sm font-semibold text-zinc-800 dark:text-zinc-100">
            {period === 'month' ? 'Mesačná zmena majetku' : 'Kvartálna zmena majetku'}
          </h4>
          <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">
            {period === 'month' ? 'Rast a pokles oproti predchádzajúcemu snapshotu' : 'Zmena oproti predchádzajúcemu kvartálu'}
          </p>
        </div>
        <div className="h-48 w-full min-w-0 overflow-hidden sm:h-56">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={visibleChangeData} margin={{ top: 8, right: 4, left: 0, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#d4d4d8" />
              <XAxis dataKey="monthLabel" interval={period === 'month' ? 2 : 0} tick={{ fontSize: 10, fill: '#71717a' }} axisLine={false} tickLine={false} />
              <YAxis tickFormatter={(value) => compactCurrencyFormatter.format(Number(value))} width={62} tick={{ fontSize: 10, fill: '#71717a' }} axisLine={false} tickLine={false} />
              <Tooltip formatter={(value) => formatCurrency(value)} contentStyle={chartTooltipStyle()} labelStyle={{ color: '#52525b' }} />
              <Bar dataKey="change" name="Zmena" radius={[3, 3, 0, 0]}>
                {visibleChangeData.map((entry) => (
                  <Cell key={entry.monthLabel} fill={entry.change >= 0 ? '#059669' : '#e11d48'} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      </article>
    </section>
  )
}
