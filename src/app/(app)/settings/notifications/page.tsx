'use client'

import { useEffect, useState } from 'react'

function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4)
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/')
  const rawData = globalThis.atob(base64)
  const outputArray = new Uint8Array(rawData.length)

  for (let index = 0; index < rawData.length; ++index) {
    outputArray[index] = rawData.charCodeAt(index)
  }

  return outputArray
}

export default function NotificationsPage() {
  const [permission, setPermission] = useState<NotificationPermission>('default')
  const [subscribed, setSubscribed] = useState(false)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let mounted = true

    async function loadStatus() {
      if (!('Notification' in window) || !('serviceWorker' in navigator)) {
        if (mounted) {
          setPermission('denied')
          setSubscribed(false)
          setLoading(false)
        }
        return
      }

      const registration = await navigator.serviceWorker.ready
      const currentSubscription = await registration.pushManager.getSubscription()

      if (!mounted) return

      setPermission(Notification.permission)
      setSubscribed(Boolean(currentSubscription))
      setLoading(false)
    }

    void loadStatus().catch(() => {
      if (mounted) {
        setError('Failed to read the current notification status.')
        setLoading(false)
      }
    })

    return () => {
      mounted = false
    }
  }, [])

  async function enableNotifications() {
    setSaving(true)
    setError(null)
    setMessage(null)

    try {
      if (!('Notification' in window) || !('serviceWorker' in navigator)) {
        throw new Error('This browser does not support push notifications.')
      }

      const currentPermission = Notification.permission === 'default'
        ? await Notification.requestPermission()
        : Notification.permission

      setPermission(currentPermission)

      if (currentPermission !== 'granted') {
        throw new Error('Notifications must be allowed in the browser.')
      }

      const vapidKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY
      if (!vapidKey) {
        throw new Error('Missing public VAPID key.')
      }

      const registration = await navigator.serviceWorker.ready
      const subscription = await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(vapidKey) as BufferSource,
      })

      const response = await fetch('/api/push', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(subscription),
      })

      const data = (await response.json()) as { error?: string }
      if (!response.ok) {
        throw new Error(data.error ?? 'Failed to save the subscription.')
      }

      setSubscribed(true)
      setMessage('Push notifications are enabled.')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to enable notifications.')
    } finally {
      setSaving(false)
    }
  }

  async function disableNotifications() {
    setSaving(true)
    setError(null)
    setMessage(null)

    try {
      const registration = await navigator.serviceWorker.ready
      const currentSubscription = await registration.pushManager.getSubscription()
      await currentSubscription?.unsubscribe()

      const response = await fetch('/api/push', { method: 'DELETE' })
      const data = (await response.json()) as { error?: string }
      if (!response.ok) {
        throw new Error(data.error ?? 'Failed to remove the subscription.')
      }

      setSubscribed(false)
      setMessage('Push notifications are disabled.')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to disable notifications.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <section className="space-y-5">
      <header className="space-y-2">
        <h2 className="text-2xl font-semibold tracking-tight">Push notifications</h2>
        <p className="max-w-2xl text-sm text-zinc-600 dark:text-zinc-300">
          Turn on reminders for monthly finance entry and let the app notify you when the cron job runs.
        </p>
      </header>

      <div className="grid gap-4 lg:grid-cols-2">
        <article className="rounded-xl border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-900">
          <h3 className="text-sm font-semibold text-zinc-700 dark:text-zinc-200">Status</h3>
          <div className="mt-3 space-y-2 text-sm text-zinc-600 dark:text-zinc-300">
            <p>Browser permission: <span className="font-medium text-zinc-900 dark:text-zinc-100">{loading ? 'Loading…' : permission}</span></p>
            <p>Saved subscription: <span className="font-medium text-zinc-900 dark:text-zinc-100">{loading ? 'Loading…' : subscribed ? 'Yes' : 'No'}</span></p>
          </div>

          <div className="mt-4 flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => void enableNotifications()}
              disabled={saving || loading}
              className="rounded-lg bg-zinc-900 px-3 py-2 text-sm font-medium text-white transition hover:bg-zinc-700 disabled:cursor-not-allowed disabled:opacity-60 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-300"
            >
              {saving ? 'Saving…' : 'Enable notifications'}
            </button>
            <button
              type="button"
              onClick={() => void disableNotifications()}
              disabled={saving || loading || !subscribed}
              className="rounded-lg border border-zinc-300 px-3 py-2 text-sm font-medium text-zinc-700 transition hover:bg-zinc-100 disabled:cursor-not-allowed disabled:opacity-60 dark:border-zinc-700 dark:text-zinc-100 dark:hover:bg-zinc-800"
            >
              Disable notifications
            </button>
          </div>

          {message ? (
            <p className="mt-4 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-700 dark:border-emerald-900/60 dark:bg-emerald-950/40 dark:text-emerald-300">
              {message}
            </p>
          ) : null}

          {error ? (
            <p className="mt-4 rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700 dark:border-rose-900/60 dark:bg-rose-950/40 dark:text-rose-300">
              {error}
            </p>
          ) : null}
        </article>

        <article className="rounded-xl border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-900">
          <h3 className="text-sm font-semibold text-zinc-700 dark:text-zinc-200">How it works</h3>
          <ul className="mt-3 space-y-2 text-sm text-zinc-600 dark:text-zinc-300">
            <li>1. The browser asks for notification permission.</li>
            <li>2. Your subscription is stored in Settings via <code className="rounded bg-zinc-100 px-1 py-0.5 dark:bg-zinc-800">/api/push</code>.</li>
            <li>3. The cron job sends a reminder on the 2nd day of each month at 09:00.</li>
            <li>4. Tapping the notification opens the snapshots screen for the target month.</li>
          </ul>
        </article>
      </div>
    </section>
  )
}