import Link from 'next/link'

type HubCard = {
  href: string
  title: string
  description: string
  accent: string
  iconPath: string
}

const hubCards: HubCard[] = [
  {
    href: '/ai-runner',
    title: 'AI runner',
    description: 'Spusti a spravuj Claude alebo Codex alarmy.',
    accent: 'from-emerald-500/20 via-emerald-500/10 to-transparent dark:from-emerald-400/20',
    iconPath: 'M12 2l7 4v6c0 5-3.5 9.7-7 10-3.5-.3-7-5-7-10V6l7-4Zm0 5a3 3 0 0 0-3 3v1H8v6h8v-6h-1v-1a3 3 0 0 0-3-3Zm0 2a1 1 0 0 1 1 1v1h-2v-1a1 1 0 0 1 1-1Z',
  },
  {
    href: '/finance/dashboard',
    title: 'Financie',
    description: 'Finančný dashboard so snapshotmi a trendami.',
    accent: 'from-sky-500/20 via-sky-500/10 to-transparent dark:from-sky-400/20',
    iconPath: 'M4 6a2 2 0 0 1 2-2h4l2 2h6a2 2 0 0 1 2 2v10a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6Zm4 6 2.5 2.5L15 6l3 3',
  },
  {
    href: '/logs',
    title: 'Logs',
    description: 'Prezeraj AI runner logy so sortovaním a filtrami.',
    accent: 'from-amber-500/20 via-amber-500/10 to-transparent dark:from-amber-400/20',
    iconPath: 'M7 4h10l3 4v12H4V4h3Zm0 0v4h10V4M8 12h8M8 16h5',
  },
  {
    href: '/settings',
    title: 'Settings',
    description: 'Notifikácie, TOTP a systémové nastavenia.',
    accent: 'from-zinc-500/20 via-zinc-500/10 to-transparent dark:from-zinc-400/20',
    iconPath: 'M12 8a4 4 0 1 0 0 8 4 4 0 0 0 0-8Zm8 4-2.2.7a6.8 6.8 0 0 1-.4 1l1.3 1.9-1.9 1.9-1.9-1.3a6.8 6.8 0 0 1-1 .4L12 20l-2.7-2.2a6.8 6.8 0 0 1-1-.4l-1.9 1.3-1.9-1.9 1.3-1.9a6.8 6.8 0 0 1-.4-1L4 12l2.2-.7a6.8 6.8 0 0 1 .4-1L5.3 8.4l1.9-1.9 1.9 1.3a6.8 6.8 0 0 1 1-.4L12 4l2.7 2.2a6.8 6.8 0 0 1 1 .4l1.9-1.3 1.9 1.9-1.3 1.9c.17.33.3.67.4 1L20 12Z',
  },
]

function Icon({ path }: { path: string }) {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" className="size-6 fill-none stroke-current stroke-[2.25]">
      <path d={path} strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

function ArrowIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" className="size-5 fill-none stroke-current stroke-[2.25]">
      <path d="M5 12h14m-6-6 6 6-6 6" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

export default function HomePage() {
  return (
    <section className="relative overflow-hidden rounded-[2rem] border border-zinc-200 bg-white p-4 shadow-sm dark:border-zinc-800 dark:bg-zinc-950 sm:p-6">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top_left,rgba(56,189,248,0.12),transparent_34%),radial-gradient(circle_at_top_right,rgba(16,185,129,0.12),transparent_28%),radial-gradient(circle_at_bottom,rgba(63,63,70,0.08),transparent_32%)] dark:bg-[radial-gradient(circle_at_top_left,rgba(56,189,248,0.10),transparent_34%),radial-gradient(circle_at_top_right,rgba(16,185,129,0.10),transparent_28%),radial-gradient(circle_at_bottom,rgba(63,63,70,0.10),transparent_32%)]" />

      <div className="relative space-y-2">
        <p className="text-xs font-semibold uppercase tracking-[0.24em] text-zinc-500 dark:text-zinc-400">Start</p>
        <h2 className="text-2xl font-semibold tracking-tight text-zinc-900 dark:text-zinc-100 sm:text-3xl">Vyber si sekciu</h2>
        <p className="max-w-2xl text-sm text-zinc-600 dark:text-zinc-300">
          Po prihlásení je tu len rýchly výber. Otvor AI runner, financie, logs alebo settings bez zbytočných grafov a šumu.
        </p>
      </div>

      <div className="relative mt-6 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        {hubCards.map((card) => (
          <Link
            key={card.href}
            href={card.href}
            className="group relative overflow-hidden rounded-3xl border border-zinc-200 bg-zinc-50 p-5 transition duration-200 hover:-translate-y-1 hover:border-zinc-300 hover:shadow-lg dark:border-zinc-800 dark:bg-zinc-900/70 dark:hover:border-zinc-700"
          >
            <div className={`absolute inset-0 bg-gradient-to-br ${card.accent}`} aria-hidden="true" />
            <div className="relative flex h-full flex-col justify-between gap-6">
              <div className="flex items-start justify-between gap-3">
                <div className="rounded-2xl border border-white/70 bg-white/80 p-3 text-zinc-900 shadow-sm backdrop-blur dark:border-zinc-700 dark:bg-zinc-950/80 dark:text-zinc-100">
                  <Icon path={card.iconPath} />
                </div>
                <span className="inline-flex items-center gap-1 rounded-full border border-zinc-200 bg-white/80 px-2.5 py-1 text-[11px] font-semibold uppercase tracking-[0.18em] text-zinc-500 backdrop-blur dark:border-zinc-700 dark:bg-zinc-950/80 dark:text-zinc-400">
                  Open
                  <ArrowIcon />
                </span>
              </div>

              <div className="space-y-2">
                <h3 className="text-xl font-semibold tracking-tight text-zinc-900 dark:text-zinc-100">{card.title}</h3>
                <p className="text-sm leading-6 text-zinc-600 dark:text-zinc-300">{card.description}</p>
              </div>
            </div>
          </Link>
        ))}
      </div>
    </section>
  )
}