import yahooFinance from 'yahoo-finance2'
import { prisma } from '@/lib/prisma'
import type { MarketCache, SettingsData } from '@/types'

export const MARKET_CACHE_TTL_MS = 6 * 60 * 60 * 1000

export type MarketQuoteResult = {
  ticker: string
  price: number
  fetchedAt: string
  isStale: boolean
  source: 'cache' | 'yahoo' | 'cache-fallback'
}

function normalizeTicker(ticker: string): string {
  return ticker.trim().toUpperCase()
}

function toRecord(value: unknown): Record<string, unknown> {
  if (typeof value === 'object' && value !== null && !Array.isArray(value)) {
    return value as Record<string, unknown>
  }
  return {}
}

function parseCache(value: unknown): MarketCache {
  const record = toRecord(value)
  const cache: MarketCache = {}

  for (const [rawTicker, rawEntry] of Object.entries(record)) {
    const entry = toRecord(rawEntry)
    const price = Number(entry.price)
    const fetchedAt = typeof entry.fetchedAt === 'string' ? entry.fetchedAt : ''
    if (!Number.isFinite(price) || !fetchedAt) continue

    cache[normalizeTicker(rawTicker)] = {
      price,
      fetchedAt,
    }
  }

  return cache
}

function isFresh(entry: { fetchedAt: string }): boolean {
  const fetchedAtMs = Date.parse(entry.fetchedAt)
  if (!Number.isFinite(fetchedAtMs)) return false
  return Date.now() - fetchedAtMs < MARKET_CACHE_TTL_MS
}

async function loadSettingsData(): Promise<SettingsData> {
  const settings = await prisma.settings.findUnique({
    where: { id: 'singleton' },
    select: { data: true },
  })

  return toRecord(settings?.data) as SettingsData
}

async function saveMarketCache(cache: MarketCache): Promise<void> {
  const settings = await loadSettingsData()
  const nextData: SettingsData = {
    ...settings,
    market_cache: cache,
  }

  await prisma.settings.upsert({
    where: { id: 'singleton' },
    update: { data: nextData as object },
    create: { id: 'singleton', data: nextData as object },
  })
}

async function fetchPriceFromYahoo(ticker: string): Promise<number | null> {
  try {
    const quote = await yahooFinance.quote(ticker)
    const quoteRecord = quote as unknown as Record<string, unknown>
    const price = Number(quoteRecord.regularMarketPrice)
    if (!Number.isFinite(price) || price <= 0) {
      return null
    }
    return price
  } catch {
    return null
  }
}

export async function getMarketCache(): Promise<MarketCache> {
  const data = await loadSettingsData()
  return parseCache(data.market_cache)
}

export async function getTickerQuote(
  tickerInput: string,
  options?: { forceRefresh?: boolean },
): Promise<MarketQuoteResult | null> {
  const ticker = normalizeTicker(tickerInput)
  if (!ticker) return null

  const cache = await getMarketCache()
  const cached = cache[ticker]

  if (!options?.forceRefresh && cached && isFresh(cached)) {
    return {
      ticker,
      price: cached.price,
      fetchedAt: cached.fetchedAt,
      isStale: false,
      source: 'cache',
    }
  }

  const latestPrice = await fetchPriceFromYahoo(ticker)
  if (latestPrice !== null) {
    const fetchedAt = new Date().toISOString()
    const nextCache: MarketCache = {
      ...cache,
      [ticker]: {
        price: latestPrice,
        fetchedAt,
      },
    }
    await saveMarketCache(nextCache)

    return {
      ticker,
      price: latestPrice,
      fetchedAt,
      isStale: false,
      source: 'yahoo',
    }
  }

  if (cached) {
    return {
      ticker,
      price: cached.price,
      fetchedAt: cached.fetchedAt,
      isStale: true,
      source: 'cache-fallback',
    }
  }

  return null
}

export async function refreshTickerQuotes(
  tickers: string[],
  options?: { forceRefresh?: boolean },
): Promise<MarketQuoteResult[]> {
  const uniqueTickers = [...new Set(tickers.map(normalizeTicker).filter(Boolean))]
  const results: MarketQuoteResult[] = []

  for (const ticker of uniqueTickers) {
    const quote = await getTickerQuote(ticker, { forceRefresh: options?.forceRefresh === true })
    if (quote) {
      results.push(quote)
    }
  }

  return results
}
