import { ProxmoxPanel } from '@/components/proxmox/ProxmoxPanel'

export default function ProxmoxPage() {
  return (
    <section className="mx-auto max-w-5xl space-y-5">
      <div className="space-y-1">
        <p className="text-xs font-semibold uppercase tracking-[0.22em] text-zinc-500 dark:text-zinc-400">Lokálna infraštruktúra</p>
        <h2 className="text-2xl font-semibold tracking-tight">Proxmox kontajnery</h2>
        <p className="text-sm text-zinc-600 dark:text-zinc-300">
          Stav a základné ovládanie povolených LXC kontajnerov. Zastavenie je okamžité, preto každú akciu treba potvrdiť.
        </p>
      </div>
      <ProxmoxPanel />
    </section>
  )
}
