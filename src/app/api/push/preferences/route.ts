import { NextResponse, type NextRequest } from 'next/server'
import { auth } from '@/lib/auth'
import {
  getAiAlarmErrorPushEnabled,
  getAiAlarmSuccessPushEnabled,
  getSettingsData,
  saveAiAlarmErrorPushEnabled,
  saveAiAlarmSuccessPushEnabled,
} from '@/lib/push'

export const runtime = 'nodejs'

function normalizeEnabled(value: unknown): boolean | null {
  if (typeof value === 'boolean') return value
  if (typeof value === 'string') {
    if (value === 'true') return true
    if (value === 'false') return false
  }

  return null
}

export async function GET() {
  const session = await auth()
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const settings = await getSettingsData()

  return NextResponse.json({
    aiAlarmSuccessPushEnabled: getAiAlarmSuccessPushEnabled(settings),
    aiAlarmErrorPushEnabled: getAiAlarmErrorPushEnabled(settings),
  })
}

export async function PATCH(request: NextRequest) {
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
  const preference = payload.preference === 'error' ? 'error' : 'success'
  const enabled = normalizeEnabled(
    payload.enabled ?? (preference === 'error' ? payload.aiAlarmErrorPushEnabled : payload.aiAlarmSuccessPushEnabled),
  )
  if (enabled === null) {
    return NextResponse.json({ error: 'Invalid notification preference.' }, { status: 400 })
  }

  if (preference === 'error') {
    await saveAiAlarmErrorPushEnabled(enabled)
  } else {
    await saveAiAlarmSuccessPushEnabled(enabled)
  }

  return NextResponse.json({ ok: true, preference, enabled })
}
