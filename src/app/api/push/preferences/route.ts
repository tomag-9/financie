import { NextResponse, type NextRequest } from 'next/server'
import { auth } from '@/lib/auth'
import { getAiAlarmSuccessPushEnabled, getSettingsData, saveAiAlarmSuccessPushEnabled } from '@/lib/push'

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
  const enabled = normalizeEnabled(payload.enabled ?? payload.aiAlarmSuccessPushEnabled)
  if (enabled === null) {
    return NextResponse.json({ error: 'Invalid enabled flag.' }, { status: 400 })
  }

  await saveAiAlarmSuccessPushEnabled(enabled)

  return NextResponse.json({ ok: true, aiAlarmSuccessPushEnabled: enabled })
}