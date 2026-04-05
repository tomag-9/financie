import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'
import { auth, signOut } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { AppNav } from '@/components/ui/nav'

async function logoutAction(): Promise<void> {
  'use server'

  const cookieStore = await cookies()
  cookieStore.delete('totp_verified')
  await signOut({ redirectTo: '/login' })
}

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const session = await auth()
  if (!session) {
    redirect('/login')
  }

  const latestJojWithDiff = await prisma.jojDetail.findFirst({
    where: { diff: { not: null } },
    orderBy: { month: 'desc' },
    select: { diff: true },
  })

  const latestDiff = latestJojWithDiff?.diff
  const hasJojAlert = latestDiff ? Math.abs(latestDiff.toNumber()) > 5 : false

  return (
    <div className="flex min-h-screen bg-zinc-50 text-zinc-900 dark:bg-zinc-950 dark:text-zinc-100">
      <AppNav hasJojAlert={hasJojAlert} />

      <div className="flex min-h-screen flex-1 flex-col pb-16 md:pb-0">
        <header className="sticky top-0 z-30 flex items-center justify-between border-b border-zinc-200 bg-white/90 px-4 py-3 backdrop-blur dark:border-zinc-800 dark:bg-zinc-950/90 md:px-6">
          <div>
            <p className="text-sm text-zinc-500 dark:text-zinc-400">Prihlásený používateľ</p>
            <h1 className="text-base font-semibold text-zinc-900 dark:text-zinc-100">{session.user?.name ?? 'Tomi'}</h1>
          </div>

          <form action={logoutAction}>
            <button
              type="submit"
              className="rounded-lg border border-zinc-300 px-3 py-1.5 text-sm font-medium text-zinc-700 transition hover:bg-zinc-100 dark:border-zinc-700 dark:text-zinc-200 dark:hover:bg-zinc-800"
            >
              Odhlásiť
            </button>
          </form>
        </header>

        <main className="flex-1 px-4 py-5 md:px-6">{children}</main>
      </div>
    </div>
  )
}
