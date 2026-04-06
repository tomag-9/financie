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

function investmentIdForAccount(accountId: string): string {
  return `account-invest:${accountId}`
}

function normalizeMode(value: unknown): EntryMode {
  return value === 'ONE_OFF' ? 'ONE_OFF' : 'RECURRING'
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

type UpsertPayload = {
  month: { key: string; date: Date }
  accountId: string
  mode: EntryMode
  amount: Prisma.Decimal
}

async function upsertEntry(payload: UpsertPayload) {
  return prisma.$transaction(async (tx) => {
    const account = await tx.account.findFirst({
      where: { id: payload.accountId, isActive: true },
      select: { id: true, name: true, currency: true },
    })

    if (!account) {
      throw new Error('ACCOUNT_NOT_FOUND')
    }

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

    const entry = await tx.investmentEntry.upsert({
      where: {
        investmentId_month: {
          investmentId,
          month: payload.month.date,
        },
      },
      create: {
        investmentId,
        month: payload.month.date,
        entryType: payload.mode,
        amountAdded: payload.amount,
        unitsAdded: 0,
        priceAtTime: null,
      },
      update: {
        entryType: payload.mode,
        amountAdded: payload.amount,
        unitsAdded: 0,
        priceAtTime: null,
      },
      select: {
        id: true,
        entryType: true,
        amountAdded: true,
      },
    })

    return {
      id: entry.id,
      accountId: account.id,
      accountName: account.name,
      currency: account.currency,
      month: payload.month.key,
      mode: entry.entryType === 'ONE_OFF' ? 'ONE_OFF' : 'RECURRING',
      amount: entry.amountAdded.toNumber(),
    }
  })
}

export async function GET(request: Request) {
  const url = new URL(request.url)
  const month = parseMonthKey(url.searchParams.get('month'))
  if (!month) {
    return NextResponse.json({ error: 'Invalid month.' }, { status: 400 })
  }

  const [accounts, entries] = await Promise.all([
    prisma.account.findMany({
      where: { isActive: true },
      orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }],
      select: {
        id: true,
        name: true,
        currency: true,
      },
    }),
    prisma.investmentEntry.findMany({
      where: {
        month: month.date,
        investmentId: { startsWith: 'account-invest:' },
        amountAdded: { gt: 0 },
      },
      select: {
        id: true,
        investmentId: true,
        entryType: true,
        amountAdded: true,
      },
    }),
  ])

  const accountById = new Map(accounts.map((account) => [account.id, account]))
  const rows = entries
    .map((entry) => {
      const accountId = entry.investmentId.replace('account-invest:', '')
      const account = accountById.get(accountId)
      if (!account) return null

      return {
        id: entry.id,
        accountId,
        accountName: account.name,
        currency: account.currency,
        mode: entry.entryType === 'ONE_OFF' ? 'ONE_OFF' : 'RECURRING',
        amount: entry.amountAdded.toNumber(),
      }
    })
    .filter((row): row is NonNullable<typeof row> => Boolean(row))

  const totalInvested = rows.reduce((acc, row) => acc + row.amount, 0)

  return NextResponse.json({
    month: month.key,
    accounts,
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

  const accountId = typeof payload.accountId === 'string' ? payload.accountId.trim() : ''
  if (!accountId) {
    return NextResponse.json({ error: 'Account is required.' }, { status: 400 })
  }

  const amount = toDecimalOrZero(payload.amount)
  const mode = normalizeMode(payload.mode)

  try {
    const row = await upsertEntry({
      month,
      accountId,
      mode,
      amount,
    })

    return NextResponse.json({ row }, { status: 201 })
  } catch (error) {
    if (error instanceof Error && error.message === 'ACCOUNT_NOT_FOUND') {
      return NextResponse.json({ error: 'Account not found.' }, { status: 404 })
    }

    return NextResponse.json({ error: 'Failed to save investment entry.' }, { status: 500 })
  }
}

export async function PATCH(request: Request) {
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

  const accountId = typeof payload.accountId === 'string' ? payload.accountId.trim() : ''
  if (!accountId) {
    return NextResponse.json({ error: 'Account is required.' }, { status: 400 })
  }

  const amount = toDecimalOrZero(payload.amount)
  const mode = normalizeMode(payload.mode)

  try {
    const row = await upsertEntry({
      month,
      accountId,
      mode,
      amount,
    })

    return NextResponse.json({ row })
  } catch (error) {
    if (error instanceof Error && error.message === 'ACCOUNT_NOT_FOUND') {
      return NextResponse.json({ error: 'Account not found.' }, { status: 404 })
    }

    return NextResponse.json({ error: 'Failed to update investment entry.' }, { status: 500 })
  }
}
