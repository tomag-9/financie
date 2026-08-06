import { NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { getAllowedContainerIds, ProxmoxConfigurationError, runContainerAction, type ProxmoxAction } from '@/lib/proxmox'

export const runtime = 'nodejs'

const ACTIONS = new Set<ProxmoxAction>(['start', 'stop', 'reboot'])

export async function POST(request: Request, context: { params: Promise<{ vmid: string }> }) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const fetchSite = request.headers.get('sec-fetch-site')
  if (fetchSite === 'cross-site') {
    return NextResponse.json({ error: 'Cross-site request blocked.' }, { status: 403 })
  }

  const { vmid: rawVmid } = await context.params
  const vmid = Number(rawVmid)
  let payload: unknown
  try {
    payload = await request.json()
  } catch {
    return NextResponse.json({ error: 'Neplatné dáta požiadavky.' }, { status: 400 })
  }

  const action = (payload as { action?: unknown } | null)?.action
  if (!Number.isSafeInteger(vmid) || typeof action !== 'string' || !ACTIONS.has(action as ProxmoxAction)) {
    return NextResponse.json({ error: 'Neplatný kontajner alebo akcia.' }, { status: 400 })
  }

  try {
    if (!getAllowedContainerIds().includes(vmid)) {
      return NextResponse.json({ error: 'Tento kontajner nie je povolený na ovládanie.' }, { status: 403 })
    }

    const taskId = await runContainerAction(vmid, action as ProxmoxAction)
    return NextResponse.json({ ok: true, taskId }, { status: 202 })
  } catch (error) {
    const isConfigurationError = error instanceof ProxmoxConfigurationError
    console.error(`[proxmox] Failed to ${action} CT ${vmid}:`, error)
    return NextResponse.json(
      { error: isConfigurationError ? error.message : `Akciu ${action} sa nepodarilo spustiť.` },
      { status: isConfigurationError ? 503 : 502 },
    )
  }
}
