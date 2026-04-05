import { NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { refreshTickerQuotes } from '@/lib/market'
import { prisma } from '@/lib/prisma'

export async function POST(request: Request) {
  const session = await auth()
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  let body: unknown = null
  try {
    body = await request.json()
  } catch {
    body = null
  }

  const payload = (body ?? {}) as Record<string, unknown>
  const forceRefresh = payload.force === true

  const investments = await prisma.investment.findMany({
    where: {
      platform: {
        not: {
          startsWith: 'ARCHIVED:',
        },
      },
    },
    select: {
      ticker: true,
    },
  })

  const tickers = investments.map((investment) => investment.ticker)
  const quotes = await refreshTickerQuotes(tickers, { forceRefresh })

  return NextResponse.json({
    refreshedAt: new Date().toISOString(),
    forceRefresh,
    quotes,
  })
}
