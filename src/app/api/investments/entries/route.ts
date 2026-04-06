import { Prisma } from '@prisma/client'
import { NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

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

function toDecimalOrNull(value: unknown): Prisma.Decimal | null {
  if (value === '' || value === null || value === undefined) return null

  if (typeof value === 'number' && Number.isFinite(value) && value >= 0) {
    return new Prisma.Decimal(value)
  }

  if (typeof value === 'string') {
    const parsed = Number(value.trim().replace(',', '.'))
    if (Number.isFinite(parsed) && parsed >= 0) {
      return new Prisma.Decimal(parsed)
    }
  }

  return null
}

function normalizeEntryType(value: unknown): string {
  const normalized = typeof value === 'string' ? value.trim().toUpperCase() : ''
  return normalized === 'ONE_OFF' ? 'ONE_OFF' : 'RECURRING'
}

async function recomputeInvestment(id: string, tx: Prisma.TransactionClient): Promise<void> {
  const entries = await tx.investmentEntry.findMany({
    where: { investmentId: id },
    select: {
      unitsAdded: true,
      amountAdded: true,
    },
  })

  let totalUnits = 0
  let totalAmount = 0

  for (const entry of entries) {
    totalUnits += entry.unitsAdded.toNumber()
    totalAmount += entry.amountAdded.toNumber()
  }

  await tx.investment.update({
    where: { id },
    data: {
      units: totalUnits,
      avgPrice: totalUnits > 0 ? totalAmount / totalUnits : null,
    },
  })
}

export async function GET(request: Request) {
  const url = new URL(request.url)
  const month = parseMonthKey(url.searchParams.get('month'))
  if (!month) {
    return NextResponse.json({ error: 'Invalid month.' }, { status: 400 })
  }

  const [investments, entries] = await Promise.all([
    prisma.investment.findMany({
      where: {
        isArchived: false,
      },
      orderBy: [{ platform: 'asc' }, { name: 'asc' }],
      select: {
        id: true,
        ticker: true,
        name: true,
        platform: true,
        assetType: true,
        units: true,
        avgPrice: true,
      },
    }),
    prisma.investmentEntry.findMany({
      where: {
        month: month.date,
      },
      select: {
        id: true,
        investmentId: true,
        entryType: true,
        unitsAdded: true,
        amountAdded: true,
        priceAtTime: true,
      },
    }),
  ])

  const entryByInvestment = new Map(entries.map((entry) => [entry.investmentId, entry]))

  const rows = investments.map((investment) => {
    const entry = entryByInvestment.get(investment.id)
    return {
      investmentId: investment.id,
      ticker: investment.ticker,
      name: investment.name,
      platform: investment.platform,
      assetType: investment.assetType,
      currentUnits: investment.units.toNumber(),
      avgPrice: investment.avgPrice ? investment.avgPrice.toNumber() : null,
      entry: entry
        ? {
            id: entry.id,
        entryType: entry.entryType,
            unitsAdded: entry.unitsAdded.toNumber(),
            amountAdded: entry.amountAdded.toNumber(),
            priceAtTime: entry.priceAtTime ? entry.priceAtTime.toNumber() : null,
          }
        : null,
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
      const investmentId = typeof row.investmentId === 'string' ? row.investmentId.trim() : ''
      return {
        investmentId,
        entryType: normalizeEntryType(row.entryType),
        unitsAdded: toDecimalOrZero(row.unitsAdded),
        amountAdded: toDecimalOrZero(row.amountAdded),
        priceAtTime: toDecimalOrNull(row.priceAtTime),
      }
    })
    .filter((row) => row.investmentId)

  if (normalizedRows.length === 0) {
    return NextResponse.json({ error: 'No rows were sent to save.' }, { status: 400 })
  }

  let updated: number
  try {
    updated = await prisma.$transaction(async (tx) => {
      const touchedInvestmentIds = new Set<string>()

      for (const row of normalizedRows) {
        await tx.investmentEntry.upsert({
          where: {
            investmentId_month: {
              investmentId: row.investmentId,
              month: month.date,
            },
          },
          create: {
            investmentId: row.investmentId,
            month: month.date,
            entryType: row.entryType,
            unitsAdded: row.unitsAdded,
            amountAdded: row.amountAdded,
            priceAtTime: row.priceAtTime,
          },
          update: {
            entryType: row.entryType,
            unitsAdded: row.unitsAdded,
            amountAdded: row.amountAdded,
            priceAtTime: row.priceAtTime,
          },
        })

        touchedInvestmentIds.add(row.investmentId)
      }

      for (const investmentId of touchedInvestmentIds) {
        await recomputeInvestment(investmentId, tx)
      }

      const monthEntries = await tx.investmentEntry.findMany({
        where: { month: month.date },
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
