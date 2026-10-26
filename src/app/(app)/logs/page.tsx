import { LogsPanel } from '@/components/dashboard/LogsPanel'
import { prisma } from '@/lib/prisma'

export const dynamic = 'force-dynamic'

function toRecord(value: unknown): Record<string, unknown> | null {
  if (typeof value === 'object' && value !== null && !Array.isArray(value)) {
    return value as Record<string, unknown>
  }
  return null
}

export default async function LogsPage() {
  const dayAgo = new Date()
  dayAgo.setDate(dayAgo.getDate() - 1)
  const [logs, errorsLast24Hours] = await Promise.all([
    prisma.appLog.findMany({ orderBy: { createdAt: 'desc' }, take: 500 }),
    prisma.appLog.count({ where: { level: 'error', createdAt: { gte: dayAgo } } }),
  ])

  return (
    <section className="space-y-5">
      <div className="space-y-1">
        <p className="text-xs font-semibold uppercase tracking-[0.24em] text-zinc-500 dark:text-zinc-400">Logs</p>
        <h2 className="text-2xl font-semibold tracking-tight">Systémové logy</h2>
        <p className="text-sm text-zinc-600 dark:text-zinc-300">AI alarmy, Proxmox a audit dôležitých udalostí na jednom mieste.</p>
      </div>

      <LogsPanel
        errorsLast24Hours={errorsLast24Hours}
        logs={logs.map((log) => ({
          id: log.id,
          source: log.source,
          level: log.level,
          message: log.message,
          details: toRecord(log.details),
          createdAt: log.createdAt.toISOString(),
        }))}
      />
    </section>
  )
}
