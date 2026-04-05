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

function numOrDefault(value: unknown, fallback = 0): number {
  if (typeof value === 'number' && Number.isFinite(value)) return value
  if (typeof value === 'string') {
    const parsed = Number(value.trim().replace(',', '.'))
    if (Number.isFinite(parsed)) return parsed
  }
  return fallback
}

function toDecimal(value: number): Prisma.Decimal {
  return new Prisma.Decimal(value)
}

function sum(values: Array<number | null>): number {
  return values.reduce<number>((acc, value) => acc + (value ?? 0), 0)
}

export async function GET(request: Request) {
  const url = new URL(request.url)
  const month = parseMonthKey(url.searchParams.get('month'))
  if (!month) {
    return NextResponse.json({ error: 'Neplatný mesiac.' }, { status: 400 })
  }

  const [detail, all] = await Promise.all([
    prisma.jojDetail.findUnique({
      where: { month: month.date },
      select: {
        month: true,
        streamCount: true,
        ratePerStream: true,
        tvHonorar: true,
        bonus: true,
        expectedTotal: true,
        receivedTotal: true,
        diff: true,
      },
    }),
    prisma.jojDetail.findMany({
      orderBy: { month: 'asc' },
      select: {
        month: true,
        streamCount: true,
        ratePerStream: true,
        expectedTotal: true,
        receivedTotal: true,
      },
    }),
  ])

  const avgStreamsBase = all.filter((item) => item.streamCount > 0)
  const avgStreams =
    avgStreamsBase.length > 0
      ? avgStreamsBase.reduce((acc, item) => acc + item.streamCount, 0) / avgStreamsBase.length
      : 0

  const bestMonth = all.reduce<null | {
    month: string
    expectedTotal: number
  }>((best, item) => {
    const expected = item.expectedTotal.toNumber()
    if (!best || expected > best.expectedTotal) {
      return { month: toMonthKey(item.month), expectedTotal: expected }
    }
    return best
  }, null)

  const eurPerStreamTrend = all
    .filter((item) => item.streamCount > 0)
    .map((item) => ({
      month: toMonthKey(item.month),
      value: item.expectedTotal.toNumber() / item.streamCount,
    }))

  const totals = {
    expectedTotal: sum(all.map((item) => item.expectedTotal.toNumber())),
    receivedTotal: sum(all.map((item) => (item.receivedTotal ? item.receivedTotal.toNumber() : null))),
  }

  return NextResponse.json({
    month: month.key,
    detail: detail
      ? {
          month: toMonthKey(detail.month),
          streamCount: detail.streamCount,
          ratePerStream: detail.ratePerStream.toNumber(),
          tvHonorar: detail.tvHonorar.toNumber(),
          bonus: detail.bonus.toNumber(),
          expectedTotal: detail.expectedTotal.toNumber(),
          receivedTotal: detail.receivedTotal ? detail.receivedTotal.toNumber() : null,
          diff: detail.diff ? detail.diff.toNumber() : null,
        }
      : null,
    stats: {
      avgStreams,
      bestMonth,
      eurPerStreamTrend,
      totals,
    },
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
  const month = parseMonthKey(typeof payload.month === 'string' ? payload.month : null)
  if (!month) {
    return NextResponse.json({ error: 'Neplatný mesiac.' }, { status: 400 })
  }

  const streamCount = Math.max(0, Math.trunc(numOrDefault(payload.streamCount, 0)))
  const ratePerStream = Math.max(0, numOrDefault(payload.ratePerStream, 40))
  const tvHonorar = Math.max(0, numOrDefault(payload.tvHonorar, 0))
  const bonus = Math.max(0, numOrDefault(payload.bonus, 0))

  const receivedRaw = payload.receivedTotal
  let receivedTotal: Prisma.Decimal | null = null
  if (receivedRaw !== '' && receivedRaw !== null && receivedRaw !== undefined) {
    const parsed = numOrDefault(receivedRaw, Number.NaN)
    if (!Number.isFinite(parsed)) {
      return NextResponse.json({ error: 'Neplatná hodnota prijatej sumy.' }, { status: 400 })
    }
    receivedTotal = toDecimal(parsed)
  }

  const expectedTotalNum = streamCount * ratePerStream + tvHonorar + bonus
  const expectedTotal = toDecimal(expectedTotalNum)
  const diff = receivedTotal ? toDecimal(receivedTotal.toNumber() - expectedTotalNum) : null

  const detail = await prisma.jojDetail.upsert({
    where: { month: month.date },
    create: {
      month: month.date,
      streamCount,
      ratePerStream: toDecimal(ratePerStream),
      tvHonorar: toDecimal(tvHonorar),
      bonus: toDecimal(bonus),
      expectedTotal,
      receivedTotal,
      diff,
    },
    update: {
      streamCount,
      ratePerStream: toDecimal(ratePerStream),
      tvHonorar: toDecimal(tvHonorar),
      bonus: toDecimal(bonus),
      expectedTotal,
      receivedTotal,
      diff,
    },
    select: {
      month: true,
      streamCount: true,
      ratePerStream: true,
      tvHonorar: true,
      bonus: true,
      expectedTotal: true,
      receivedTotal: true,
      diff: true,
    },
  })

  return NextResponse.json({
    detail: {
      month: toMonthKey(detail.month),
      streamCount: detail.streamCount,
      ratePerStream: detail.ratePerStream.toNumber(),
      tvHonorar: detail.tvHonorar.toNumber(),
      bonus: detail.bonus.toNumber(),
      expectedTotal: detail.expectedTotal.toNumber(),
      receivedTotal: detail.receivedTotal ? detail.receivedTotal.toNumber() : null,
      diff: detail.diff ? detail.diff.toNumber() : null,
    },
  })
}
