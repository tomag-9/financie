import { NetWorthChart } from '@/components/charts/NetWorthChart'
import { SavingsRateChart } from '@/components/charts/SavingsRateChart'
import {
  calculateMonthlySavingsSeries,
  calculateMonthlyDelta,
  calculateMonthlyDeltaPct,
  calculateMonthlyNetWorth,
  calculateSavingsRate,
  calculateSavingsRateYTD,
  parseYearMonth,
  toMonthKey,
} from '@/lib/calculations'
import { prisma } from '@/lib/prisma'
import type { SettingsData } from '@/types'

const currencyFormatter = new Intl.NumberFormat('sk-SK', {
  style: 'currency',
  currency: 'EUR',
  maximumFractionDigits: 2,
})

const monthFormatter = new Intl.DateTimeFormat('sk-SK', {
  month: 'long',
  year: 'numeric',
  timeZone: 'UTC',
})

const shortMonthFormatter = new Intl.DateTimeFormat('sk-SK', {
  month: 'short',
  year: '2-digit',
  timeZone: 'UTC',
})

type PageProps = {
  searchParams?: Promise<{
    month?: string
  }>
}

function formatDeltaCurrency(value: number): string {
  const sign = value > 0 ? '+' : ''
  return `${sign}${currencyFormatter.format(value)}`
}

function formatDeltaPct(value: number | null): string {
  if (value === null) {
    return 'N/A'
  }

  const sign = value > 0 ? '+' : ''
  return `${sign}${value.toFixed(2)} %`
}

export default async function DashboardPage({ searchParams }: PageProps) {
  const resolvedSearchParams = searchParams ? await searchParams : undefined

  const [snapshots, liabilitiesAggregate] = await Promise.all([
    prisma.snapshot.findMany({
      where: {
        account: {
          isActive: true,
        },
      },
      select: {
        month: true,
        balance: true,
        accountId: true,
        account: {
          select: {
            name: true,
            type: true,
            sortOrder: true,
          },
        },
      },
      orderBy: {
        month: 'asc',
      },
    }),
    prisma.liability.aggregate({
      where: {
        isActive: true,
      },
      _sum: {
        remaining: true,
      },
    }),
  ])

  const [incomeEntries, investmentEntries, settings] = await Promise.all([
    prisma.incomeEntry.findMany({
      orderBy: { month: 'asc' },
      select: {
        month: true,
        amount: true,
      },
    }),
    prisma.investmentEntry.findMany({
      orderBy: { month: 'asc' },
      select: {
        month: true,
        amountAdded: true,
      },
    }),
    prisma.settings.findUnique({
      where: { id: 'singleton' },
      select: { data: true },
    }),
  ])

  const activeLiabilities = await prisma.liability.findMany({
    where: { isActive: true },
    select: {
      name: true,
      remaining: true,
      dueDate: true,
    },
    orderBy: [{ dueDate: 'asc' }, { createdAt: 'asc' }],
  })

  const monthlySeries = calculateMonthlyNetWorth(
    snapshots.map((snapshot) => ({
      month: snapshot.month,
      accountId: snapshot.accountId,
      accountName: snapshot.account.name,
      accountType: snapshot.account.type,
      accountSortOrder: snapshot.account.sortOrder,
      balance: snapshot.balance?.toNumber() ?? null,
    }))
  )

  const monthlySavings = calculateMonthlySavingsSeries(
    incomeEntries.map((item) => ({ month: item.month, amount: item.amount.toNumber() })),
    investmentEntries.map((item) => ({ month: item.month, amount: item.amountAdded.toNumber() })),
  )

  const activeLiabilitiesTotal = liabilitiesAggregate._sum.remaining?.toNumber() ?? 0
  const selectedMonthDate = parseYearMonth(resolvedSearchParams?.month)
  const selectedMonthKey = selectedMonthDate ? toMonthKey(selectedMonthDate) : null
  const selectedIndexFromParam = selectedMonthKey
    ? monthlySeries.findIndex((point) => point.monthKey === selectedMonthKey)
    : -1
  const selectedIndex = selectedIndexFromParam >= 0 ? selectedIndexFromParam : monthlySeries.length - 1

  if (selectedIndex < 0) {
    return (
      <section className="space-y-4">
        <h2 className="text-2xl font-semibold tracking-tight">Dashboard</h2>
        <p className="rounded-lg border border-zinc-200 bg-white p-4 text-sm text-zinc-600 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-300">
          Zatiaľ nemáš žiadne snapshoty. Pridaj prvé mesačné stavy účtov.
        </p>
      </section>
    )
  }

  const selectedPoint = monthlySeries[selectedIndex]
  const selectedSavings = monthlySavings.find((point) => point.monthKey === selectedPoint.monthKey)
  const previousPoint = selectedIndex > 0 ? monthlySeries[selectedIndex - 1] : null
  const monthlyDelta = calculateMonthlyDelta(selectedPoint.netWorth, previousPoint?.netWorth ?? 0)
  const monthlyDeltaPct = calculateMonthlyDeltaPct(selectedPoint.netWorth, previousPoint?.netWorth ?? 0)
  const netWorthAfterLiabilities = selectedPoint.netWorth - activeLiabilitiesTotal
  const totalIncomeForMonth = selectedSavings?.totalIncome ?? 0
  const totalInvestedForMonth = selectedSavings?.totalInvested ?? 0
  const savingsRateForMonth = calculateSavingsRate(totalInvestedForMonth, totalIncomeForMonth)

  const ytdYear = selectedPoint.monthDate.getUTCFullYear()
  const ytdSavingsRate = calculateSavingsRateYTD(
    monthlySavings.filter((point) => point.monthDate.getUTCFullYear() === ytdYear),
  )

  const settingsData = (settings?.data ?? {}) as SettingsData
  const savingsGoalPct = settingsData.savings_goal_pct ?? 20
  const goalProgress = savingsRateForMonth === null ? 0 : Math.min((savingsRateForMonth / savingsGoalPct) * 100, 100)

  const lineData = monthlySeries.map((point) => ({
    monthLabel: shortMonthFormatter.format(point.monthDate),
    netWorth: point.netWorth,
  }))

  const savingsTrendData = monthlySavings.slice(-12).map((point) => ({
    monthLabel: shortMonthFormatter.format(point.monthDate),
    savingsRate: point.savingsRate ?? 0,
  }))

  const latestPoint = monthlySeries[monthlySeries.length - 1]
  const distributionData = latestPoint.accountTotals
    .map((account) => ({
      accountName: account.accountName,
      amount: account.amount,
    }))
    .sort((left, right) => right.amount - left.amount)

  const recentRows = monthlySeries
    .slice(-3)
    .map((point) => {
      const pointIndex = monthlySeries.findIndex((seriesPoint) => seriesPoint.monthKey === point.monthKey)
      const prev = pointIndex > 0 ? monthlySeries[pointIndex - 1] : null
      const delta = calculateMonthlyDelta(point.netWorth, prev?.netWorth ?? 0)
      const deltaPct = calculateMonthlyDeltaPct(point.netWorth, prev?.netWorth ?? 0)

      return {
        monthDate: point.monthDate,
        netWorth: point.netWorth,
        cashTotal: point.cashTotal,
        delta,
        deltaPct,
      }
    })
    .reverse()

  // Potrebujeme aktuálny čas na varovanie pred blížiacimi sa splatnosťami.
  // eslint-disable-next-line react-hooks/purity
  const nowUtc = Date.now()
  const dueSoonLiabilities = activeLiabilities
    .map((liability) => {
      const dueDateMs = liability.dueDate ? liability.dueDate.getTime() : null
      if (dueDateMs === null) return null
      const daysUntilDue = Math.ceil((dueDateMs - nowUtc) / (24 * 60 * 60 * 1000))
      if (daysUntilDue < 0 || daysUntilDue >= 30) return null
      return {
        name: liability.name,
        daysUntilDue,
        remaining: liability.remaining.toNumber(),
      }
    })
    .filter((item): item is { name: string; daysUntilDue: number; remaining: number } => Boolean(item))

  return (
    <section className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-2">
        <div>
          <h2 className="text-2xl font-semibold tracking-tight">Dashboard</h2>
          <p className="text-sm text-zinc-600 dark:text-zinc-300">
            Mesiac: <span className="font-medium text-zinc-900 dark:text-zinc-100">{monthFormatter.format(selectedPoint.monthDate)}</span>
          </p>
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
        <article className="rounded-xl border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-900">
          <p className="text-xs uppercase tracking-wide text-zinc-500 dark:text-zinc-400">Net worth</p>
          <p className="mt-2 text-2xl font-semibold">{currencyFormatter.format(selectedPoint.netWorth)}</p>
        </article>

        <article className="rounded-xl border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-900">
          <p className="text-xs uppercase tracking-wide text-zinc-500 dark:text-zinc-400">Cash total</p>
          <p className="mt-2 text-2xl font-semibold">{currencyFormatter.format(selectedPoint.cashTotal)}</p>
        </article>

        <article className="rounded-xl border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-900">
          <p className="text-xs uppercase tracking-wide text-zinc-500 dark:text-zinc-400">Mesačná zmena</p>
          <p className={`mt-2 text-2xl font-semibold ${monthlyDelta > 0 ? 'text-emerald-600 dark:text-emerald-400' : monthlyDelta < 0 ? 'text-rose-600 dark:text-rose-400' : ''}`}>
            {formatDeltaCurrency(monthlyDelta)}
          </p>
        </article>

        <article className="rounded-xl border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-900">
          <p className="text-xs uppercase tracking-wide text-zinc-500 dark:text-zinc-400">Mesačná zmena %</p>
          <p className={`mt-2 text-2xl font-semibold ${monthlyDeltaPct !== null && monthlyDeltaPct > 0 ? 'text-emerald-600 dark:text-emerald-400' : monthlyDeltaPct !== null && monthlyDeltaPct < 0 ? 'text-rose-600 dark:text-rose-400' : ''}`}>
            {formatDeltaPct(monthlyDeltaPct)}
          </p>
        </article>

        <article className="rounded-xl border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-900">
          <p className="text-xs uppercase tracking-wide text-zinc-500 dark:text-zinc-400">Net worth po záväzkoch</p>
          <p className="mt-2 text-2xl font-semibold">{currencyFormatter.format(netWorthAfterLiabilities)}</p>
        </article>
      </div>

      {dueSoonLiabilities.length > 0 ? (
        <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-amber-900 dark:border-amber-900/60 dark:bg-amber-950/30 dark:text-amber-200">
          <div className="flex items-start gap-2">
            <span className="mt-0.5">⚠️</span>
            <div>
              <p className="font-semibold">Záväzky s blížiacim sa termínom</p>
              <p className="text-sm">
                {dueSoonLiabilities
                  .slice(0, 3)
                  .map((item) => {
                    const label = item.daysUntilDue === 0 ? 'dnes' : item.daysUntilDue === 1 ? 'zajtra' : `o ${item.daysUntilDue} dní`
                    return `${item.name} (${label})`
                  })
                  .join(', ')}
              </p>
            </div>
          </div>
        </div>
      ) : null}

      <NetWorthChart lineData={lineData} distributionData={distributionData} />

      <div className="grid gap-4 lg:grid-cols-2">
        <article className="rounded-xl border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-900">
          <h3 className="mb-2 text-sm font-semibold text-zinc-700 dark:text-zinc-200">💸 Savings rate</h3>
          <p className="text-sm text-zinc-600 dark:text-zinc-300">
            Investoval si{' '}
            <span className="font-semibold text-zinc-900 dark:text-zinc-100">{currencyFormatter.format(totalInvestedForMonth)}</span>{' '}
            z{' '}
            <span className="font-semibold text-zinc-900 dark:text-zinc-100">{currencyFormatter.format(totalIncomeForMonth)}</span>{' '}
            príjmu ={' '}
            <span className="font-semibold text-blue-700 dark:text-blue-300">
              {savingsRateForMonth === null ? 'N/A' : `${savingsRateForMonth.toFixed(2)} %`}
            </span>
          </p>

          <div className="mt-3">
            <div className="mb-1 flex items-center justify-between text-xs text-zinc-500 dark:text-zinc-400">
              <span>🎯 Cieľ: {savingsGoalPct.toFixed(0)} %</span>
              <span>YTD: {ytdSavingsRate === null ? 'N/A' : `${ytdSavingsRate.toFixed(2)} %`}</span>
            </div>
            <div className="h-2 w-full overflow-hidden rounded-full bg-zinc-200 dark:bg-zinc-700">
              <div className="h-full bg-blue-600 transition-all" style={{ width: `${goalProgress}%` }} />
            </div>
          </div>
        </article>

        <article className="rounded-xl border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-900">
          <h3 className="mb-2 text-sm font-semibold text-zinc-700 dark:text-zinc-200">📈 Savings trend</h3>
          <SavingsRateChart data={savingsTrendData} />
        </article>
      </div>

      <div className="rounded-xl border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-900">
        <h3 className="text-sm font-semibold text-zinc-700 dark:text-zinc-200">Posledné 3 mesiace snapshotov</h3>

        <div className="mt-3 overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead>
              <tr className="border-b border-zinc-200 text-left text-zinc-500 dark:border-zinc-800 dark:text-zinc-400">
                <th className="py-2 pr-3 font-medium">Mesiac</th>
                <th className="py-2 pr-3 font-medium">Net worth</th>
                <th className="py-2 pr-3 font-medium">Cash</th>
                <th className="py-2 pr-3 font-medium">Delta</th>
                <th className="py-2 font-medium">Delta %</th>
              </tr>
            </thead>
            <tbody>
              {recentRows.map((row) => (
                <tr key={row.monthDate.toISOString()} className="border-b border-zinc-100 last:border-0 dark:border-zinc-800/70">
                  <td className="py-2 pr-3">{monthFormatter.format(row.monthDate)}</td>
                  <td className="py-2 pr-3">{currencyFormatter.format(row.netWorth)}</td>
                  <td className="py-2 pr-3">{currencyFormatter.format(row.cashTotal)}</td>
                  <td className={`py-2 pr-3 ${row.delta > 0 ? 'text-emerald-600 dark:text-emerald-400' : row.delta < 0 ? 'text-rose-600 dark:text-rose-400' : ''}`}>
                    {formatDeltaCurrency(row.delta)}
                  </td>
                  <td className={`py-2 ${row.deltaPct !== null && row.deltaPct > 0 ? 'text-emerald-600 dark:text-emerald-400' : row.deltaPct !== null && row.deltaPct < 0 ? 'text-rose-600 dark:text-rose-400' : ''}`}>
                    {formatDeltaPct(row.deltaPct)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </section>
  )
}
