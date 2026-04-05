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

function toMonthKey(date: Date): string {
  return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, '0')}`
}

function normalizeName(value: unknown): string | null {
  if (typeof value !== 'string') return null
  const normalized = value.trim()
  return normalized ? normalized : null
}

function normalizeColor(value: unknown): string {
  if (typeof value !== 'string') return '#378ADD'
  const normalized = value.trim()
  if (!normalized) return '#378ADD'
  return normalized.slice(0, 16)
}

function normalizeId(value: unknown): string | null {
  if (typeof value !== 'string') return null
  const normalized = value.trim()
  return normalized ? normalized : null
}

function normalizeAmount(value: unknown): Prisma.Decimal | null {
  if (value === null || value === undefined) return null

  if (typeof value === 'number') {
    if (!Number.isFinite(value) || value < 0) return null
    return new Prisma.Decimal(value)
  }

  if (typeof value === 'string') {
    const normalized = value.trim().replace(',', '.')
    if (!normalized) return null
    const asNumber = Number(normalized)
    if (!Number.isFinite(asNumber) || asNumber < 0) return null
    return new Prisma.Decimal(asNumber)
  }

  return null
}

export async function GET(request: Request) {
  const url = new URL(request.url)
  const month = parseMonthKey(url.searchParams.get('month'))
  if (!month) {
    return NextResponse.json({ error: 'Neplatný mesiac.' }, { status: 400 })
  }

  const monthsBack = Math.max(1, Math.min(24, Number(url.searchParams.get('months') ?? '12')))
  const from = new Date(Date.UTC(month.date.getUTCFullYear(), month.date.getUTCMonth() - (monthsBack - 1), 1))

  const [sources, monthEntries, historyEntries] = await Promise.all([
    prisma.incomeSource.findMany({
      orderBy: [{ isActive: 'desc' }, { name: 'asc' }],
      select: {
        id: true,
        name: true,
        color: true,
        isActive: true,
      },
    }),
    prisma.incomeEntry.findMany({
      where: { month: month.date },
      select: {
        id: true,
        sourceId: true,
        amount: true,
        note: true,
      },
    }),
    prisma.incomeEntry.findMany({
      where: {
        month: {
          gte: from,
          lte: month.date,
        },
      },
      select: {
        month: true,
        amount: true,
        source: {
          select: {
            id: true,
            name: true,
            color: true,
          },
        },
      },
      orderBy: { month: 'asc' },
    }),
  ])

  const history = historyEntries.map((entry) => ({
    month: toMonthKey(entry.month),
    amount: entry.amount.toNumber(),
    sourceId: entry.source.id,
    sourceName: entry.source.name,
    color: entry.source.color,
  }))

  return NextResponse.json({
    month: month.key,
    sources,
    entries: monthEntries.map((entry) => ({
      id: entry.id,
      sourceId: entry.sourceId,
      amount: entry.amount.toNumber(),
      note: entry.note,
    })),
    history,
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
    return NextResponse.json({ error: 'Neplatné JSON telo.' }, { status: 400 })
  }

  const payload = (body ?? {}) as Record<string, unknown>
  const name = normalizeName(payload.name)
  const color = normalizeColor(payload.color)

  if (!name) {
    return NextResponse.json({ error: 'Názov je povinný.' }, { status: 400 })
  }

  const source = await prisma.incomeSource.create({
    data: {
      name,
      color,
      isActive: true,
    },
    select: {
      id: true,
      name: true,
      color: true,
      isActive: true,
    },
  })

  return NextResponse.json({ source }, { status: 201 })
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
    return NextResponse.json({ error: 'Neplatné JSON telo.' }, { status: 400 })
  }

  const payload = (body ?? {}) as Record<string, unknown>
  const action = payload.action

  if (action === 'source-update') {
    const id = normalizeId(payload.id)
    const name = normalizeName(payload.name)
    const color = normalizeColor(payload.color)
    if (!id || !name) {
      return NextResponse.json({ error: 'Neplatné údaje pre úpravu zdroja.' }, { status: 400 })
    }

    const updated = await prisma.incomeSource.update({
      where: { id },
      data: { name, color },
      select: { id: true, name: true, color: true, isActive: true },
    })
    return NextResponse.json({ source: updated })
  }

  if (action === 'source-toggle') {
    const id = normalizeId(payload.id)
    const isActive = payload.isActive === true

    if (!id) {
      return NextResponse.json({ error: 'Neplatné údaje pre zmenu stavu zdroja.' }, { status: 400 })
    }

    const updated = await prisma.incomeSource.update({
      where: { id },
      data: { isActive },
      select: { id: true, name: true, color: true, isActive: true },
    })

    return NextResponse.json({ source: updated })
  }

  if (action === 'entry-upsert') {
    const sourceId = normalizeId(payload.sourceId)
    const month = parseMonthKey(typeof payload.month === 'string' ? payload.month : null)
    const amount = normalizeAmount(payload.amount)
    const note = typeof payload.note === 'string' ? payload.note.trim().slice(0, 300) || null : null

    if (!sourceId || !month || amount === null) {
      return NextResponse.json({ error: 'Neplatné údaje pre income entry.' }, { status: 400 })
    }

    const entry = await prisma.incomeEntry.upsert({
      where: {
        sourceId_month: {
          sourceId,
          month: month.date,
        },
      },
      create: {
        sourceId,
        month: month.date,
        amount,
        note,
      },
      update: {
        amount,
        note,
      },
      select: {
        id: true,
        sourceId: true,
        amount: true,
        note: true,
      },
    })

    return NextResponse.json({
      entry: {
        id: entry.id,
        sourceId: entry.sourceId,
        amount: entry.amount.toNumber(),
        note: entry.note,
      },
    })
  }

  return NextResponse.json({ error: 'Nepodporovaná akcia.' }, { status: 400 })
}
