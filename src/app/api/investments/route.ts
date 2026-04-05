import { Prisma } from '@prisma/client'
import { NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { getTickerQuote } from '@/lib/market'
import { prisma } from '@/lib/prisma'

type PlatformBucket = {
  platform: string
  items: Array<{
    id: string
    ticker: string
    isin: string | null
    name: string
    platform: string
    units: number
    avgPrice: number | null
    positionValue: number | null
    marketPrice: number | null
    isStalePrice: boolean
    archived: boolean
  }>
}

function normalizeText(value: unknown): string | null {
  if (typeof value !== 'string') return null
  const normalized = value.trim()
  return normalized ? normalized : null
}

function normalizeTicker(value: unknown): string | null {
  const normalized = normalizeText(value)
  return normalized ? normalized.toUpperCase() : null
}

function normalizeDecimal(value: unknown): Prisma.Decimal | null {
  if (value === null || value === undefined || value === '') return null

  if (typeof value === 'number') {
    if (!Number.isFinite(value) || value < 0) return null
    return new Prisma.Decimal(value)
  }

  if (typeof value === 'string') {
    const parsed = Number(value.trim().replace(',', '.'))
    if (!Number.isFinite(parsed) || parsed < 0) return null
    return new Prisma.Decimal(parsed)
  }

  return null
}

function parseArchivedPlatform(platform: string): { platform: string; archived: boolean } {
  if (platform.startsWith('ARCHIVED:')) {
    return {
      platform: platform.slice('ARCHIVED:'.length) || 'Neznáma',
      archived: true,
    }
  }

  return { platform, archived: false }
}

export async function GET() {
  const investments = await prisma.investment.findMany({
    orderBy: [{ platform: 'asc' }, { name: 'asc' }],
    select: {
      id: true,
      ticker: true,
      isin: true,
      name: true,
      platform: true,
      units: true,
      avgPrice: true,
    },
  })

  const tickerSet = [...new Set(investments.map((item) => item.ticker.trim().toUpperCase()).filter(Boolean))]
  const quotes = await Promise.all(tickerSet.map((ticker) => getTickerQuote(ticker)))
  const quoteByTicker = new Map(
    quotes
      .filter((quote): quote is NonNullable<typeof quote> => Boolean(quote))
      .map((quote) => [quote.ticker, quote]),
  )

  const bucketMap = new Map<string, PlatformBucket>()
  for (const investment of investments) {
    const { platform, archived } = parseArchivedPlatform(investment.platform)
    const ticker = investment.ticker.trim().toUpperCase()
    const quote = quoteByTicker.get(ticker)
    const units = investment.units.toNumber()

    const item = {
      id: investment.id,
      ticker,
      isin: investment.isin,
      name: investment.name,
      platform,
      units,
      avgPrice: investment.avgPrice ? investment.avgPrice.toNumber() : null,
      positionValue: quote ? units * quote.price : null,
      marketPrice: quote?.price ?? null,
      isStalePrice: quote?.isStale ?? true,
      archived,
    }

    const bucket = bucketMap.get(platform) ?? {
      platform,
      items: [],
    }
    bucket.items.push(item)
    bucketMap.set(platform, bucket)
  }

  const groups = [...bucketMap.values()].map((bucket) => ({
    ...bucket,
    items: bucket.items.sort((left, right) => left.name.localeCompare(right.name, 'sk-SK')),
  }))

  groups.sort((left, right) => left.platform.localeCompare(right.platform, 'sk-SK'))

  return NextResponse.json({
    groups,
    investmentsCount: investments.length,
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

  const ticker = normalizeTicker(payload.ticker)
  const name = normalizeText(payload.name)
  const platform = normalizeText(payload.platform)
  const isin = normalizeText(payload.isin)
  const units = normalizeDecimal(payload.units)
  const avgPrice = normalizeDecimal(payload.avgPrice)

  if (!ticker || !name || !platform || units === null) {
    return NextResponse.json({ error: 'Ticker, názov, platforma a kusy sú povinné.' }, { status: 400 })
  }

  const investment = await prisma.investment.create({
    data: {
      ticker,
      isin,
      name,
      platform,
      units,
      avgPrice,
    },
    select: {
      id: true,
      ticker: true,
      isin: true,
      name: true,
      platform: true,
      units: true,
      avgPrice: true,
    },
  })

  return NextResponse.json(
    {
      investment: {
        ...investment,
        units: investment.units.toNumber(),
        avgPrice: investment.avgPrice ? investment.avgPrice.toNumber() : null,
      },
    },
    { status: 201 },
  )
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
  const id = normalizeText(payload.id)

  if (!id) {
    return NextResponse.json({ error: 'ID investície je povinné.' }, { status: 400 })
  }

  if (action === 'edit') {
    const ticker = normalizeTicker(payload.ticker)
    const name = normalizeText(payload.name)
    const platform = normalizeText(payload.platform)
    const isin = normalizeText(payload.isin)
    const units = normalizeDecimal(payload.units)
    const avgPrice = normalizeDecimal(payload.avgPrice)

    if (!ticker || !name || !platform || units === null) {
      return NextResponse.json({ error: 'Neplatné údaje pre úpravu investície.' }, { status: 400 })
    }

    try {
      const investment = await prisma.investment.update({
        where: { id },
        data: {
          ticker,
          name,
          platform,
          isin,
          units,
          avgPrice,
        },
        select: {
          id: true,
          ticker: true,
          isin: true,
          name: true,
          platform: true,
          units: true,
          avgPrice: true,
        },
      })

      return NextResponse.json({
        investment: {
          ...investment,
          units: investment.units.toNumber(),
          avgPrice: investment.avgPrice ? investment.avgPrice.toNumber() : null,
        },
      })
    } catch {
      return NextResponse.json({ error: 'Investícia neexistuje.' }, { status: 404 })
    }
  }

  if (action === 'archive') {
    try {
      const existing = await prisma.investment.findUnique({
        where: { id },
        select: { platform: true },
      })

      if (!existing) {
        return NextResponse.json({ error: 'Investícia neexistuje.' }, { status: 404 })
      }

      const current = parseArchivedPlatform(existing.platform)
      if (current.archived) {
        return NextResponse.json({ ok: true })
      }

      await prisma.investment.update({
        where: { id },
        data: {
          platform: `ARCHIVED:${existing.platform}`,
        },
      })

      return NextResponse.json({ ok: true })
    } catch {
      return NextResponse.json({ error: 'Nepodarilo sa archivovať investíciu.' }, { status: 500 })
    }
  }

  if (action === 'unarchive') {
    try {
      const existing = await prisma.investment.findUnique({
        where: { id },
        select: { platform: true },
      })

      if (!existing) {
        return NextResponse.json({ error: 'Investícia neexistuje.' }, { status: 404 })
      }

      const parsed = parseArchivedPlatform(existing.platform)
      if (!parsed.archived) {
        return NextResponse.json({ ok: true })
      }

      await prisma.investment.update({
        where: { id },
        data: {
          platform: parsed.platform,
        },
      })

      return NextResponse.json({ ok: true })
    } catch {
      return NextResponse.json({ error: 'Nepodarilo sa odarchivovať investíciu.' }, { status: 500 })
    }
  }

  return NextResponse.json({ error: 'Nepodporovaná akcia.' }, { status: 400 })
}
