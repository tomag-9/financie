'use client'

import { useCallback, useEffect, useState } from 'react'

type Container = {
  vmid: number
  name: string
  status: string
  uptime: number
  cpu: number
  memory: number
  maxMemory: number
}

type Action = 'start' | 'stop' | 'reboot'

const ACTION_LABELS: Record<Action, string> = {
  start: 'Spustiť',
  stop: 'Zastaviť',
  reboot: 'Reštartovať',
}

function formatBytes(bytes: number): string {
  if (!Number.isFinite(bytes) || bytes <= 0) return '—'
  return `${(bytes / 1024 / 1024 / 1024).toFixed(1)} GB`
}

function formatUptime(seconds: number): string {
  if (!Number.isFinite(seconds) || seconds <= 0) return '—'
  const days = Math.floor(seconds / 86_400)
  const hours = Math.floor((seconds % 86_400) / 3_600)
  return days > 0 ? `${days} d ${hours} h` : `${hours} h`
}

async function readError(response: Response): Promise<string> {
  try {
    const body = (await response.json()) as { error?: unknown }
    if (typeof body.error === 'string') return body.error
  } catch {
    // The generic message below also covers non-JSON proxy errors.
  }
  return `Požiadavka zlyhala (HTTP ${response.status}).`
}

export function ProxmoxPanel() {
  const [containers, setContainers] = useState<Container[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [pending, setPending] = useState<string | null>(null)

  const loadContainers = useCallback(async (showLoader = false) => {
    if (showLoader) setLoading(true)
    try {
      const response = await fetch('/api/proxmox/containers', { cache: 'no-store' })
      if (!response.ok) throw new Error(await readError(response))
      const body = (await response.json()) as { containers?: Container[] }
      setContainers(Array.isArray(body.containers) ? body.containers : [])
      setError(null)
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : 'Nepodarilo sa načítať Proxmox.')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void loadContainers(true)
    const timer = window.setInterval(() => void loadContainers(), 10_000)
    return () => window.clearInterval(timer)
  }, [loadContainers])

  async function runAction(container: Container, action: Action) {
    const warning = action === 'stop'
      ? `Naozaj okamžite zastaviť CT ${container.vmid} (${container.name})? Neuložené dáta v kontajneri sa môžu stratiť.`
      : `Naozaj ${ACTION_LABELS[action].toLowerCase()} CT ${container.vmid} (${container.name})?`
    if (!window.confirm(warning)) return

    const key = `${container.vmid}:${action}`
    setPending(key)
    setError(null)
    try {
      const response = await fetch(`/api/proxmox/containers/${container.vmid}/action`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action }),
      })
      if (!response.ok) throw new Error(await readError(response))
      window.setTimeout(() => void loadContainers(), 1_500)
    } catch (actionError) {
      setError(actionError instanceof Error ? actionError.message : 'Akciu sa nepodarilo spustiť.')
    } finally {
      setPending(null)
    }
  }

  if (loading) {
    return <div className="rounded-2xl border border-zinc-200 bg-white p-6 text-sm text-zinc-500 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-400">Pripájam sa k Proxmoxu…</div>
  }

  return (
    <div className="space-y-4">
      {error ? (
        <div role="alert" className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700 dark:border-rose-900/60 dark:bg-rose-950/30 dark:text-rose-300">
          {error}
        </div>
      ) : null}

      <div className="grid gap-4 lg:grid-cols-2">
        {containers.map((container) => {
          const running = container.status === 'running'
          const busy = pending?.startsWith(`${container.vmid}:`) === true
          const memoryPercent = container.maxMemory > 0 ? Math.min(100, (container.memory / container.maxMemory) * 100) : 0

          return (
            <article key={container.vmid} className="rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-[0.2em] text-zinc-500 dark:text-zinc-400">CT {container.vmid}</p>
                  <h3 className="mt-1 text-xl font-semibold text-zinc-900 dark:text-zinc-100">{container.name}</h3>
                </div>
                <span className={`inline-flex items-center gap-2 rounded-full px-3 py-1 text-xs font-semibold ${running ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300' : 'bg-zinc-200 text-zinc-700 dark:bg-zinc-800 dark:text-zinc-300'}`}>
                  <span className={`size-2 rounded-full ${running ? 'bg-emerald-500' : 'bg-zinc-500'}`} />
                  {running ? 'Beží' : container.status === 'stopped' ? 'Zastavený' : container.status}
                </span>
              </div>

              <dl className="mt-5 grid grid-cols-3 gap-3 text-sm">
                <div className="rounded-xl bg-zinc-50 p-3 dark:bg-zinc-950/60">
                  <dt className="text-xs text-zinc-500 dark:text-zinc-400">CPU</dt>
                  <dd className="mt-1 font-semibold">{running ? `${(container.cpu * 100).toFixed(1)} %` : '—'}</dd>
                </div>
                <div className="rounded-xl bg-zinc-50 p-3 dark:bg-zinc-950/60">
                  <dt className="text-xs text-zinc-500 dark:text-zinc-400">RAM</dt>
                  <dd className="mt-1 font-semibold" title={`${formatBytes(container.memory)} / ${formatBytes(container.maxMemory)}`}>{running ? `${memoryPercent.toFixed(0)} %` : '—'}</dd>
                </div>
                <div className="rounded-xl bg-zinc-50 p-3 dark:bg-zinc-950/60">
                  <dt className="text-xs text-zinc-500 dark:text-zinc-400">Uptime</dt>
                  <dd className="mt-1 font-semibold">{running ? formatUptime(container.uptime) : '—'}</dd>
                </div>
              </dl>

              <div className="mt-5 flex flex-wrap gap-2">
                <button type="button" disabled={running || busy} onClick={() => void runAction(container, 'start')} className="rounded-lg bg-emerald-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-emerald-500 disabled:cursor-not-allowed disabled:opacity-40">
                  Spustiť
                </button>
                <button type="button" disabled={!running || busy} onClick={() => void runAction(container, 'reboot')} className="rounded-lg border border-amber-300 bg-amber-50 px-4 py-2 text-sm font-semibold text-amber-800 transition hover:bg-amber-100 disabled:cursor-not-allowed disabled:opacity-40 dark:border-amber-900/70 dark:bg-amber-950/40 dark:text-amber-300">
                  Reštartovať
                </button>
                <button type="button" disabled={!running || busy} onClick={() => void runAction(container, 'stop')} className="rounded-lg border border-rose-300 bg-rose-50 px-4 py-2 text-sm font-semibold text-rose-700 transition hover:bg-rose-100 disabled:cursor-not-allowed disabled:opacity-40 dark:border-rose-900/70 dark:bg-rose-950/40 dark:text-rose-300">
                  Zastaviť
                </button>
                {busy ? <span className="self-center text-xs text-zinc-500 dark:text-zinc-400">Odosielam…</span> : null}
              </div>
            </article>
          )
        })}
      </div>

      {!error && containers.length === 0 ? (
        <p className="rounded-xl border border-zinc-200 bg-white p-4 text-sm text-zinc-600 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-300">Nie sú nastavené žiadne povolené kontajnery.</p>
      ) : null}

      <div className="flex justify-end">
        <button type="button" onClick={() => void loadContainers(true)} disabled={loading} className="rounded-lg border border-zinc-300 px-3 py-2 text-xs font-semibold text-zinc-700 transition hover:bg-zinc-100 disabled:opacity-50 dark:border-zinc-700 dark:text-zinc-200 dark:hover:bg-zinc-800">
          Obnoviť stav
        </button>
      </div>
    </div>
  )
}
