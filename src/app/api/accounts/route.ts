import { AccountType } from '@prisma/client'
import { NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

type AccountTypeValue = (typeof AccountType)[keyof typeof AccountType]
type MoveDirection = 'up' | 'down'

function isAccountType(value: unknown): value is AccountTypeValue {
  return typeof value === 'string' && Object.values(AccountType).includes(value as AccountTypeValue)
}

function normalizeName(value: unknown): string | null {
  if (typeof value !== 'string') return null
  const normalized = value.trim()
  if (!normalized) return null
  return normalized
}

function normalizeCurrency(value: unknown): string | null {
  if (typeof value !== 'string') return null
  const normalized = value.trim().toUpperCase()
  if (!normalized || normalized.length > 10) return null
  return normalized
}

function normalizeId(value: unknown): string | null {
  if (typeof value !== 'string') return null
  const normalized = value.trim()
  if (!normalized) return null
  return normalized
}

function isMoveDirection(value: unknown): value is MoveDirection {
  return value === 'up' || value === 'down'
}

export async function GET() {
  const accounts = await prisma.account.findMany({
    orderBy: [{ sortOrder: 'asc' }, { createdAt: 'asc' }],
    select: {
      id: true,
      name: true,
      type: true,
      currency: true,
      isActive: true,
      sortOrder: true,
    },
  })

  return NextResponse.json({ accounts })
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
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
  }

  const payload = (body ?? {}) as Record<string, unknown>

  const name = normalizeName(payload.name)
  const type = payload.type
  const currency = normalizeCurrency(payload.currency)

  if (!name || !currency || !isAccountType(type)) {
    return NextResponse.json(
      { error: 'Invalid payload. Required: name, type, currency.' },
      { status: 400 },
    )
  }

  const maxSortOrder = await prisma.account.aggregate({ _max: { sortOrder: true } })
  const nextSortOrder = (maxSortOrder._max.sortOrder ?? -1) + 1

  const account = await prisma.account.create({
    data: {
      name,
      type,
      currency,
      isActive: true,
      sortOrder: nextSortOrder,
    },
    select: {
      id: true,
      name: true,
      type: true,
      currency: true,
      isActive: true,
      sortOrder: true,
    },
  })

  return NextResponse.json({ account }, { status: 201 })
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
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
  }

  const payload = (body ?? {}) as Record<string, unknown>
  const action = payload.action

  if (action === 'edit') {
    const id = normalizeId(payload.id)
    const name = normalizeName(payload.name)
    const type = payload.type
    const currency = normalizeCurrency(payload.currency)

    if (!id || !name || !currency || !isAccountType(type)) {
      return NextResponse.json(
        { error: 'Invalid payload for edit action.' },
        { status: 400 },
      )
    }

    try {
      const account = await prisma.account.update({
        where: { id },
        data: {
          name,
          type,
          currency,
        },
        select: {
          id: true,
          name: true,
          type: true,
          currency: true,
          isActive: true,
          sortOrder: true,
        },
      })

      return NextResponse.json({ account })
    } catch {
      return NextResponse.json({ error: 'Account not found.' }, { status: 404 })
    }
  }

  if (action === 'deactivate') {
    const id = normalizeId(payload.id)
    if (!id) {
      return NextResponse.json(
        { error: 'Invalid payload for deactivate action.' },
        { status: 400 },
      )
    }

    try {
      const account = await prisma.account.update({
        where: { id },
        data: { isActive: false },
        select: {
          id: true,
          name: true,
          type: true,
          currency: true,
          isActive: true,
          sortOrder: true,
        },
      })

      return NextResponse.json({ account })
    } catch {
      return NextResponse.json({ error: 'Account not found.' }, { status: 404 })
    }
  }

  if (action === 'move') {
    const id = normalizeId(payload.id)
    const direction = payload.direction

    if (!id || !isMoveDirection(direction)) {
      return NextResponse.json({ error: 'Invalid payload for move action.' }, { status: 400 })
    }

    const account = await prisma.$transaction(async (tx) => {
      const ordered = await tx.account.findMany({
        orderBy: [{ sortOrder: 'asc' }, { createdAt: 'asc' }],
        select: { id: true },
      })

      const currentIndex = ordered.findIndex((item) => item.id === id)
      if (currentIndex === -1) return null

      const targetIndex = direction === 'up' ? currentIndex - 1 : currentIndex + 1
      if (targetIndex < 0 || targetIndex >= ordered.length) {
        return tx.account.findUnique({
          where: { id },
          select: {
            id: true,
            name: true,
            type: true,
            currency: true,
            isActive: true,
            sortOrder: true,
          },
        })
      }

      const reordered = [...ordered]
      const [moved] = reordered.splice(currentIndex, 1)
      reordered.splice(targetIndex, 0, moved)

      await Promise.all(
        reordered.map((item, index) =>
          tx.account.update({
            where: { id: item.id },
            data: { sortOrder: index },
          }),
        ),
      )

      return tx.account.findUnique({
        where: { id },
        select: {
          id: true,
          name: true,
          type: true,
          currency: true,
          isActive: true,
          sortOrder: true,
        },
      })
    })

    if (!account) {
      return NextResponse.json({ error: 'Account not found.' }, { status: 404 })
    }

    return NextResponse.json({ account })
  }

  return NextResponse.json({ error: 'Unsupported action.' }, { status: 400 })
}
