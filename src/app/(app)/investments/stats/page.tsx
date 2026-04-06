import { PortfolioValueChart } from '@/components/charts/PortfolioValueChart'
import {
  buildMonthlyPortfolioSeries,
  calculatePortfolioUnrealizedGain,
  calculatePortfolioValue,
  calculateTWRR,
} from '@/lib/calculations'
import { getTickerQuote } from '@/lib/market'
import { prisma } from '@/lib/prisma'

const currencyFormatter = new Intl.NumberFormat('sk-SK', {
  style: 'currency',
  currency: 'EUR',
  maximumFractionDigits: 2,
})

const monthFormatter = new Intl.DateTimeFormat('sk-SK', {
  month: 'short',
  year: '2-digit',
  timeZone: 'UTC',
})

function formatPercent(value: number | null): string {
  if (value === null || !Number.isFinite(value)) return 'N/A'
  return `${value.toFixed(2)} %`
}

export default async function InvestmentsStatsPage() {
  const [investments, entries] = await Promise.all([
    prisma.investment.findMany({
      where: {
        isArchived: false,
      },
      orderBy: [{ platform: 'asc' }, { ticker: 'asc' }],
      select: {
        id: true,
        ticker: true,
        name: true,
        platform: true,
        units: true,
        avgPrice: true,
      },
    }),
    prisma.investmentEntry.findMany({
      orderBy: { month: 'asc' },
      select: {
        month: true,
        investmentId: true,
        unitsAdded: true,
        amountAdded: true,
        priceAtTime: true,
        investment: {
          select: {
            ticker: true,
          },
        },
      },
    }),
  ])

  if (investments.length === 0) {
    return (
      <section className="space-y-4">
        <h2 className="text-2xl font-semibold tracking-tight">Portfolio stats</h2>
        <p className="rounded-xl border border-zinc-200 bg-white p-4 text-sm text-zinc-600 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-300">
          You do not have any investment positions. Add positions in Investments first.
        </p>
      </section>
    )
  }

  const tickerSet = [...new Set(investments.map((item) => item.ticker.trim().toUpperCase()).filter(Boolean))]
  const quotes = await Promise.all(tickerSet.map((ticker) => getTickerQuote(ticker)))
  const quoteByTicker = new Map(
    quotes
      .filter((quote): quote is NonNullable<typeof quote> => Boolean(quote))
      .map((quote) => [quote.ticker, quote]),
  )

  const positions = investments.map((investment) => {
    const ticker = investment.ticker.trim().toUpperCase()
    const quote = quoteByTicker.get(ticker)
    return {
      id: investment.id,
      ticker,
      name: investment.name,
      platform: investment.platform,
      units: investment.units.toNumber(),
      avgPrice: investment.avgPrice?.toNumber() ?? null,
      marketPrice: quote?.price ?? null,
      stalePrice: quote?.isStale ?? true,
    }
  })

  const totalPortfolioValue = calculatePortfolioValue(
    positions.map((position) => ({
      units: position.units,
      currentPrice: position.marketPrice,
    })),
  )

  const totalCostBasis = positions.reduce((acc, position) => {
    if (position.avgPrice === null) return acc
    return acc + position.units * position.avgPrice
  }, 0)

  const unrealized = calculatePortfolioUnrealizedGain(totalPortfolioValue, totalCostBasis)

  const monthSeries = buildMonthlyPortfolioSeries(
    entries.map((entry) => ({
      month: entry.month,
      investmentId: entry.investmentId,
      ticker: entry.investment.ticker.trim().toUpperCase(),
      unitsAdded: entry.unitsAdded.toNumber(),
      amountAdded: entry.amountAdded.toNumber(),
    })),
    quoteByTicker,
  )

  const twrr = calculateTWRR(monthSeries)

  const benchmarkTicker = tickerSet.includes('VWCE') ? 'VWCE' : tickerSet.includes('SPY') ? 'SPY' : null
  const benchmarkQuote = benchmarkTicker ? await getTickerQuote(benchmarkTicker) : null

  const benchmarkStartEntry = benchmarkTicker
    ? entries
        .filter((entry) => entry.investment.ticker.trim().toUpperCase() === benchmarkTicker)
        .find((entry) => entry.priceAtTime !== null)
    : null

  const benchmarkReturn =
    benchmarkQuote && benchmarkStartEntry?.priceAtTime
      ? ((benchmarkQuote.price - benchmarkStartEntry.priceAtTime.toNumber()) /
          benchmarkStartEntry.priceAtTime.toNumber()) *
        100
      : null

  const hasBenchmarkSeries = benchmarkReturn !== null && monthSeries.length > 0
  const initialPortfolio = monthSeries[0]?.portfolioValue ?? 0

  const chartData = monthSeries.map((row, index) => {
    const base: {
      monthLabel: string
      portfolioValue: number
      benchmarkValue?: number | null
    } = {
      monthLabel: monthFormatter.format(row.month),
      portfolioValue: row.portfolioValue,
    }

    if (hasBenchmarkSeries && benchmarkReturn !== null) {
      const ratio = index / Math.max(monthSeries.length - 1, 1)
      const scaledReturn = benchmarkReturn / 100
      base.benchmarkValue = initialPortfolio * (1 + scaledReturn * ratio)
    }

    return base
  })

  const latestMonth = monthSeries[monthSeries.length - 1]?.month

  return (
    <section className="space-y-6">
      <header className="space-y-1">
        <h2 className="text-2xl font-semibold tracking-tight">Portfolio stats</h2>
        <p className="text-sm text-zinc-600 dark:text-zinc-300">
          {latestMonth ? `Latest month: ${monthFormatter.format(latestMonth)}` : 'No monthly investment records yet.'}
        </p>
      </header>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <article className="rounded-xl border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-900">
          <p className="text-xs uppercase tracking-wide text-zinc-500 dark:text-zinc-400">Portfolio value</p>
          <p className="mt-2 text-2xl font-semibold">{currencyFormatter.format(totalPortfolioValue)}</p>
        </article>

        <article className="rounded-xl border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-900">
          <p className="text-xs uppercase tracking-wide text-zinc-500 dark:text-zinc-400">Total invested</p>
          <p className="mt-2 text-2xl font-semibold">{currencyFormatter.format(totalCostBasis)}</p>
        </article>

        <article className="rounded-xl border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-900">
          <p className="text-xs uppercase tracking-wide text-zinc-500 dark:text-zinc-400">Unrealized gain/loss</p>
          <p className={`mt-2 text-2xl font-semibold ${unrealized.gain > 0 ? 'text-emerald-600 dark:text-emerald-400' : unrealized.gain < 0 ? 'text-rose-600 dark:text-rose-400' : ''}`}>
            {currencyFormatter.format(unrealized.gain)}
          </p>
          <p className="text-xs text-zinc-500 dark:text-zinc-400">{formatPercent(unrealized.gainPct)}</p>
        </article>

        <article className="rounded-xl border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-900">
          <p className="text-xs uppercase tracking-wide text-zinc-500 dark:text-zinc-400">TWRR</p>
          <p className="mt-2 text-2xl font-semibold">{formatPercent(twrr === null ? null : twrr * 100)}</p>
          <p className="text-xs text-zinc-500 dark:text-zinc-400">Time-weighted return</p>
        </article>
      </div>

      <div className="rounded-xl border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-900">
        <h3 className="mb-3 text-sm font-semibold text-zinc-700 dark:text-zinc-200">Portfolio value over time</h3>
        {chartData.length > 0 ? (
          <PortfolioValueChart data={chartData} hasBenchmark={hasBenchmarkSeries} />
        ) : (
          <p className="text-sm text-zinc-600 dark:text-zinc-300">You need at least one monthly investment record for the chart.</p>
        )}
      </div>

      <div className="rounded-xl border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-900">
        <h3 className="mb-3 text-sm font-semibold text-zinc-700 dark:text-zinc-200">Benchmark</h3>
        {benchmarkTicker && benchmarkQuote ? (
          <p className="text-sm text-zinc-700 dark:text-zinc-200">
            {benchmarkTicker}: {currencyFormatter.format(benchmarkQuote.price)}
            {' · '}
            Since first buy: {formatPercent(benchmarkReturn)}
            {benchmarkQuote.isStale ? ' · stale price' : ''}
          </p>
        ) : (
          <p className="text-sm text-zinc-600 dark:text-zinc-300">
            Benchmark comparison will appear when the portfolio includes VWCE or SPY.
          </p>
        )}
      </div>

      <div className="rounded-xl border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-900">
        <h3 className="mb-3 text-sm font-semibold text-zinc-700 dark:text-zinc-200">Positions</h3>
        <div className="overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead>
              <tr className="border-b border-zinc-200 text-left text-zinc-500 dark:border-zinc-800 dark:text-zinc-400">
                <th className="py-2 pr-3 font-medium">Ticker</th>
                <th className="py-2 pr-3 font-medium">Platforma</th>
                <th className="py-2 pr-3 font-medium">Kusy</th>
                <th className="py-2 pr-3 font-medium">Avg cena</th>
                <th className="py-2 pr-3 font-medium">Current price</th>
                <th className="py-2 font-medium">Hodnota</th>
              </tr>
            </thead>
            <tbody>
              {positions.map((position) => (
                <tr key={position.id} className="border-b border-zinc-100 last:border-0 dark:border-zinc-800/70">
                  <td className="py-2 pr-3">{position.ticker}</td>
                  <td className="py-2 pr-3">{position.platform}</td>
                  <td className="py-2 pr-3">{position.units.toFixed(4)}</td>
                  <td className="py-2 pr-3">{position.avgPrice !== null ? currencyFormatter.format(position.avgPrice) : 'N/A'}</td>
                  <td className="py-2 pr-3">
                    {position.marketPrice !== null ? currencyFormatter.format(position.marketPrice) : 'N/A'}
                    {position.stalePrice ? ' · stale price' : ''}
                  </td>
                  <td className="py-2">
                    {position.marketPrice !== null
                      ? currencyFormatter.format(position.marketPrice * position.units)
                      : 'N/A'}
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
