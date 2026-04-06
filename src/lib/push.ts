import webpush from 'web-push'
import { prisma } from '@/lib/prisma'
import type { PushSubscriptionData, SettingsData } from '@/types'

function toRecord(value: unknown): Record<string, unknown> {
  if (typeof value === 'object' && value !== null && !Array.isArray(value)) {
    return value as Record<string, unknown>
  }
  return {}
}

function readSubscription(data: SettingsData): PushSubscriptionData | null {
  const candidate = data.push_subscription ?? data.pushSubscription
  if (!candidate) return null
  const record = toRecord(candidate)
  const keys = toRecord(record.keys)

  const endpoint = typeof record.endpoint === 'string' ? record.endpoint : ''
  const p256dh = typeof keys.p256dh === 'string' ? keys.p256dh : ''
  const auth = typeof keys.auth === 'string' ? keys.auth : ''

  if (!endpoint || !p256dh || !auth) return null
  return {
    endpoint,
    keys: {
      p256dh,
      auth,
    },
  }
}

function ensureWebPushConfig(): boolean {
  const publicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY
  const privateKey = process.env.VAPID_PRIVATE_KEY
  const email = process.env.VAPID_EMAIL

  if (!publicKey || !privateKey || !email) return false

  webpush.setVapidDetails(email, publicKey, privateKey)
  return true
}

export async function getSettingsData(): Promise<SettingsData> {
  const settings = await prisma.settings.findUnique({
    where: { id: 'singleton' },
    select: { data: true },
  })

  return toRecord(settings?.data) as SettingsData
}

export async function savePushSubscription(subscription: PushSubscriptionData | null): Promise<void> {
  const settings = await getSettingsData()
  const nextData: SettingsData = {
    ...settings,
    push_subscription: subscription ?? undefined,
  }

  await prisma.settings.upsert({
    where: { id: 'singleton' },
    update: { data: nextData as object },
    create: { id: 'singleton', data: nextData as object },
  })
}

export async function sendPushNotification(payload: { title: string; body: string; url?: string }): Promise<boolean> {
  const configured = ensureWebPushConfig()
  if (!configured) return false

  const settings = await getSettingsData()
  const subscription = readSubscription(settings)
  if (!subscription) return false

  try {
    await webpush.sendNotification(
      subscription as webpush.PushSubscription,
      JSON.stringify({
        title: payload.title,
        body: payload.body,
        url: payload.url ?? '/snapshots',
      }),
    )

    return true
  } catch {
    return false
  }
}
