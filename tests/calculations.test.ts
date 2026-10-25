import assert from 'node:assert/strict'
import test from 'node:test'
import {
  calculateMonthlyNetWorth,
  calculateSavingsRate,
  calculateSavingsRateYTD,
  parseYearMonth,
} from '../src/lib/calculations'

test('parseYearMonth accepts only real YYYY-MM keys', () => {
  assert.equal(parseYearMonth('2026-04')?.toISOString(), '2026-04-01T00:00:00.000Z')
  assert.equal(parseYearMonth('2026-13'), null)
  assert.equal(parseYearMonth('April'), null)
})

test('net worth marks a month incomplete instead of treating missing accounts as valid zeroes', () => {
  const [point] = calculateMonthlyNetWorth([
    {
      month: new Date('2026-04-01T00:00:00.000Z'),
      accountId: 'bank',
      accountName: 'Bank',
      accountType: 'BANK',
      accountSortOrder: 0,
      balance: 100,
    },
  ], [
    { accountId: 'bank', trackingStartMonth: null, closedAt: null },
    { accountId: 'broker', trackingStartMonth: null, closedAt: null },
  ])

  assert.equal(point.netWorth, 100)
  assert.equal(point.cashTotal, 100)
  assert.equal(point.isComplete, false)
  assert.equal(point.missingAccountCount, 1)
})

test('liquid assets include bank and cash accounts', () => {
  const month = new Date('2026-04-01T00:00:00.000Z')
  const [point] = calculateMonthlyNetWorth([
    { month, accountId: 'bank', accountName: 'Bank', accountType: 'BANK', accountSortOrder: 0, balance: 100 },
    { month, accountId: 'cash', accountName: 'Cash', accountType: 'CASH', accountSortOrder: 1, balance: 20 },
    { month, accountId: 'pension', accountName: 'Pension', accountType: 'PENSION', accountSortOrder: 2, balance: 300 },
  ], ['bank', 'cash', 'pension'].map((accountId) => ({ accountId, trackingStartMonth: null, closedAt: null })))

  assert.equal(point.netWorth, 420)
  assert.equal(point.cashTotal, 120)
  assert.equal(point.isComplete, true)
})

test('snapshot completeness respects account tracking periods', () => {
  const january = new Date('2026-01-01T00:00:00.000Z')
  const [point] = calculateMonthlyNetWorth([
    { month: january, accountId: 'old', accountName: 'Old', accountType: 'BANK', accountSortOrder: 0, balance: 100 },
  ], [
    { accountId: 'old', trackingStartMonth: january, closedAt: new Date('2026-02-01T00:00:00.000Z') },
    { accountId: 'new', trackingStartMonth: new Date('2026-03-01T00:00:00.000Z'), closedAt: null },
  ])

  assert.equal(point.expectedAccountCount, 1)
  assert.equal(point.isComplete, true)
})

test('savings rate preserves meaningful values above 100 percent', () => {
  assert.equal(calculateSavingsRate(150, 100), 150)
  assert.equal(calculateSavingsRate(10, 0), null)
  assert.equal(calculateSavingsRateYTD([
    { monthKey: '2026-01', monthDate: new Date('2026-01-01'), totalIncome: 100, totalInvested: 50, savingsRate: 50 },
    { monthKey: '2026-02', monthDate: new Date('2026-02-01'), totalIncome: 100, totalInvested: 150, savingsRate: 150 },
  ]), 100)
})
