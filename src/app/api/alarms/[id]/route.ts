import { NextResponse, type NextRequest } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

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

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth()
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { id } = await params
  if (!id) {
    return NextResponse.json({ error: 'Missing alarm id.' }, { status: 400 })
  }

  let body: unknown
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body.' }, { status: 400 })
  }

  const payload = (body ?? {}) as Record<string, unknown>
  const data: Record<string, unknown> = {}

  if (payload.time !== undefined) {
    const time = normalizeTime(payload.time)
    if (!time) {
      return NextResponse.json({ error: 'Invalid time.' }, { status: 400 })
    }
    data.time = time
  }

  if (payload.label !== undefined) {
    data.label = typeof payload.label === 'string' && payload.label.trim() ? payload.label.trim() : null
  }

  if (payload.isRepeat !== undefined) {
    data.isRepeat = payload.isRepeat === true
  }

  if (payload.isEnabled !== undefined) {
    data.isEnabled = payload.isEnabled === true
  }

  if (payload.runClaude !== undefined) {
    data.runClaude = payload.runClaude === true
  }

  if (payload.runCodex !== undefined) {
    data.runCodex = payload.runCodex === true
  }

  if (payload.days !== undefined) {
    const days = normalizeDays(payload.days)
    data.days = days.length > 0 ? days.join(',') : null
  }

  if (payload.date !== undefined) {
    if (payload.date === null) {
      data.date = null
    } else {
      const date = normalizeDate(payload.date)
      if (!date) {
        return NextResponse.json({ error: 'Invalid date.' }, { status: 400 })
      }
      data.date = date
    }
  }

  if (Object.keys(data).length === 0) {
    return NextResponse.json({ error: 'No fields to update.' }, { status: 400 })
  }

  await prisma.aiAlarm.update({
    where: { id },
    data,
  })

  return NextResponse.json({ ok: true })
}

export async function DELETE(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth()
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { id } = await params
  if (!id) {
    return NextResponse.json({ error: 'Missing alarm id.' }, { status: 400 })
  }

  await prisma.aiAlarm.delete({ where: { id } })

  return NextResponse.json({ ok: true })
}
