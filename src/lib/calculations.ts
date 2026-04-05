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
