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
  const logs = await prisma.appLog.findMany({
    where: { source: 'ai-alarm' },
    orderBy: { createdAt: 'desc' },
    take: 120,
  })

  return (
    <section className="space-y-5">
      <div className="space-y-1">
        <p className="text-xs font-semibold uppercase tracking-[0.24em] text-zinc-500 dark:text-zinc-400">Logs</p>
        <h2 className="text-2xl font-semibold tracking-tight">AI runner logs</h2>
        <p className="text-sm text-zinc-600 dark:text-zinc-300">Filter, sort, and inspect scheduler events from the AI runner.</p>
      </div>

      <LogsPanel
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