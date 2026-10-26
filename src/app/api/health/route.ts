import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export const dynamic = 'force-dynamic'

export async function GET() {
  const startedAt = Date.now()
  try {
    await prisma.$queryRaw`SELECT 1`
    return NextResponse.json({
      ok: true,
      database: 'ready',
      scheduler: process.env.ENABLE_AI_ALARM_SCHEDULER === 'true' ? 'enabled' : 'disabled',
      proxmox: Boolean(process.env.PROXMOX_URL && process.env.PROXMOX_TOKEN_ID && process.env.PROXMOX_TOKEN_SECRET) ? 'configured' : 'not-configured',
      timestamp: new Date().toISOString(),
      responseMs: Date.now() - startedAt,
    }, { headers: { 'Cache-Control': 'no-store' } })
  } catch {
    return NextResponse.json({ ok: false, database: 'unavailable', timestamp: new Date().toISOString() }, { status: 503, headers: { 'Cache-Control': 'no-store' } })
  }
}
