import { NextResponse } from 'next/server'
import { sendPushNotification } from '@/lib/push'

function previousMonthKeyUtc(): string {
  const now = new Date()
  const year = now.getUTCMonth() === 0 ? now.getUTCFullYear() - 1 : now.getUTCFullYear()
  const month = now.getUTCMonth() === 0 ? 12 : now.getUTCMonth()
  return `${year}-${String(month).padStart(2, '0')}`
}

function isAuthorized(request: Request): boolean {
  const configuredSecret = process.env.CRON_SECRET
  if (!configuredSecret) return true

  const authHeader = request.headers.get('authorization') ?? ''
  return authHeader === `Bearer ${configuredSecret}`
}

export async function POST(request: Request) {
  if (!isAuthorized(request)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  if (process.env.ENABLE_CRON !== 'true') {
    return NextResponse.json({ ok: false, skipped: true, reason: 'Cron disabled.' })
  }

  const month = previousMonthKeyUtc()
  const sent = await sendPushNotification({
    title: 'Financie',
    body: `Čas zadať financie za ${month}`,
    url: `/snapshots?month=${month}`,
  })

  return NextResponse.json({
    ok: sent,
    month,
    sent,
  })
}
