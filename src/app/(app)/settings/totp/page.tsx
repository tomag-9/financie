import Image from 'next/image'
import { redirect } from 'next/navigation'
import QRCode from 'qrcode'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { createOtpAuthUrl, createTotpSecret, generateBackupCodes, verifyTotpToken } from '@/lib/totp'
import type { SettingsData } from '@/types'

function getSingleValue(value?: string | string[]): string | undefined {
  if (Array.isArray(value)) return value[0]
  return value
}

async function enableTotpAction(formData: FormData): Promise<void> {
  'use server'

  const session = await auth()
  if (!session) {
    redirect('/login')
  }

  const token = String(formData.get('token') ?? '').trim()
  if (!token) {
    redirect('/settings/totp?error=missing_token')
  }

  const settings = await prisma.settings.findUnique({ where: { id: 'singleton' } })
  const data = (settings?.data ?? {}) as SettingsData

  const secret = data.totp_secret
  if (!secret) {
    redirect('/settings/totp?error=missing_secret')
  }

  const isValid = verifyTotpToken(secret, token)
  if (!isValid) {
    redirect('/settings/totp?error=invalid_token')
  }

  const { plainCodes, hashedCodes } = await generateBackupCodes()
  const updatedData: SettingsData = {
    ...data,
    totp_enabled: true,
    backup_codes: hashedCodes,
  }

  await prisma.settings.upsert({
    where: { id: 'singleton' },
    create: { id: 'singleton', data: updatedData as object },
    update: { data: updatedData as object },
  })

  redirect(`/settings/totp?enabled=1&codes=${encodeURIComponent(plainCodes.join(','))}`)
}

async function disableTotpAction(): Promise<void> {
  'use server'

  const session = await auth()
  if (!session) {
    redirect('/login')
  }

  const settings = await prisma.settings.findUnique({ where: { id: 'singleton' } })
  const data = (settings?.data ?? {}) as SettingsData

  const updatedData: SettingsData = {
    ...data,
    totp_enabled: false,
    backup_codes: [],
  }

  await prisma.settings.upsert({
    where: { id: 'singleton' },
    create: { id: 'singleton', data: updatedData as object },
    update: { data: updatedData as object },
  })

  redirect('/settings/totp?disabled=1')
}

type TotpSettingsPageProps = {
  searchParams?: Promise<Record<string, string | string[] | undefined>> | Record<string, string | string[] | undefined>
}

export default async function TotpSettingsPage({ searchParams }: TotpSettingsPageProps) {
  const session = await auth()
  if (!session) {
    redirect('/login')
  }

  const resolvedSearchParams = searchParams ? await Promise.resolve(searchParams) : {}
  const enabled = getSingleValue(resolvedSearchParams.enabled) === '1'
  const disabled = getSingleValue(resolvedSearchParams.disabled) === '1'
  const error = getSingleValue(resolvedSearchParams.error)
  const codesParam = getSingleValue(resolvedSearchParams.codes)

  const settings = await prisma.settings.findUnique({ where: { id: 'singleton' } })
  const data = (settings?.data ?? {}) as SettingsData

  let secret = data.totp_secret
  if (!secret) {
    secret = createTotpSecret()
    const updatedData: SettingsData = {
      ...data,
      totp_secret: secret,
      totp_enabled: false,
      backup_codes: data.backup_codes ?? [],
    }

    await prisma.settings.upsert({
      where: { id: 'singleton' },
      create: { id: 'singleton', data: updatedData as object },
      update: { data: updatedData as object },
    })
  }

  const otpauthUrl = createOtpAuthUrl('Tomi', secret)
  const qrCodeDataUrl = await QRCode.toDataURL(otpauthUrl)

  const backupCodes = codesParam ? decodeURIComponent(codesParam).split(',').filter(Boolean) : []
  const isTotpEnabled = data.totp_enabled === true

  const errorLabel = (() => {
    if (error === 'missing_token') return 'Zadaj 6-miestny kód z authenticator appky.'
    if (error === 'invalid_token') return 'Kód sa nepodarilo overiť. Skús znova.'
    if (error === 'missing_secret') return 'Chýba TOTP secret. Obnov stránku a skús znova.'
    return null
  })()

  return (
    <section className="mx-auto max-w-3xl space-y-6">
      <div>
        <h2 className="text-2xl font-semibold tracking-tight">TOTP (2FA)</h2>
        <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-300">
          Prihlásenie bude vyžadovať heslo + jednorazový kód z authenticator appky.
        </p>
      </div>

      {enabled ? (
        <p className="rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-700">
          TOTP bolo úspešne zapnuté.
        </p>
      ) : null}

      {disabled ? (
        <p className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-700">
          TOTP bolo vypnuté.
        </p>
      ) : null}

      {errorLabel ? (
        <p className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700">{errorLabel}</p>
      ) : null}

      <div className="grid gap-6 rounded-xl border border-zinc-200 bg-white p-5 dark:border-zinc-800 dark:bg-zinc-900 md:grid-cols-[220px_1fr]">
        <div className="rounded-lg border border-zinc-200 bg-zinc-50 p-3 dark:border-zinc-700 dark:bg-zinc-800">
          <Image src={qrCodeDataUrl} alt="TOTP QR code" width={192} height={192} className="h-auto w-full" />
        </div>

        <div className="space-y-4">
          <div>
            <h3 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">1. Naskenuj QR kód</h3>
            <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-300">Google Authenticator, 2FAS alebo iná TOTP appka.</p>
          </div>

          <div>
            <h3 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">2. Over kód</h3>
            <form action={enableTotpAction} className="mt-2 flex flex-wrap items-center gap-2">
              <input
                name="token"
                maxLength={6}
                placeholder="123456"
                className="w-32 rounded-lg border border-zinc-300 px-3 py-2 text-sm text-zinc-900 outline-none focus:border-zinc-500"
              />
              <button
                type="submit"
                disabled={isTotpEnabled}
                className="rounded-lg bg-zinc-900 px-3 py-2 text-sm font-medium text-white transition hover:bg-zinc-700 disabled:cursor-not-allowed disabled:opacity-50 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-300"
              >
                {isTotpEnabled ? 'TOTP je zapnuté' : 'Zapnúť TOTP'}
              </button>
            </form>
          </div>

          <div className="rounded-lg border border-zinc-200 bg-zinc-50 p-3 text-xs text-zinc-600 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-300">
            Secret: <span className="font-mono text-zinc-800 dark:text-zinc-100">{secret}</span>
          </div>

          {isTotpEnabled ? (
            <form action={disableTotpAction}>
              <button
                type="submit"
                className="rounded-lg border border-rose-300 px-3 py-2 text-sm font-medium text-rose-700 hover:bg-rose-50"
              >
                Vypnúť TOTP
              </button>
            </form>
          ) : null}
        </div>
      </div>

      {backupCodes.length > 0 ? (
        <div className="rounded-xl border border-amber-300 bg-amber-50 p-4">
          <h3 className="text-sm font-semibold text-amber-900">Backup kódy (ulož si ich teraz)</h3>
          <p className="mt-1 text-xs text-amber-800">Každý kód je jednorazový. Neskôr ich už nie je možné zobraziť.</p>
          <ul className="mt-3 grid gap-2 sm:grid-cols-2">
            {backupCodes.map((code) => (
              <li key={code} className="rounded border border-amber-300 bg-white px-3 py-2 font-mono text-sm text-amber-900">
                {code}
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </section>
  )
}
