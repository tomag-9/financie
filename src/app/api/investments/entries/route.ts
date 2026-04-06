import { Prisma } from '@prisma/client'
import { NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

type EntryMode = 'RECURRING' | 'ONE_OFF'

function currentMonthKeyUtc(): string {
  const now = new Date()
  return `${now.getUTCFullYear()}-${String(now.getUTCMonth() + 1).padStart(2, '0')}`
}

function parseMonthKey(value: string | null): { key: string; date: Date } | null {
  const key = value ?? currentMonthKeyUtc()
  const match = /^(\d{4})-(\d{2})$/.exec(key)
  if (!match) return null

  const year = Number(match[1])
  const month = Number(match[2])
  if (!Number.isInteger(year) || !Number.isInteger(month) || month < 1 || month > 12) return null

  return {
    key,
    date: new Date(Date.UTC(year, month - 1, 1)),
  }
}

function toDecimalOrZero(value: unknown): Prisma.Decimal {
  if (typeof value === 'number' && Number.isFinite(value) && value >= 0) {
    return new Prisma.Decimal(value)
  }

  if (typeof value === 'string') {
    const parsed = Number(value.trim().replace(',', '.'))
    if (Number.isFinite(parsed) && parsed >= 0) {
      return new Prisma.Decimal(parsed)
    }
  }

  return new Prisma.Decimal(0)
}

function normalizeMode(value: unknown): EntryMode {
  return value === 'ONE_OFF' ? 'ONE_OFF' : 'RECURRING'
}

function investmentIdForAccount(accountId: string): string {
  return `account-invest:${accountId}`
}

export async function GET(request: Request) {
  const url = new URL(request.url)
  const month = parseMonthKey(url.searchParams.get('month'))
  if (!month) {
    return NextResponse.json({ error: 'Invalid month.' }, { status: 400 })
  }

  const accounts = await prisma.account.findMany({
    where: { isActive: true },
    orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }],
    select: {
      id: true,
      name: true,
      currency: true,
    },
  })

  const investmentIds = accounts.map((account) => investmentIdForAccount(account.id))
  const entries = await prisma.investmentEntry.findMany({
    where: {
      month: month.date,
      investmentId: { in: investmentIds },
    },
    select: {
      investmentId: true,
      entryType: true,
      amountAdded: true,
    },
  })

  const entryByInvestmentId = new Map(entries.map((entry) => [entry.investmentId, entry]))

  const rows = accounts.map((account) => {
    const investmentId = investmentIdForAccount(account.id)
    const entry = entryByInvestmentId.get(investmentId)
    return {
      accountId: account.id,
      accountName: account.name,
      currency: account.currency,
      mode: (entry?.entryType === 'ONE_OFF' ? 'ONE_OFF' : 'RECURRING') as EntryMode,
      amount: entry?.amountAdded.toNumber() ?? 0,
    }
  })

  const totalInvested = entries.reduce((acc, entry) => acc + entry.amountAdded.toNumber(), 0)

  return NextResponse.json({
    month: month.key,
    rows,
    totalInvested,
  })
}

export async function POST(request: Request) {
  const session = await auth()
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  let body: unknown
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body.' }, { status: 400 })
  }

  const payload = (body ?? {}) as Record<string, unknown>
  const month = parseMonthKey(typeof payload.month === 'string' ? payload.month : null)
  if (!month) {
    return NextResponse.json({ error: 'Invalid month.' }, { status: 400 })
  }

  const rowsRaw = Array.isArray(payload.rows) ? payload.rows : null
  if (!rowsRaw) {
    return NextResponse.json({ error: 'The rows field is required.' }, { status: 400 })
  }

  const normalizedRows = rowsRaw
    .map((row) => (typeof row === 'object' && row !== null ? (row as Record<string, unknown>) : null))
    .filter((row): row is Record<string, unknown> => Boolean(row))
    .map((row) => {
      const accountId = typeof row.accountId === 'string' ? row.accountId.trim() : ''
      return {
        accountId,
        mode: normalizeMode(row.mode),
        amount: toDecimalOrZero(row.amount),
      }
    })
    .filter((row) => row.accountId)

  if (normalizedRows.length === 0) {
    return NextResponse.json({ error: 'No rows were sent to save.' }, { status: 400 })
  }

  let updated: number
  try {
    updated = await prisma.$transaction(async (tx) => {
      const validAccounts = await tx.account.findMany({
        where: {
          id: { in: normalizedRows.map((row) => row.accountId) },
          isActive: true,
        },
        select: { id: true, name: true },
      })
      const accountMap = new Map(validAccounts.map((account) => [account.id, account]))

      for (const row of normalizedRows) {
        const account = accountMap.get(row.accountId)
        if (!account) continue

        const investmentId = investmentIdForAccount(account.id)

        await tx.investment.upsert({
          where: { id: investmentId },
          update: {
            name: account.name,
            ticker: `ACC_${account.id.toUpperCase()}`,
            platform: 'ACCOUNT',
            assetType: 'ACCOUNT',
            isArchived: false,
          },
          create: {
            id: investmentId,
            name: account.name,
            ticker: `ACC_${account.id.toUpperCase()}`,
            isin: null,
            platform: 'ACCOUNT',
            assetType: 'ACCOUNT',
            isArchived: false,
            units: 0,
            avgPrice: null,
          },
        })

        await tx.investmentEntry.upsert({
          where: {
            investmentId_month: {
              investmentId,
              month: month.date,
            },
          },
          create: {
            investmentId,
            month: month.date,
            entryType: row.mode,
            amountAdded: row.amount,
            unitsAdded: 0,
            priceAtTime: null,
          },
          update: {
            entryType: row.mode,
            amountAdded: row.amount,
            unitsAdded: 0,
            priceAtTime: null,
          },
        })
      }

      const monthEntries = await tx.investmentEntry.findMany({
        where: {
          month: month.date,
          investmentId: { startsWith: 'account-invest:' },
        },
        select: {
          amountAdded: true,
        },
      })

      return monthEntries.reduce((acc, row) => acc + row.amountAdded.toNumber(), 0)
    })
  } catch {
    return NextResponse.json({ error: 'Failed to save entries.' }, { status: 500 })
  }

  return NextResponse.json({
    month: month.key,
    totalInvested: updated,
  })
}
