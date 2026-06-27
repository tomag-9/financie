import { redirect } from 'next/navigation'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import Link from 'next/link'
import { AppNav } from '@/components/ui/nav'
import { BrandMark } from '@/components/ui/brand-mark'

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  let session = null
  try {
    session = await auth()
  } catch {
    session = null
  }
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
            <div className="flex items-center gap-3">
              <Link href="/home" aria-label="Go to home" className="inline-flex rounded-xl outline-none transition focus-visible:ring-2 focus-visible:ring-zinc-400 focus-visible:ring-offset-2 focus-visible:ring-offset-white dark:focus-visible:ring-offset-zinc-950">
                <BrandMark />
              </Link>
            </div>
          </div>
        </header>

        <main className="flex-1 px-4 py-5 md:px-6">{children}</main>
      </div>
    </div>
  )
}
