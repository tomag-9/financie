import { NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { savePushSubscription } from '@/lib/push'
import type { PushSubscriptionData } from '@/types'

function isValidSubscription(value: unknown): value is PushSubscriptionData {
  if (typeof value !== 'object' || value === null) return false
  const record = value as Record<string, unknown>
  const keys = record.keys
  if (typeof record.endpoint !== 'string') return false
  if (typeof keys !== 'object' || keys === null) return false
  const keyRecord = keys as Record<string, unknown>

  return typeof keyRecord.p256dh === 'string' && typeof keyRecord.auth === 'string'
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

  if (!isValidSubscription(body)) {
    return NextResponse.json({ error: 'Invalid push subscription payload.' }, { status: 400 })
  }

  await savePushSubscription(body)
  return NextResponse.json({ ok: true })
}

export async function DELETE() {
  const session = await auth()
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  await savePushSubscription(null)
  return NextResponse.json({ ok: true })
}
