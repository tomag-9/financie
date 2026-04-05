import { Prisma } from '@prisma/client'
import { NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

function normalizeText(value: unknown): string | null {
  if (typeof value !== 'string') return null
  const normalized = value.trim()
  return normalized ? normalized : null
}

function normalizeAmount(value: unknown): Prisma.Decimal | null {
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

function normalizeDate(value: unknown): Date | null {
  if (value === null || value === undefined || value === '') return null
  if (typeof value !== 'string') return null

  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value.trim())
  if (!match) return null

  const year = Number(match[1])
  const month = Number(match[2])
  const day = Number(match[3])
  if (!Number.isInteger(year) || !Number.isInteger(month) || !Number.isInteger(day)) return null

  return new Date(Date.UTC(year, month - 1, day))
}

function normalizeBoolean(value: unknown, fallback = true): boolean {
  if (typeof value === 'boolean') return value
  if (typeof value === 'string') {
    const normalized = value.trim().toLowerCase()
    if (['true', '1', 'yes', 'on'].includes(normalized)) return true
    if (['false', '0', 'no', 'off'].includes(normalized)) return false
  }
  return fallback
}

function serializeLiability(liability: {
  id: string
  name: string
  totalAmount: Prisma.Decimal
  remaining: Prisma.Decimal
  dueDate: Date | null
  category: string | null
  isActive: boolean
  createdAt: Date
  updatedAt: Date
}) {
  return {
    ...liability,
    totalAmount: liability.totalAmount.toNumber(),
    remaining: liability.remaining.toNumber(),
    dueDate: liability.dueDate ? liability.dueDate.toISOString() : null,
    createdAt: liability.createdAt.toISOString(),
    updatedAt: liability.updatedAt.toISOString(),
  }
}

export async function GET() {
  const liabilities = await prisma.liability.findMany({
    orderBy: [{ isActive: 'desc' }, { dueDate: 'asc' }, { createdAt: 'asc' }],
    select: {
      id: true,
      name: true,
      totalAmount: true,
      remaining: true,
      dueDate: true,
      category: true,
      isActive: true,
      createdAt: true,
      updatedAt: true,
    },
  })

  return NextResponse.json({
    liabilities: liabilities.map(serializeLiability),
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
  const name = normalizeText(payload.name)
  const totalAmount = normalizeAmount(payload.totalAmount)
  const remainingInput = normalizeAmount(payload.remaining)
  const dueDate = normalizeDate(payload.dueDate)
  const category = normalizeText(payload.category)
  const isActive = normalizeBoolean(payload.isActive, true)

  if (!name || totalAmount === null) {
    return NextResponse.json({ error: 'Názov a celková suma sú povinné.' }, { status: 400 })
  }

  const remaining = remainingInput ?? totalAmount

  const liability = await prisma.liability.create({
    data: {
      name,
      totalAmount,
      remaining,
      dueDate,
      category,
      isActive,
    },
    select: {
      id: true,
      name: true,
      totalAmount: true,
      remaining: true,
      dueDate: true,
      category: true,
      isActive: true,
      createdAt: true,
      updatedAt: true,
    },
  })

  return NextResponse.json({ liability: serializeLiability(liability) }, { status: 201 })
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
    return NextResponse.json({ error: 'ID záväzku je povinné.' }, { status: 400 })
  }

  if (action === 'edit') {
    const name = normalizeText(payload.name)
    const totalAmount = normalizeAmount(payload.totalAmount)
    const remainingInput = normalizeAmount(payload.remaining)
    const dueDate = normalizeDate(payload.dueDate)
    const category = normalizeText(payload.category)
    const isActive = normalizeBoolean(payload.isActive, true)

    if (!name || totalAmount === null) {
      return NextResponse.json({ error: 'Názov a celková suma sú povinné.' }, { status: 400 })
    }

    const remaining = remainingInput ?? totalAmount

    try {
      const liability = await prisma.liability.update({
        where: { id },
        data: {
          name,
          totalAmount,
          remaining,
          dueDate,
          category,
          isActive,
        },
        select: {
          id: true,
          name: true,
          totalAmount: true,
          remaining: true,
          dueDate: true,
          category: true,
          isActive: true,
          createdAt: true,
          updatedAt: true,
        },
      })

      return NextResponse.json({ liability: serializeLiability(liability) })
    } catch {
      return NextResponse.json({ error: 'Záväzok neexistuje.' }, { status: 404 })
    }
  }

  if (action === 'deactivate' || action === 'mark-paid') {
    try {
      const liability = await prisma.liability.update({
        where: { id },
        data: {
          isActive: false,
          remaining: new Prisma.Decimal(0),
        },
        select: {
          id: true,
          name: true,
          totalAmount: true,
          remaining: true,
          dueDate: true,
          category: true,
          isActive: true,
          createdAt: true,
          updatedAt: true,
        },
      })

      return NextResponse.json({ liability: serializeLiability(liability) })
    } catch {
      return NextResponse.json({ error: 'Záväzok neexistuje.' }, { status: 404 })
    }
  }

  return NextResponse.json({ error: 'Nepodporovaná akcia.' }, { status: 400 })
}
