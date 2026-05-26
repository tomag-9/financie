import { NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { syncAiAlarmScheduler } from '@/lib/ai-alarm-scheduler'

function normalizeTime(value: unknown): string | null {
  if (typeof value !== 'string') return null
  const trimmed = value.trim()
  const match = /^(\d{2}):(\d{2})$/.exec(trimmed)
  if (!match) return null
  const hours = Number(match[1])
  const minutes = Number(match[2])
  if (!Number.isInteger(hours) || !Number.isInteger(minutes)) return null
  if (hours < 0 || hours > 23 || minutes < 0 || minutes > 59) return null
  return trimmed
}

function normalizeDate(value: unknown): Date | null {
  if (typeof value !== 'string') return null
  const trimmed = value.trim()
  if (!/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) return null
  const date = new Date(`${trimmed}T00:00:00`)
  return Number.isNaN(date.getTime()) ? null : date
}

function normalizeDays(value: unknown): number[] {
  if (!Array.isArray(value)) return []
  const days = value
    .map((item) => (typeof item === 'number' ? item : Number(item)))
    .filter((day) => Number.isInteger(day) && day >= 0 && day <= 6)

  return Array.from(new Set(days)).sort()
}

export async function GET() {
  const session = await auth()
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const alarms = await prisma.aiAlarm.findMany({
    orderBy: [{ isEnabled: 'desc' }, { time: 'asc' }],
  })

  return NextResponse.json({
    alarms: alarms.map((alarm) => ({
      id: alarm.id,
      label: alarm.label,
      time: alarm.time,
      date: alarm.date ? alarm.date.toISOString().slice(0, 10) : null,
      days: alarm.days
        ? alarm.days
            .split(',')
            .map((day) => Number(day))
            .filter((day) => Number.isInteger(day))
        : [],
      isRepeat: alarm.isRepeat,
      isEnabled: alarm.isEnabled,
      runClaude: alarm.runClaude,
      runCodex: alarm.runCodex,
      lastTriggeredAt: alarm.lastTriggeredAt ? alarm.lastTriggeredAt.toISOString() : null,
    })),
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
    return NextResponse.json({ error: 'Invalid JSON body.' }, { status: 400 })
  }

  const payload = (body ?? {}) as Record<string, unknown>
  const time = normalizeTime(payload.time)
  if (!time) {
    return NextResponse.json({ error: 'Invalid time.' }, { status: 400 })
  }

  const isRepeat = payload.isRepeat === true
  const days = normalizeDays(payload.days)
  const date = isRepeat ? null : normalizeDate(payload.date)

  if (isRepeat && days.length === 0) {
    return NextResponse.json({ error: 'Select at least one day.' }, { status: 400 })
  }

  if (!isRepeat && payload.date !== undefined && payload.date !== null && !date) {
    return NextResponse.json({ error: 'Invalid date for one-off alarm.' }, { status: 400 })
  }

  const created = await prisma.aiAlarm.create({
    data: {
      label: typeof payload.label === 'string' && payload.label.trim() ? payload.label.trim() : null,
      time,
      date,
      days: isRepeat ? days.join(',') : null,
      isRepeat,
      isEnabled: payload.isEnabled !== false,
      runClaude: payload.runClaude !== false,
      runCodex: payload.runCodex === true,
    },
  })

  await syncAiAlarmScheduler()

  return NextResponse.json({ id: created.id }, { status: 201 })
}
