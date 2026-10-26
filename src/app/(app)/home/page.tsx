import Link from 'next/link'
import { prisma } from '@/lib/prisma'

export const dynamic = 'force-dynamic'

function money(value: number) {
  return new Intl.NumberFormat('sk-SK', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 }).format(value)
}

function monthLabel(value: Date | null) {
  return value ? new Intl.DateTimeFormat('sk-SK', { month: 'long', year: 'numeric', timeZone: 'Europe/Bratislava' }).format(value) : 'bez dát'
}

function Card({ href, title, value, detail, tone = 'zinc' }: { href: string; title: string; value: string; detail: string; tone?: 'zinc' | 'rose' | 'emerald' | 'sky' }) {
  const colors = { zinc: 'from-zinc-500/10', rose: 'from-rose-500/15', emerald: 'from-emerald-500/15', sky: 'from-sky-500/15' }
  return <Link href={href} className={`rounded-2xl border border-zinc-200 bg-gradient-to-br ${colors[tone]} to-white p-5 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md dark:border-zinc-800 dark:to-zinc-950`}>
    <p className="text-xs font-semibold uppercase tracking-[0.18em] text-zinc-500">{title}</p>
    <p className="mt-3 text-2xl font-semibold tracking-tight">{value}</p>
    <p className="mt-2 text-sm text-zinc-600 dark:text-zinc-400">{detail}</p>
  </Link>
}

export default async function HomePage() {
  const now = new Date()
  const dayAgo = new Date(now.getTime() - 86_400_000)
  const [latestSnapshot, activeAccounts, liabilities, nextAlarms, errors, latestLogs] = await Promise.all([
    prisma.snapshot.findFirst({ orderBy: { month: 'desc' }, select: { month: true } }),
    prisma.account.count({ where: { isActive: true } }),
    prisma.liability.aggregate({ where: { isActive: true }, _sum: { remaining: true } }),
    prisma.aiAlarm.findMany({ where: { isEnabled: true }, orderBy: { time: 'asc' }, take: 3 }),
    prisma.appLog.count({ where: { level: 'error', createdAt: { gte: dayAgo } } }),
    prisma.appLog.findMany({ orderBy: { createdAt: 'desc' }, take: 4 }),
  ])
  const snapshotAge = latestSnapshot ? Math.round((now.getTime() - latestSnapshot.month.getTime()) / 2_592_000_000) : null
  const remaining = liabilities._sum.remaining?.toNumber() ?? 0

  return <div className="mx-auto max-w-7xl space-y-7">
    <div className="flex flex-wrap items-end justify-between gap-4">
      <div><p className="text-xs font-semibold uppercase tracking-[0.24em] text-zinc-500">Command center</p><h1 className="mt-1 text-3xl font-semibold tracking-tight">Prehľad aplikácie</h1><p className="mt-2 text-sm text-zinc-600 dark:text-zinc-400">Najdôležitejší stav na jednom mieste.</p></div>
      <div className="flex gap-2"><Link href="/finance/snapshots" className="rounded-xl bg-zinc-900 px-4 py-2 text-sm font-semibold text-white dark:bg-zinc-100 dark:text-zinc-900">Pridať snapshot</Link><Link href="/ai-runner" className="rounded-xl border border-zinc-300 px-4 py-2 text-sm font-semibold dark:border-zinc-700">Nový alarm</Link></div>
    </div>
    <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
      <Card href="/finance/snapshots" title="Finančné dáta" value={monthLabel(latestSnapshot?.month ?? null)} detail={`${activeAccounts} aktívnych účtov${snapshotAge !== null && snapshotAge > 1 ? ` · dáta sú ${snapshotAge} mes. staré` : ''}`} tone={snapshotAge !== null && snapshotAge > 1 ? 'rose' : 'emerald'} />
      <Card href="/finance/liabilities" title="Zostávajúce záväzky" value={money(remaining)} detail="Súčet aktívnych záväzkov" tone={remaining > 0 ? 'sky' : 'emerald'} />
      <Card href="/ai-runner" title="Aktívne alarmy" value={String(nextAlarms.length)} detail={nextAlarms[0] ? `Najbližší čas ${nextAlarms[0].time}` : 'Žiadny alarm nečaká'} />
      <Card href="/logs" title="Chyby za 24 hodín" value={String(errors)} detail={errors ? 'Vyžaduje kontrolu logov' : 'Systém bez nových chýb'} tone={errors ? 'rose' : 'emerald'} />
    </section>
    <div className="grid gap-6 lg:grid-cols-[1.2fr_.8fr]">
      <section className="rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm dark:border-zinc-800 dark:bg-zinc-950">
        <div className="flex items-center justify-between"><div><p className="text-xs font-semibold uppercase tracking-[0.18em] text-zinc-500">Pozornosť</p><h2 className="mt-1 text-xl font-semibold">Čo nasleduje</h2></div><Link href="/ai-runner" className="text-sm font-medium text-zinc-500 hover:text-zinc-900">Všetky alarmy →</Link></div>
        <div className="mt-4 divide-y divide-zinc-100 dark:divide-zinc-800">
          {nextAlarms.map((alarm) => <div key={alarm.id} className="flex items-center justify-between py-3"><div><p className="text-sm font-medium">{alarm.label || 'AI kontrola'}</p><p className="text-xs text-zinc-500">{alarm.isRepeat ? 'Opakovaný alarm' : alarm.date ? new Intl.DateTimeFormat('sk-SK').format(alarm.date) : 'Jednorazovo'}</p></div><span className="font-mono text-lg font-semibold">{alarm.time}</span></div>)}
          {nextAlarms.length === 0 ? <p className="py-8 text-center text-sm text-zinc-500">Žiadne aktívne alarmy.</p> : null}
        </div>
      </section>
      <section className="rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm dark:border-zinc-800 dark:bg-zinc-950">
        <div className="flex items-center justify-between"><h2 className="text-xl font-semibold">Posledné udalosti</h2><Link href="/logs" className="text-sm font-medium text-zinc-500 hover:text-zinc-900">Logy →</Link></div>
        <div className="mt-4 space-y-3">{latestLogs.map((log) => <div key={log.id} className="flex gap-3"><span className={`mt-1.5 size-2 shrink-0 rounded-full ${log.level === 'error' ? 'bg-rose-500' : log.level === 'warn' ? 'bg-amber-500' : 'bg-emerald-500'}`} /><div><p className="text-sm font-medium">{log.message}</p><p className="text-xs text-zinc-500">{log.source} · {new Intl.DateTimeFormat('sk-SK', { dateStyle: 'short', timeStyle: 'short', timeZone: 'Europe/Bratislava' }).format(log.createdAt)}</p></div></div>)}</div>
      </section>
    </div>
  </div>
}
