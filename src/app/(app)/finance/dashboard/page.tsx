import { NetWorthChart } from '@/components/charts/NetWorthChart'
import { SavingsRateChart } from '@/components/charts/SavingsRateChart'
import { FinanceAnalyticsCharts } from '@/components/charts/FinanceAnalyticsCharts'
import { DashboardMonthSelect } from '@/components/dashboard/DashboardMonthSelect'
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
	maximumFractionDigits: 0,
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

function formatDeltaCurrency(value: number | null): string {
	if (value === null) return 'N/A'
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

export default async function FinanceDashboardPage({ searchParams }: PageProps) {
	const resolvedSearchParams = searchParams ? await searchParams : undefined

	const [snapshots, activeAccounts, liabilitiesAggregate] = await Promise.all([
		prisma.snapshot.findMany({
			select: {
				month: true,
				balance: true,
				accountId: true,
				account: {
					select: {
						name: true,
						type: true,
						currency: true,
						sortOrder: true,
					},
				},
			},
			orderBy: {
				month: 'asc',
			},
		}),
		prisma.account.findMany({
			select: { id: true, currency: true, trackingStartMonth: true, closedAt: true },
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

	const [incomeEntries, investmentContributions, settings] = await Promise.all([
		prisma.incomeEntry.findMany({
			orderBy: { month: 'asc' },
			select: {
				month: true,
				amount: true,
			},
		}),
		prisma.investmentContribution.findMany({
			orderBy: { month: 'asc' },
			select: {
				month: true,
				amount: true,
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

	const eurAccounts = activeAccounts.filter((account) => account.currency === 'EUR')
	const unsupportedCurrencyAccounts = activeAccounts.filter((account) => account.currency !== 'EUR' && account.closedAt === null)
	const monthlySeries = calculateMonthlyNetWorth(
		snapshots.filter((snapshot) => snapshot.account.currency === 'EUR').map((snapshot) => ({
			month: snapshot.month,
			accountId: snapshot.accountId,
			accountName: snapshot.account.name,
			accountType: snapshot.account.type,
			accountSortOrder: snapshot.account.sortOrder,
			balance: snapshot.balance?.toNumber() ?? null,
		})),
		eurAccounts.map((account) => ({
			accountId: account.id,
			trackingStartMonth: account.trackingStartMonth,
			closedAt: account.closedAt,
		})),
	)

	const monthlySavings = calculateMonthlySavingsSeries(
		incomeEntries.map((item) => ({ month: item.month, amount: item.amount.toNumber() })),
		investmentContributions.map((item) => ({ month: item.month, amount: item.amount.toNumber() })),
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
	const isCurrentMonth = selectedPoint.monthKey === toMonthKey(new Date())
	const visibleMonthlySeries = monthlySeries.slice(0, selectedIndex + 1)
	const visibleMonthlySavings = monthlySavings.filter((point) => point.monthKey <= selectedPoint.monthKey)
	const selectedSavings = monthlySavings.find((point) => point.monthKey === selectedPoint.monthKey)
	const previousPoint = selectedIndex > 0 ? monthlySeries[selectedIndex - 1] : null
	const canCompare = selectedPoint.isComplete && previousPoint?.isComplete === true
	const monthlyDelta = canCompare ? calculateMonthlyDelta(selectedPoint.netWorth, previousPoint.netWorth) : null
	const monthlyDeltaPct = canCompare ? calculateMonthlyDeltaPct(selectedPoint.netWorth, previousPoint.netWorth) : null
	const netWorthAfterLiabilities = isCurrentMonth ? selectedPoint.netWorth - activeLiabilitiesTotal : null
	const totalIncomeForMonth = selectedSavings?.totalIncome ?? 0
	const totalInvestedForMonth = selectedSavings?.totalInvested ?? 0
	const savingsRateForMonth = calculateSavingsRate(totalInvestedForMonth, totalIncomeForMonth)

	const ytdYear = selectedPoint.monthDate.getUTCFullYear()
	const ytdSavingsRate = calculateSavingsRateYTD(
		visibleMonthlySavings.filter((point) => point.monthDate.getUTCFullYear() === ytdYear),
	)

	const settingsData = (settings?.data ?? {}) as SettingsData
	const savingsGoalPct = settingsData.savings_goal_pct ?? 20
	const goalProgress = savingsRateForMonth === null ? 0 : savingsGoalPct <= 0 ? 100 : Math.min((savingsRateForMonth / savingsGoalPct) * 100, 100)

	const lineData = visibleMonthlySeries.filter((point) => point.isComplete).map((point) => ({
		monthLabel: shortMonthFormatter.format(point.monthDate),
		netWorth: point.netWorth,
	}))

	const savingsTrendData = visibleMonthlySavings.slice(-12).map((point) => ({
		monthLabel: shortMonthFormatter.format(point.monthDate),
		savingsRate: point.savingsRate ?? 0,
	}))

	const cashFlowData = visibleMonthlySavings.slice(-12).map((point) => ({
		monthLabel: shortMonthFormatter.format(point.monthDate),
		income: point.totalIncome,
		invested: point.totalInvested,
	}))

	const changeData = visibleMonthlySeries.slice(-12).flatMap((point) => {
		const absoluteIndex = monthlySeries.findIndex((seriesPoint) => seriesPoint.monthKey === point.monthKey)
		const previous = absoluteIndex > 0 ? monthlySeries[absoluteIndex - 1] : null
		if (!point.isComplete || !previous?.isComplete) return []
		return [{
			monthLabel: shortMonthFormatter.format(point.monthDate),
			change: point.netWorth - previous.netWorth,
		}]
	})

	const quarterlyCashFlowData = Array.from(
		visibleMonthlySavings.reduce((quarters, point) => {
			const year = point.monthDate.getUTCFullYear()
			const quarter = Math.floor(point.monthDate.getUTCMonth() / 3) + 1
			const key = `${year}-Q${quarter}`
			const current = quarters.get(key) ?? { monthLabel: `Q${quarter} ${year}`, income: 0, invested: 0 }
			current.income += point.totalIncome
			current.invested += point.totalInvested
			quarters.set(key, current)
			return quarters
		}, new Map<string, { monthLabel: string; income: number; invested: number }>())
		.values(),
	).slice(-4)

	const quarterlyChangeData = Array.from(
		visibleMonthlySeries.filter((point) => point.isComplete).reduce((quarters, point) => {
			const year = point.monthDate.getUTCFullYear()
			const quarter = Math.floor(point.monthDate.getUTCMonth() / 3) + 1
			const key = `${year}-Q${quarter}`
			const current = quarters.get(key) ?? {
				monthLabel: `Q${quarter} ${year}`,
				lastNetWorth: point.netWorth,
			}
			current.lastNetWorth = point.netWorth
			quarters.set(key, current)
			return quarters
		}, new Map<string, { monthLabel: string; lastNetWorth: number }>())
		.values(),
	)
		.map((quarter, index, quarters) => ({
			monthLabel: quarter.monthLabel,
			change: index > 0 ? quarter.lastNetWorth - quarters[index - 1].lastNetWorth : 0,
		}))
		.slice(-4)

	const distributionData = selectedPoint.accountTotals
		.map((account) => ({
			accountName: account.accountName,
			amount: account.amount,
		}))
		.sort((left, right) => right.amount - left.amount)

	const recentRows = visibleMonthlySeries
		.slice(-3)
		.map((point) => {
			const pointIndex = monthlySeries.findIndex((seriesPoint) => seriesPoint.monthKey === point.monthKey)
			const prev = pointIndex > 0 ? monthlySeries[pointIndex - 1] : null
			const rowCanCompare = point.isComplete && prev?.isComplete === true
			const delta = rowCanCompare ? calculateMonthlyDelta(point.netWorth, prev.netWorth) : null
			const deltaPct = rowCanCompare ? calculateMonthlyDeltaPct(point.netWorth, prev.netWorth) : null

			return {
				monthDate: point.monthDate,
				netWorth: point.netWorth,
				cashTotal: point.cashTotal,
				delta,
				deltaPct,
			}
		})
		.reverse()

	// We need the current time to warn about upcoming due dates.
	// eslint-disable-next-line react-hooks/purity
	const nowUtc = Date.now()
	const dueSoonLiabilities = (isCurrentMonth ? activeLiabilities : [])
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
		<section className="space-y-6 overflow-x-hidden">
			<div className="flex flex-col gap-3">
				<div className="flex flex-wrap items-end justify-between gap-2">
					<h2 className="text-2xl font-semibold tracking-tight">Dashboard</h2>
				</div>

				<div className="rounded-xl border border-zinc-200 bg-white p-3 dark:border-zinc-800 dark:bg-zinc-900">
					<DashboardMonthSelect selectedMonthKey={selectedPoint.monthKey} />
				</div>
			</div>

			<div className="grid grid-cols-2 gap-3 sm:grid-cols-2 xl:grid-cols-5">
				<article className="min-w-0 rounded-xl border border-zinc-200 bg-white p-3 dark:border-zinc-800 dark:bg-zinc-900 sm:p-4">
					<p className="text-[11px] uppercase tracking-wide text-zinc-500 dark:text-zinc-400">Net worth</p>
					<p className="mt-2 text-lg font-semibold leading-none sm:text-2xl">{currencyFormatter.format(selectedPoint.netWorth)}</p>
				</article>

				<article className="min-w-0 rounded-xl border border-zinc-200 bg-white p-3 dark:border-zinc-800 dark:bg-zinc-900 sm:p-4">
					<p className="text-[11px] uppercase tracking-wide text-zinc-500 dark:text-zinc-400">Liquid assets</p>
					<p className="mt-2 text-lg font-semibold leading-none sm:text-2xl">{currencyFormatter.format(selectedPoint.cashTotal)}</p>
				</article>

				<article className="min-w-0 rounded-xl border border-zinc-200 bg-white p-3 dark:border-zinc-800 dark:bg-zinc-900 sm:p-4">
					<p className="text-[11px] uppercase tracking-wide text-zinc-500 dark:text-zinc-400">Monthly change</p>
					<p className={`mt-2 text-lg font-semibold leading-none sm:text-2xl ${monthlyDelta !== null && monthlyDelta > 0 ? 'text-emerald-600 dark:text-emerald-400' : monthlyDelta !== null && monthlyDelta < 0 ? 'text-rose-600 dark:text-rose-400' : ''}`}>
						{formatDeltaCurrency(monthlyDelta)}
					</p>
				</article>

				<article className="min-w-0 rounded-xl border border-zinc-200 bg-white p-3 dark:border-zinc-800 dark:bg-zinc-900 sm:p-4">
					<p className="text-[11px] uppercase tracking-wide text-zinc-500 dark:text-zinc-400">Monthly change %</p>
					<p className={`mt-2 text-lg font-semibold leading-none sm:text-2xl ${monthlyDeltaPct !== null && monthlyDeltaPct > 0 ? 'text-emerald-600 dark:text-emerald-400' : monthlyDeltaPct !== null && monthlyDeltaPct < 0 ? 'text-rose-600 dark:text-rose-400' : ''}`}>
						{formatDeltaPct(monthlyDeltaPct)}
					</p>
				</article>

				<article className="col-span-2 min-w-0 rounded-xl border border-zinc-200 bg-white p-3 dark:border-zinc-800 dark:bg-zinc-900 sm:col-span-1 sm:p-4">
					<p className="text-[11px] uppercase tracking-wide text-zinc-500 dark:text-zinc-400">Net worth after liabilities</p>
					<p className="mt-2 text-lg font-semibold leading-none sm:text-2xl">{netWorthAfterLiabilities === null ? 'N/A' : currencyFormatter.format(netWorthAfterLiabilities)}</p>
					{!isCurrentMonth ? <p className="mt-1 text-[10px] text-zinc-500">Záväzky nemajú historické snapshoty</p> : null}
				</article>
			</div>

			{!selectedPoint.isComplete ? (
				<div className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900 dark:border-amber-900/60 dark:bg-amber-950/30 dark:text-amber-200">
					Tento mesiac nie je kompletný: vyplnených je {selectedPoint.filledAccountCount} z {selectedPoint.expectedAccountCount} sledovaných účtov. Net worth je iba čiastkový a mesačná zmena sa nepočíta.
				</div>
			) : null}

			{unsupportedCurrencyAccounts.length > 0 ? (
				<div className="rounded-xl border border-sky-200 bg-sky-50 p-4 text-sm text-sky-900 dark:border-sky-900/60 dark:bg-sky-950/30 dark:text-sky-200">
					{unsupportedCurrencyAccounts.length} účet/účty v cudzej mene nie sú zahrnuté do EUR net worth, kým nebude doplnený kurzový prepočet.
				</div>
			) : null}

			{dueSoonLiabilities.length > 0 ? (
				<div className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-amber-900 dark:border-amber-900/60 dark:bg-amber-950/30 dark:text-amber-200">
					<div className="flex items-start gap-2">
						<span className="mt-0.5">⚠️</span>
						<div>
							<p className="font-semibold">Liabilities with upcoming due dates</p>
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

			<NetWorthChart lineData={lineData} distributionData={distributionData} distributionLabel={monthFormatter.format(selectedPoint.monthDate)} />

			<FinanceAnalyticsCharts
				cashFlowData={cashFlowData}
				changeData={changeData}
				quarterlyCashFlowData={quarterlyCashFlowData}
				quarterlyChangeData={quarterlyChangeData}
			/>

			<div className="grid gap-4 lg:grid-cols-2">
				<article className="rounded-xl border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-900">
					<h3 className="mb-2 text-sm font-semibold text-zinc-700 dark:text-zinc-200">💸 Savings rate</h3>
					<p className="text-sm text-zinc-600 dark:text-zinc-300">
						You invested{' '}
						<span className="font-semibold text-zinc-900 dark:text-zinc-100">{currencyFormatter.format(totalInvestedForMonth)}</span>{' '}
						out of{' '}
						<span className="font-semibold text-zinc-900 dark:text-zinc-100">{currencyFormatter.format(totalIncomeForMonth)}</span>{' '}
						income ={' '}
						<span className="font-semibold text-blue-700 dark:text-blue-300">
							{savingsRateForMonth === null ? 'N/A' : `${savingsRateForMonth.toFixed(2)} %`}
						</span>
					</p>

					<div className="mt-3">
						<div className="mb-1 flex items-center justify-between text-xs text-zinc-500 dark:text-zinc-400">
							<span>🎯 Goal: {savingsGoalPct.toFixed(0)} %</span>
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
				<h3 className="text-sm font-semibold text-zinc-700 dark:text-zinc-200">Last 3 snapshot months</h3>

				<div className="mt-3 space-y-2 sm:hidden">
					{recentRows.map((row) => (
						<article
							key={row.monthDate.toISOString()}
							className="rounded-lg border border-zinc-200 p-3 dark:border-zinc-800"
						>
							<p className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">
								{monthFormatter.format(row.monthDate)}
							</p>
							<div className="mt-2 grid grid-cols-2 gap-2 text-xs">
								<p className="text-zinc-500 dark:text-zinc-400">Net worth</p>
								<p className="text-right font-medium text-zinc-800 dark:text-zinc-200">{currencyFormatter.format(row.netWorth)}</p>
								<p className="text-zinc-500 dark:text-zinc-400">Cash</p>
								<p className="text-right font-medium text-zinc-800 dark:text-zinc-200">{currencyFormatter.format(row.cashTotal)}</p>
								<p className="text-zinc-500 dark:text-zinc-400">Delta</p>
								<p className={`text-right font-medium ${row.delta !== null && row.delta > 0 ? 'text-emerald-600 dark:text-emerald-400' : row.delta !== null && row.delta < 0 ? 'text-rose-600 dark:text-rose-400' : 'text-zinc-800 dark:text-zinc-200'}`}>
									{formatDeltaCurrency(row.delta)}
								</p>
								<p className="text-zinc-500 dark:text-zinc-400">Delta %</p>
								<p className={`text-right font-medium ${row.deltaPct !== null && row.deltaPct > 0 ? 'text-emerald-600 dark:text-emerald-400' : row.deltaPct !== null && row.deltaPct < 0 ? 'text-rose-600 dark:text-rose-400' : 'text-zinc-800 dark:text-zinc-200'}`}>
									{formatDeltaPct(row.deltaPct)}
								</p>
							</div>
						</article>
					))}
				</div>

				<div className="mt-3 hidden overflow-x-auto sm:block">
					<table className="min-w-full text-sm">
						<thead>
							<tr className="border-b border-zinc-200 text-left text-zinc-500 dark:border-zinc-800 dark:text-zinc-400">
								<th className="py-2 pr-3 font-medium">Month</th>
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
									<td className={`py-2 pr-3 ${row.delta !== null && row.delta > 0 ? 'text-emerald-600 dark:text-emerald-400' : row.delta !== null && row.delta < 0 ? 'text-rose-600 dark:text-rose-400' : ''}`}>
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
