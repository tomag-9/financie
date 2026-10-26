import type { Prisma } from '@prisma/client'
import { prisma } from '@/lib/prisma'

export async function writeAppLog(source: string, level: 'debug' | 'info' | 'warn' | 'error', message: string, details?: Record<string, unknown>) {
  try {
    return await prisma.appLog.create({ data: { source, level, message, details: details as Prisma.InputJsonValue | undefined } })
  } catch (error) {
    console.error('[app-log] Failed to persist event', error)
    return null
  }
}

export async function pruneAppLogs(retentionDays = 90) {
  const safeDays = Math.max(7, Math.min(3650, Math.trunc(retentionDays)))
  const before = new Date(Date.now() - safeDays * 86_400_000)
  return prisma.appLog.deleteMany({ where: { createdAt: { lt: before } } })
}
