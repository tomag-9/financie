import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'
import { auth, signOut } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { AppNav } from '@/components/ui/nav'

function IconLogout() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" className="size-5 fill-none stroke-current stroke-[2.25]">
      <path d="M16 17l5-5-5-5M21 12H9m6 7v2a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h8a2 2 0 0 1 2 2v2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

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
        <header className="sticky top-0 z-30 border-b border-zinc-200 bg-white/90 px-4 py-3 backdrop-blur dark:border-zinc-800 dark:bg-zinc-950/90 md:px-6">
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="text-xs uppercase tracking-[0.18em] text-zinc-500 dark:text-zinc-400">Financie</p>
              <h1 className="text-base font-semibold text-zinc-900 dark:text-zinc-100">Personal finance</h1>
            </div>

            <div className="flex items-center gap-2">
              <div className="hidden sm:block">
                <button
                  type="button"
                  aria-label="Account menu"
                  className="inline-flex items-center gap-2 rounded-full border border-zinc-200 bg-zinc-100 px-3 py-2 text-xs font-medium text-zinc-600 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-300"
                >
                  <span className="size-2 rounded-full bg-emerald-500" aria-hidden="true" />
                  Single-user mode
                </button>
              </div>

              <form action={logoutAction}>
                <button
                  type="submit"
                  aria-label="Sign out"
                  className="inline-flex items-center gap-2 rounded-lg border border-rose-300 bg-rose-50 px-3 py-2 text-sm font-medium text-rose-700 transition hover:bg-rose-100 dark:border-rose-900/60 dark:bg-rose-950/30 dark:text-rose-300"
                >
                  <IconLogout />
                  <span>Logout</span>
                </button>
              </form>
            </div>
          </div>
        </header>

        <main className="flex-1 px-4 py-5 md:px-6">{children}</main>
      </div>
    </div>
  )
}
