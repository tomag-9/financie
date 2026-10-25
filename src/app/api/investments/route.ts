import { Prisma } from '@prisma/client'
import { NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

type ContributionMode = 'RECURRING' | 'ONE_OFF'

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
  if (!Number.isInteger(year) || month < 1 || month > 12) return null
  return { key, date: new Date(Date.UTC(year, month - 1, 1)) }
}

function normalizeMode(value: unknown): ContributionMode {
  return value === 'ONE_OFF' ? 'ONE_OFF' : 'RECURRING'
}

function normalizeAmount(value: unknown): Prisma.Decimal | null {
  const parsed = typeof value === 'string' ? Number(value.trim().replace(',', '.')) : Number(value)
  if (!Number.isFinite(parsed) || parsed < 0) return null
  return new Prisma.Decimal(parsed)
}

export async function GET(request: Request) {
  const url = new URL(request.url)
  const month = parseMonthKey(url.searchParams.get('month'))
  if (!month) return NextResponse.json({ error: 'Invalid month.' }, { status: 400 })

  const [accounts, current, previousRecurring] = await Promise.all([
    prisma.account.findMany({
      where: { isActive: true },
      orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }],
      select: { id: true, name: true, currency: true },
    }),
    prisma.investmentContribution.findMany({
      where: { month: month.date },
      select: { id: true, accountId: true, mode: true, amount: true },
    }),
    prisma.investmentContribution.findMany({
      where: { month: { lt: month.date }, mode: 'RECURRING' },
      orderBy: { month: 'desc' },
      select: { accountId: true, amount: true },
    }),
  ])

  const currentByAccount = new Map(current.map((entry) => [entry.accountId, entry]))
  const suggestionByAccount = new Map<string, Prisma.Decimal>()
  for (const entry of previousRecurring) {
    if (!suggestionByAccount.has(entry.accountId)) suggestionByAccount.set(entry.accountId, entry.amount)
  }

  const rows = accounts.flatMap((account) => {
    const entry = currentByAccount.get(account.id)
    const suggestedAmount = suggestionByAccount.get(account.id)
    if (!entry && !suggestedAmount) return []

    return [{
      id: entry?.id ?? `suggested:${account.id}`,
      accountId: account.id,
      accountName: account.name,
      currency: account.currency,
      mode: (entry?.mode === 'ONE_OFF' ? 'ONE_OFF' : 'RECURRING') as ContributionMode,
      amount: (entry?.amount ?? suggestedAmount)?.toNumber() ?? 0,
      isSuggested: !entry,
    }]
  })

  return NextResponse.json({
    month: month.key,
    accounts,
    rows,
    totalInvested: current.reduce((sum, entry) => sum + entry.amount.toNumber(), 0),
  })
}

async function saveContribution(request: Request, createdStatus?: number) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  let payload: Record<string, unknown>
  try {
    payload = (await request.json()) as Record<string, unknown>
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body.' }, { status: 400 })
  }

  const month = parseMonthKey(typeof payload.month === 'string' ? payload.month : null)
  const accountId = typeof payload.accountId === 'string' ? payload.accountId.trim() : ''
  const amount = normalizeAmount(payload.amount)
  if (!month || !accountId || amount === null) {
    return NextResponse.json({ error: 'Month, account and a non-negative amount are required.' }, { status: 400 })
  }

  const account = await prisma.account.findFirst({
    where: { id: accountId, isActive: true },
    select: { id: true, name: true, currency: true },
  })
  if (!account) return NextResponse.json({ error: 'Account not found.' }, { status: 404 })

  const mode = normalizeMode(payload.mode)
  const entry = await prisma.investmentContribution.upsert({
    where: { accountId_month: { accountId, month: month.date } },
    create: { accountId, month: month.date, mode, amount },
    update: { mode, amount },
    select: { id: true, mode: true, amount: true },
  })

  return NextResponse.json({
    row: {
      id: entry.id,
      accountId,
      accountName: account.name,
      currency: account.currency,
      month: month.key,
      mode: entry.mode === 'ONE_OFF' ? 'ONE_OFF' : 'RECURRING',
      amount: entry.amount.toNumber(),
      isSuggested: false,
    },
  }, createdStatus ? { status: createdStatus } : undefined)
}

export async function POST(request: Request) {
  return saveContribution(request, 201)
}

export async function PATCH(request: Request) {
  return saveContribution(request)
}
