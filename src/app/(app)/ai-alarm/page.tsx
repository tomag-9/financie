'use client'

import { useEffect, useMemo, useState } from 'react'

type Alarm = {
  id: string
  label: string | null
  time: string
  date: string | null
  days: number[]
  isRepeat: boolean
  isEnabled: boolean
  runClaude: boolean
  runCodex: boolean
  lastTriggeredAt: string | null
}

type AlarmPayload = {
  label: string | null
  time: string
  date: string | null
  days: number[]
  isRepeat: boolean
  isEnabled: boolean
  runClaude: boolean
  runCodex: boolean
}

const dayOptions = [
  { label: 'Mon', value: 1 },
  { label: 'Tue', value: 2 },
  { label: 'Wed', value: 3 },
  { label: 'Thu', value: 4 },
  { label: 'Fri', value: 5 },
  { label: 'Sat', value: 6 },
  { label: 'Sun', value: 0 },
]

function todayKey(): string {
  return new Date().toISOString().slice(0, 10)
}

function Toggle({
  checked,
  onChange,
  label,
}: {
  checked: boolean
  onChange: (value: boolean) => void
  label: string
}) {
  return (
    <button
      type="button"
      onClick={() => onChange(!checked)}
      className={`inline-flex items-center gap-2 rounded-full border px-2.5 py-1 text-xs font-semibold transition ${
        checked
          ? 'border-emerald-200 bg-emerald-100 text-emerald-800'
          : 'border-zinc-200 bg-white text-zinc-600 dark:border-zinc-800 dark:bg-zinc-950 dark:text-zinc-300'
      }`}
      aria-pressed={checked}
    >
      <span
        className={`relative inline-flex h-4 w-7 items-center rounded-full transition ${
          checked ? 'bg-emerald-500' : 'bg-zinc-300 dark:bg-zinc-700'
        }`}
        aria-hidden="true"
      >
        <span
          className={`inline-block size-3 rounded-full bg-white shadow-sm transition ${checked ? 'translate-x-3' : 'translate-x-1'}`}
        />
      </span>
      {label}
    </button>
  )
}

export default function AiAlarmPage() {
  const [alarms, setAlarms] = useState<Alarm[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)

  const [form, setForm] = useState<AlarmPayload>({
    label: '',
    time: '08:00',
    date: '',
    days: [1, 2, 3, 4, 5],
    isRepeat: true,
    isEnabled: true,
    runClaude: true,
    runCodex: false,
  })

  const selectedDays = useMemo(() => new Set(form.days), [form.days])

  async function loadAlarms() {
    setIsLoading(true)
    setError(null)

    try {
      const response = await fetch('/api/alarms')
      if (!response.ok) {
        throw new Error('Failed to load alarms.')
      }
      const payload = (await response.json()) as { alarms: Alarm[] }
      setAlarms(payload.alarms)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load alarms.')
    } finally {
      setIsLoading(false)
    }
  }

  useEffect(() => {
    void loadAlarms()
  }, [])

  async function createAlarm() {
    setSaving(true)
    setError(null)

    try {
      const response = await fetch('/api/alarms', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...form,
          label: form.label?.trim() ? form.label.trim() : null,
          date: form.isRepeat ? null : form.date?.trim() ? form.date : null,
          days: form.isRepeat ? form.days : [],
        }),
      })

      if (!response.ok) {
        const payload = (await response.json()) as { error?: string }
        throw new Error(payload.error ?? 'Failed to save alarm.')
      }

      await loadAlarms()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save alarm.')
    } finally {
      setSaving(false)
    }
  }

  async function updateAlarm(id: string, patch: Partial<AlarmPayload>) {
    setError(null)
    const response = await fetch(`/api/alarms/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(patch),
    })

    if (!response.ok) {
      const payload = (await response.json()) as { error?: string }
      setError(payload.error ?? 'Failed to update alarm.')
      return
    }

    await loadAlarms()
  }

  async function removeAlarm(id: string) {
    setError(null)
    const response = await fetch(`/api/alarms/${id}`, { method: 'DELETE' })
    if (!response.ok) {
      const payload = (await response.json()) as { error?: string }
      setError(payload.error ?? 'Failed to delete alarm.')
      return
    }

    await loadAlarms()
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold text-zinc-900 dark:text-zinc-100">AI Alarm</h1>
          <p className="text-sm text-zinc-500 dark:text-zinc-400">Schedule Claude or Codex runs from Docker.</p>
        </div>
      </div>

      <section className="rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm dark:border-zinc-800 dark:bg-zinc-950">
        <h2 className="text-sm font-semibold uppercase tracking-[0.2em] text-zinc-500">New alarm</h2>
        <div className="mt-4 grid gap-4 md:grid-cols-2">
          <label className="space-y-2 text-sm text-zinc-700 dark:text-zinc-300">
            Label (optional)
            <input
              type="text"
              value={form.label ?? ''}
              onChange={(event) => setForm((prev) => ({ ...prev, label: event.target.value }))}
              className="w-full rounded-lg border border-zinc-200 px-3 py-2 text-sm text-zinc-900 outline-none transition focus:border-zinc-400 dark:border-zinc-800 dark:bg-zinc-950 dark:text-zinc-100"
              placeholder="Morning briefing"
            />
          </label>

          <label className="space-y-2 text-sm text-zinc-700 dark:text-zinc-300">
            Time
            <input
              type="time"
              value={form.time}
              onChange={(event) => setForm((prev) => ({ ...prev, time: event.target.value }))}
              className="w-full rounded-lg border border-zinc-200 px-3 py-2 text-sm text-zinc-900 outline-none transition focus:border-zinc-400 dark:border-zinc-800 dark:bg-zinc-950 dark:text-zinc-100"
              required
            />
          </label>
        </div>

        <div className="mt-4 grid gap-4 md:grid-cols-2">
          <div className="flex items-center justify-between rounded-lg border border-zinc-200 px-3 py-2 text-sm text-zinc-700 dark:border-zinc-800 dark:text-zinc-300">
            <span>Repeat</span>
            <Toggle
              checked={form.isRepeat}
              onChange={(value) => setForm((prev) => ({ ...prev, isRepeat: value }))}
              label={form.isRepeat ? 'On' : 'Off'}
            />
          </div>

          {form.isRepeat ? (
            <div className="flex flex-wrap gap-2">
              {dayOptions.map((day) => (
                <button
                  key={day.value}
                  type="button"
                  onClick={() => {
                    setForm((prev) => {
                      const next = new Set(prev.days)
                      if (next.has(day.value)) {
                        next.delete(day.value)
                      } else {
                        next.add(day.value)
                      }
                      return { ...prev, days: Array.from(next).sort() }
                    })
                  }}
                  className={`rounded-full border px-3 py-1 text-xs font-semibold transition ${
                    selectedDays.has(day.value)
                      ? 'border-zinc-900 bg-zinc-900 text-white dark:border-zinc-100 dark:bg-zinc-100 dark:text-zinc-900'
                      : 'border-zinc-200 text-zinc-600 dark:border-zinc-800 dark:text-zinc-300'
                  }`}
                >
                  {day.label}
                </button>
              ))}
            </div>
          ) : (
            <label className="space-y-2 text-sm text-zinc-700 dark:text-zinc-300">
              Date (optional)
              <input
                type="date"
                value={form.date ?? ''}
                onChange={(event) => setForm((prev) => ({ ...prev, date: event.target.value }))}
                className="w-full rounded-lg border border-zinc-200 px-3 py-2 text-sm text-zinc-900 outline-none transition focus:border-zinc-400 dark:border-zinc-800 dark:bg-zinc-950 dark:text-zinc-100"
              />
              <span className="text-xs text-zinc-500">Empty date runs once at the nearest time.</span>
            </label>
          )}
        </div>

        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          <div className="flex items-center justify-between rounded-lg border border-zinc-200 px-3 py-2 text-sm text-zinc-700 dark:border-zinc-800 dark:text-zinc-300">
            <span>Claude</span>
            <Toggle
              checked={form.runClaude}
              onChange={(value) => setForm((prev) => ({ ...prev, runClaude: value }))}
              label={form.runClaude ? 'On' : 'Off'}
            />
          </div>
          <div className="flex items-center justify-between rounded-lg border border-zinc-200 px-3 py-2 text-sm text-zinc-700 dark:border-zinc-800 dark:text-zinc-300">
            <span>Codex</span>
            <Toggle
              checked={form.runCodex}
              onChange={(value) => setForm((prev) => ({ ...prev, runCodex: value }))}
              label={form.runCodex ? 'On' : 'Off'}
            />
          </div>
        </div>

        <div className="mt-5 flex flex-wrap items-center justify-between gap-3">
          {error ? <p className="text-sm text-rose-600">{error}</p> : <span />}
          <button
            type="button"
            disabled={saving}
            onClick={() => void createAlarm()}
            className="rounded-lg bg-zinc-900 px-4 py-2 text-sm font-semibold text-white transition hover:bg-zinc-700 disabled:cursor-not-allowed disabled:opacity-60 dark:bg-zinc-100 dark:text-zinc-900"
          >
            {saving ? 'Saving...' : 'Create alarm'}
          </button>
        </div>
      </section>

      <section className="space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-semibold uppercase tracking-[0.2em] text-zinc-500">Alarms</h2>
        </div>

        {isLoading ? (
          <div className="rounded-2xl border border-dashed border-zinc-200 bg-white p-5 text-sm text-zinc-500 dark:border-zinc-800 dark:bg-zinc-950">
            Loading alarms...
          </div>
        ) : alarms.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-zinc-200 bg-white p-5 text-sm text-zinc-500 dark:border-zinc-800 dark:bg-zinc-950">
            No alarms yet.
          </div>
        ) : (
          <div className="grid gap-4">
            {alarms.map((alarm) => (
              <div
                key={alarm.id}
                className="rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm dark:border-zinc-800 dark:bg-zinc-950"
              >
                <div className="flex flex-wrap items-start justify-between gap-4">
                  <div>
                    <p className="text-lg font-semibold text-zinc-900 dark:text-zinc-100">{alarm.time}</p>
                    <p className="text-sm text-zinc-500 dark:text-zinc-400">
                      {alarm.label ? `${alarm.label} · ` : ''}
                      {alarm.isRepeat
                        ? `Repeats: ${dayOptions
                            .filter((day) => alarm.days.includes(day.value))
                            .map((day) => day.label)
                            .join(', ') || 'No days set'}`
                        : `Date: ${alarm.date ?? 'Nearest run'}`}
                    </p>
                  </div>

                  <div className="flex flex-wrap items-center gap-2">
                    <Toggle
                      checked={alarm.isEnabled}
                      onChange={(value) => void updateAlarm(alarm.id, { isEnabled: value })}
                      label={alarm.isEnabled ? 'Enabled' : 'Off'}
                    />
                    <Toggle
                      checked={alarm.runClaude}
                      onChange={(value) => void updateAlarm(alarm.id, { runClaude: value })}
                      label="Claude"
                    />
                    <Toggle
                      checked={alarm.runCodex}
                      onChange={(value) => void updateAlarm(alarm.id, { runCodex: value })}
                      label="Codex"
                    />
                    <button
                      type="button"
                      onClick={() => void removeAlarm(alarm.id)}
                      className="rounded-full border border-rose-200 px-3 py-1 text-xs font-semibold text-rose-600 transition hover:bg-rose-50"
                    >
                      Delete
                    </button>
                  </div>
                </div>

                <div className="mt-3 text-xs text-zinc-500">
                  Last run: {alarm.lastTriggeredAt ? new Date(alarm.lastTriggeredAt).toLocaleString() : 'Never'}
                </div>
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  )
}
