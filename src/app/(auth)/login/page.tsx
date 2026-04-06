import Link from 'next/link'
import { AuthError } from 'next-auth'
import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'
import { auth, signIn, signOut } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { consumeBackupCode, verifyTotpToken } from '@/lib/totp'
import type { SettingsData } from '@/types'

function getSingleValue(value?: string | string[]): string | undefined {
  if (Array.isArray(value)) {
    return value[0]
  }
  return value
}

function resolveCallbackUrl(input?: string): string {
  if (!input) return '/dashboard'
  if (!input.startsWith('/')) return '/dashboard'
  return input
}

async function passwordLoginAction(formData: FormData): Promise<void> {
  'use server'

  const password = String(formData.get('password') ?? '')
  const callbackUrl = resolveCallbackUrl(String(formData.get('callbackUrl') ?? '/dashboard'))

  if (!password.trim()) {
    redirect(`/login?error=missing_password&callbackUrl=${encodeURIComponent(callbackUrl)}`)
  }

  try {
    await signIn('credentials', {
      password,
      redirectTo: callbackUrl,
    })
  } catch (error) {
    if (error instanceof AuthError) {
      redirect(`/login?error=invalid_credentials&callbackUrl=${encodeURIComponent(callbackUrl)}`)
    }
    throw error
  }
}

async function verifyTotpAction(formData: FormData): Promise<void> {
  'use server'

  const session = await auth()
  if (!session) {
    redirect('/login')
  }

  if (!session.totpRequired) {
    redirect('/dashboard')
  }

  const code = String(formData.get('code') ?? '').trim()
  const callbackUrl = resolveCallbackUrl(String(formData.get('callbackUrl') ?? '/dashboard'))
  if (!code) {
    redirect(`/login?step=totp&error=missing_code&callbackUrl=${encodeURIComponent(callbackUrl)}`)
  }

  const settings = await prisma.settings.findUnique({ where: { id: 'singleton' } })
  const data = (settings?.data ?? {}) as SettingsData

  const secret = data.totp_secret
  const backupCodes = data.backup_codes ?? []

  let isValid = false
  let usedBackup = false
  let remainingBackupCodes = backupCodes

  if (secret) {
    isValid = verifyTotpToken(secret, code)
  }

  if (!isValid && backupCodes.length > 0) {
    const backupMatch = await consumeBackupCode(code, backupCodes)
    if (backupMatch.matched) {
      isValid = true
      usedBackup = true
      remainingBackupCodes = backupMatch.remainingHashes
    }
  }

  if (!isValid) {
    redirect(`/login?step=totp&error=invalid_code&callbackUrl=${encodeURIComponent(callbackUrl)}`)
  }

  if (usedBackup) {
    const updatedData: SettingsData = {
      ...data,
      backup_codes: remainingBackupCodes,
    }

    await prisma.settings.upsert({
      where: { id: 'singleton' },
      create: { id: 'singleton', data: updatedData as object },
      update: { data: updatedData as object },
    })
  }

  const cookieStore = await cookies()
  cookieStore.set('totp_verified', '1', {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    path: '/',
    maxAge: 60 * 60 * 24 * 30,
  })

  redirect(callbackUrl)
}

async function logoutAction(): Promise<void> {
  'use server'

  const cookieStore = await cookies()
  cookieStore.delete('totp_verified')
  await signOut({ redirectTo: '/login' })
}

type LoginPageProps = {
  searchParams?: Promise<Record<string, string | string[] | undefined>> | Record<string, string | string[] | undefined>
}

export default async function LoginPage({ searchParams }: LoginPageProps) {
  const resolvedSearchParams = searchParams ? await Promise.resolve(searchParams) : {}
  const callbackUrl = resolveCallbackUrl(getSingleValue(resolvedSearchParams.callbackUrl))
  const error = getSingleValue(resolvedSearchParams.error)
  const requestedStep = getSingleValue(resolvedSearchParams.step)

  const session = await auth()
  const cookieStore = await cookies()
  const totpVerified = cookieStore.get('totp_verified')?.value === '1'

  const needsTotp = Boolean(session?.totpRequired) && !totpVerified

  if (session && !needsTotp) {
    redirect('/dashboard')
  }

  const showTotpStep = needsTotp || requestedStep === 'totp'

  const errorLabel = (() => {
    if (error === 'missing_password') return 'Enter a password.'
    if (error === 'invalid_credentials') return 'Invalid password.'
    if (error === 'missing_code') return 'Enter the 6-digit TOTP code or a backup code.'
    if (error === 'invalid_code') return 'Invalid TOTP or backup code.'
    return null
  })()

  return (
    <main className="mx-auto flex min-h-screen w-full max-w-md flex-col justify-center px-6 py-10">
      <div className="rounded-2xl border border-zinc-200 bg-white p-6 shadow-sm">
        <h1 className="text-2xl font-semibold tracking-tight text-zinc-900">Financie</h1>
        <p className="mt-2 text-sm text-zinc-600">
          {showTotpStep ? 'Verify the second factor to complete sign in.' : 'Sign in with the admin password.'}
        </p>

        {errorLabel ? (
          <p className="mt-4 rounded-md border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700">{errorLabel}</p>
        ) : null}

        {showTotpStep ? (
          <form action={verifyTotpAction} className="mt-6 space-y-4">
            <input type="hidden" name="callbackUrl" value={callbackUrl} />

            <div className="space-y-2">
              <label htmlFor="code" className="block text-sm font-medium text-zinc-800">
                TOTP or backup code
              </label>
              <input
                id="code"
                name="code"
                required
                autoComplete="one-time-code"
                placeholder="123456 alebo ABCD-EFGH"
                className="w-full rounded-lg border border-zinc-300 px-3 py-2 text-zinc-900 outline-none ring-0 transition focus:border-zinc-500"
              />
            </div>

            <button
              type="submit"
              className="w-full rounded-lg bg-zinc-900 px-4 py-2 text-sm font-medium text-white transition hover:bg-zinc-700"
            >
              Verify code
            </button>
          </form>
        ) : (
          <form action={passwordLoginAction} className="mt-6 space-y-4">
            <input type="hidden" name="callbackUrl" value={callbackUrl} />
            <div className="space-y-2">
              <label htmlFor="password" className="block text-sm font-medium text-zinc-800">
                Password
              </label>
              <input
                id="password"
                name="password"
                type="password"
                required
                autoComplete="current-password"
                className="w-full rounded-lg border border-zinc-300 px-3 py-2 text-zinc-900 outline-none ring-0 transition focus:border-zinc-500"
              />
            </div>

            <button
              type="submit"
              className="w-full rounded-lg bg-zinc-900 px-4 py-2 text-sm font-medium text-white transition hover:bg-zinc-700"
            >
              Sign in
            </button>
          </form>
        )}

        {session ? (
          <form action={logoutAction} className="mt-4">
            <button type="submit" className="text-sm text-zinc-600 underline hover:text-zinc-800">
              Sign out
            </button>
          </form>
        ) : null}

        <div className="mt-6 border-t border-zinc-100 pt-4 text-xs text-zinc-500">
          Find 2FA setup after signing in under{' '}
          <Link href="/settings/totp" className="font-medium text-zinc-700 underline">
            Settings → TOTP
          </Link>
          .
        </div>
      </div>
    </main>
  )
}
