export type SnapshotForCalculation = {
  month: Date
  accountId: string
  accountName: string
  accountType: string
  accountSortOrder: number
  balance: number | null
}

export type MonthlyAccountTotal = {
  accountId: string
  accountName: string
  accountSortOrder: number
  amount: number
}

export type MonthlyNetWorthPoint = {
  monthKey: string
  monthDate: Date
  netWorth: number
  cashTotal: number
  accountTotals: MonthlyAccountTotal[]
}

export type MoneyEntryForCalculation = {
  month: Date
  amount: number | null
}

export type MonthlySavingsPoint = {
  monthKey: string
  monthDate: Date
  totalIncome: number
  totalInvested: number
  savingsRate: number | null
}

export type PortfolioPositionForCalculation = {
  units: number
  currentPrice: number | null
}

export type PortfolioUnrealizedResult = {
  gain: number
  gainPct: number | null
}

export type MonthlyPortfolioFlow = {
  month: Date
  investmentId: string
  ticker: string
  unitsAdded: number
  amountAdded: number
}

export type MarketQuoteForCalculation = {
  price: number
}

export type MonthlyPortfolioEntry = {
  month: Date
  portfolioValue: number
  cashFlow: number
}

export function toMonthKey(date: Date): string {
  const year = date.getUTCFullYear()
  const month = String(date.getUTCMonth() + 1).padStart(2, '0')
  return `${year}-${month}`
}

export function parseYearMonth(value: string | undefined): Date | null {
  if (!value) return null
  const match = /^(\d{4})-(\d{2})$/.exec(value)
  if (!match) return null

  const year = Number(match[1])
  const month = Number(match[2])
  if (!Number.isInteger(year) || !Number.isInteger(month) || month < 1 || month > 12) {
    return null
  }

  return new Date(Date.UTC(year, month - 1, 1))
}

export function calculateMonthlyNetWorth(points: SnapshotForCalculation[]): MonthlyNetWorthPoint[] {
  const byMonth = new Map<
    string,
    {
      monthDate: Date
      netWorth: number
      cashTotal: number
      byAccount: Map<string, MonthlyAccountTotal>
    }
  >()

  for (const point of points) {
    const monthKey = toMonthKey(point.month)
    const amount = point.balance ?? 0

    const monthBucket =
      byMonth.get(monthKey) ??
      {
        monthDate: new Date(Date.UTC(point.month.getUTCFullYear(), point.month.getUTCMonth(), 1)),
        netWorth: 0,
        cashTotal: 0,
        byAccount: new Map<string, MonthlyAccountTotal>(),
      }

    monthBucket.netWorth += amount
    if (point.accountType === 'CASH') {
      monthBucket.cashTotal += amount
    }

    const accountBucket =
      monthBucket.byAccount.get(point.accountId) ??
      {
        accountId: point.accountId,
        accountName: point.accountName,
        accountSortOrder: point.accountSortOrder,
        amount: 0,
      }

    accountBucket.amount += amount
    monthBucket.byAccount.set(point.accountId, accountBucket)
    byMonth.set(monthKey, monthBucket)
  }

  return [...byMonth.entries()]
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([monthKey, value]) => ({
      monthKey,
      monthDate: value.monthDate,
      netWorth: value.netWorth,
      cashTotal: value.cashTotal,
      accountTotals: [...value.byAccount.values()].sort((left, right) => {
        if (left.accountSortOrder !== right.accountSortOrder) {
          return left.accountSortOrder - right.accountSortOrder
        }
        return left.accountName.localeCompare(right.accountName, 'sk-SK')
      }),
    }))
}

export function calculateMonthlyDelta(currentNetWorth: number, previousNetWorth: number): number {
  return currentNetWorth - previousNetWorth
}

export function calculateMonthlyDeltaPct(currentNetWorth: number, previousNetWorth: number): number | null {
  if (previousNetWorth === 0) {
    return null
  }

  return (calculateMonthlyDelta(currentNetWorth, previousNetWorth) / previousNetWorth) * 100
}

export function calculateSavingsRate(totalInvested: number, totalIncome: number): number | null {
  if (totalIncome === 0) {
    return null
  }

  return (totalInvested / totalIncome) * 100
}

export function calculateSavingsRateYTD(points: MonthlySavingsPoint[]): number | null {
  const totalIncome = points.reduce((acc, point) => acc + point.totalIncome, 0)
  const totalInvested = points.reduce((acc, point) => acc + point.totalInvested, 0)
  return calculateSavingsRate(totalInvested, totalIncome)
}

export function calculateMonthlySavingsSeries(
  incomeEntries: MoneyEntryForCalculation[],
  investmentEntries: MoneyEntryForCalculation[],
): MonthlySavingsPoint[] {
  const byMonth = new Map<
    string,
    {
      monthDate: Date
      totalIncome: number
      totalInvested: number
    }
  >()

  for (const entry of incomeEntries) {
    const monthKey = toMonthKey(entry.month)
    const bucket =
      byMonth.get(monthKey) ?? {
        monthDate: new Date(Date.UTC(entry.month.getUTCFullYear(), entry.month.getUTCMonth(), 1)),
        totalIncome: 0,
        totalInvested: 0,
      }

    bucket.totalIncome += entry.amount ?? 0
    byMonth.set(monthKey, bucket)
  }

  for (const entry of investmentEntries) {
    const monthKey = toMonthKey(entry.month)
    const bucket =
      byMonth.get(monthKey) ?? {
        monthDate: new Date(Date.UTC(entry.month.getUTCFullYear(), entry.month.getUTCMonth(), 1)),
        totalIncome: 0,
        totalInvested: 0,
      }

    bucket.totalInvested += entry.amount ?? 0
    byMonth.set(monthKey, bucket)
  }

  return [...byMonth.entries()]
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([monthKey, value]) => ({
      monthKey,
      monthDate: value.monthDate,
      totalIncome: value.totalIncome,
      totalInvested: value.totalInvested,
      savingsRate: calculateSavingsRate(value.totalInvested, value.totalIncome),
    }))
}

export function calculatePortfolioValue(positions: PortfolioPositionForCalculation[]): number {
  return positions.reduce((acc, position) => {
    if (position.currentPrice === null) {
      return acc
    }
    return acc + position.units * position.currentPrice
  }, 0)
}

export function calculatePortfolioUnrealizedGain(
  totalPortfolioValue: number,
  totalCostBasis: number,
): PortfolioUnrealizedResult {
  const gain = totalPortfolioValue - totalCostBasis
  if (totalCostBasis === 0) {
    return { gain, gainPct: null }
  }

  return {
    gain,
    gainPct: (gain / totalCostBasis) * 100,
  }
}

export function buildMonthlyPortfolioSeries(
  flows: MonthlyPortfolioFlow[],
  quoteByTicker: Map<string, MarketQuoteForCalculation>,
): MonthlyPortfolioEntry[] {
  const byMonth = new Map<string, MonthlyPortfolioFlow[]>()

  for (const flow of flows) {
    const key = toMonthKey(flow.month)
    const bucket = byMonth.get(key) ?? []
    bucket.push(flow)
    byMonth.set(key, bucket)
  }

  const months = [...byMonth.keys()].sort((left, right) => left.localeCompare(right))
  const cumulativeUnits = new Map<string, number>()
  const tickerByInvestment = new Map<string, string>()
  const result: MonthlyPortfolioEntry[] = []

  for (const monthKey of months) {
    const monthFlows = byMonth.get(monthKey) ?? []
    let cashFlow = 0

    for (const flow of monthFlows) {
      tickerByInvestment.set(flow.investmentId, flow.ticker)
      const currentUnits = cumulativeUnits.get(flow.investmentId) ?? 0
      cumulativeUnits.set(flow.investmentId, currentUnits + flow.unitsAdded)
      cashFlow += flow.amountAdded
    }

    let portfolioValue = 0
    for (const [investmentId, units] of cumulativeUnits.entries()) {
      const ticker = tickerByInvestment.get(investmentId)
      if (!ticker) continue

      const quote = quoteByTicker.get(ticker)
      if (!quote) continue

      portfolioValue += units * quote.price
    }

    const monthDate = monthFlows[0]?.month ?? parseYearMonth(monthKey) ?? new Date()
    result.push({
      month: new Date(Date.UTC(monthDate.getUTCFullYear(), monthDate.getUTCMonth(), 1)),
      portfolioValue,
      cashFlow,
    })
  }

  return result
}

export function calculateTWRR(entries: MonthlyPortfolioEntry[]): number | null {
  if (entries.length < 2) {
    return null
  }

  let twrr = 1

  for (let index = 1; index < entries.length; index += 1) {
    const prev = entries[index - 1]
    const curr = entries[index]
    const beginValue = prev.portfolioValue + curr.cashFlow
    if (beginValue === 0) continue

    const subReturn = curr.portfolioValue / beginValue
    twrr *= subReturn
  }

  return twrr - 1
}
