import { NextResponse, type NextRequest } from 'next/server'
import { auth } from '@/lib/auth'
import { runAlarmNow } from '@/lib/ai-alarm-scheduler'

export const runtime = 'nodejs'

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (request.headers.get('sec-fetch-site') === 'cross-site') return NextResponse.json({ error: 'Cross-site request blocked.' }, { status: 403 })
  const { id } = await params
  try {
    const result = await runAlarmNow(id)
    return NextResponse.json(result, { status: result.status === 'success' ? 200 : 502 })
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Alarm sa nepodarilo spustiť.' }, { status: 400 })
  }
}
