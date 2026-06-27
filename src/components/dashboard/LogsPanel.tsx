'use client'

import { useMemo, useState } from 'react'

type LogEntry = {
  id: string
  source: string
  level: string
  message: string
  details: Record<string, unknown> | null
  createdAt: string
}

type SortKey = 'newest' | 'oldest' | 'level' | 'source'

const levelOrder: Record<string, number> = {
  error: 0,
  warn: 1,
  info: 2,
  debug: 3,
}

function formatTimestamp(value: string): string {
  return new Intl.DateTimeFormat('sk-SK', {
    dateStyle: 'short',
    timeStyle: 'medium',
    timeZone: 'Europe/Bratislava',
  }).format(new Date(value))
}

function levelStyles(level: string): string {
  if (level === 'error') return 'border-rose-200 bg-rose-50 text-rose-700 dark:border-rose-900/60 dark:bg-rose-950/40 dark:text-rose-200'
  if (level === 'warn') return 'border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-900/60 dark:bg-amber-950/40 dark:text-amber-200'
  if (level === 'debug') return 'border-zinc-200 bg-zinc-100 text-zinc-700 dark:border-zinc-800 dark:bg-zinc-800 dark:text-zinc-200'
  return 'border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-900/60 dark:bg-emerald-950/40 dark:text-emerald-200'
}

function sourceLabel(value: string): string {
  return value.replace(/[-_]/g, ' ')
}

export function LogsPanel({ logs }: { logs: LogEntry[] }) {
  const [sortKey, setSortKey] = useState<SortKey>('newest')
  const [levelFilter, setLevelFilter] = useState<string>('all')
  const [sourceFilter, setSourceFilter] = useState<string>('all')

  const sources = useMemo(() => Array.from(new Set(logs.map((log) => log.source))).sort(), [logs])
  const levels = useMemo(() => Array.from(new Set(logs.map((log) => log.level))).sort(), [logs])

  const sortedLogs = useMemo(() => {
    const filtered = logs.filter((log) => {
      if (levelFilter !== 'all' && log.level !== levelFilter) return false
      if (sourceFilter !== 'all' && log.source !== sourceFilter) return false
      return true
    })

    return [...filtered].sort((left, right) => {
      if (sortKey === 'newest') return new Date(right.createdAt).getTime() - new Date(left.createdAt).getTime()
      if (sortKey === 'oldest') return new Date(left.createdAt).getTime() - new Date(right.createdAt).getTime()
      if (sortKey === 'level') return (levelOrder[left.level] ?? 99) - (levelOrder[right.level] ?? 99) || new Date(right.createdAt).getTime() - new Date(left.createdAt).getTime()
      return left.source.localeCompare(right.source) || new Date(right.createdAt).getTime() - new Date(left.createdAt).getTime()
    })
  }, [logs, sortKey, levelFilter, sourceFilter])

  return (
    <section className="overflow-hidden rounded-[2rem] border border-zinc-200 bg-white shadow-sm dark:border-zinc-800 dark:bg-zinc-950">
      <div className="border-b border-zinc-200 px-4 py-4 dark:border-zinc-800 sm:px-6">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.24em] text-zinc-500 dark:text-zinc-400">Logs</p>
            <h3 className="mt-1 text-xl font-semibold tracking-tight text-zinc-900 dark:text-zinc-100">AI runner activity</h3>
            <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-300">Filter and sort recent scheduler events, push attempts, and errors.</p>
          </div>

          <div className="flex flex-wrap gap-2 text-sm">
            <select
              value={sortKey}
              onChange={(event) => setSortKey(event.target.value as SortKey)}
              className="rounded-xl border border-zinc-200 bg-white px-3 py-2 text-sm text-zinc-700 outline-none transition focus:border-zinc-400 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-200"
            >
              <option value="newest">Newest</option>
              <option value="oldest">Oldest</option>
              <option value="level">Level</option>
              <option value="source">Source</option>
            </select>

            <select
              value={levelFilter}
              onChange={(event) => setLevelFilter(event.target.value)}
              className="rounded-xl border border-zinc-200 bg-white px-3 py-2 text-sm text-zinc-700 outline-none transition focus:border-zinc-400 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-200"
            >
              <option value="all">All levels</option>
              {levels.map((level) => (
                <option key={level} value={level}>
                  {level}
                </option>
              ))}
            </select>

            <select
              value={sourceFilter}
              onChange={(event) => setSourceFilter(event.target.value)}
              className="rounded-xl border border-zinc-200 bg-white px-3 py-2 text-sm text-zinc-700 outline-none transition focus:border-zinc-400 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-200"
            >
              <option value="all">All sources</option>
              {sources.map((source) => (
                <option key={source} value={source}>
                  {sourceLabel(source)}
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>

      <div className="max-h-[34rem] divide-y divide-zinc-100 overflow-y-auto dark:divide-zinc-800">
        {sortedLogs.length > 0 ? (
          sortedLogs.map((log) => (
            <article key={log.id} className="px-4 py-4 sm:px-6">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                <div className="space-y-2">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className={`rounded-full border px-2.5 py-1 text-[11px] font-semibold uppercase tracking-[0.18em] ${levelStyles(log.level)}`}>
                      {log.level}
                    </span>
                    <span className="rounded-full border border-zinc-200 bg-zinc-50 px-2.5 py-1 text-[11px] font-semibold uppercase tracking-[0.18em] text-zinc-600 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-300">
                      {sourceLabel(log.source)}
                    </span>
                  </div>

                  <p className="text-sm font-medium text-zinc-900 dark:text-zinc-100">{log.message}</p>

                  {log.details ? (
                    <pre className="max-w-full overflow-x-auto rounded-2xl bg-zinc-100 p-3 text-xs leading-5 text-zinc-700 dark:bg-zinc-900 dark:text-zinc-300">
                      {JSON.stringify(log.details, null, 2)}
                    </pre>
                  ) : null}
                </div>

                <time className="shrink-0 text-xs font-medium text-zinc-500 dark:text-zinc-400">
                  {formatTimestamp(log.createdAt)}
                </time>
              </div>
            </article>
          ))
        ) : (
          <div className="px-4 py-10 text-center text-sm text-zinc-500 dark:text-zinc-400 sm:px-6">
            No log entries match the current filters.
          </div>
        )}
      </div>
    </section>
  )
}