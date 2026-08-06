import { NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { getContainers, ProxmoxConfigurationError } from '@/lib/proxmox'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function GET() {
  const session = await auth()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  try {
    const containers = await getContainers()
    return NextResponse.json({ containers }, { headers: { 'Cache-Control': 'no-store' } })
  } catch (error) {
    const isConfigurationError = error instanceof ProxmoxConfigurationError
    console.error('[proxmox] Failed to load containers:', error)
    return NextResponse.json(
      {
        error: isConfigurationError
          ? error.message
          : 'Nepodarilo sa spojiť s Proxmoxom. Skontroluj sieť, certifikát a API token.',
      },
      { status: isConfigurationError ? 503 : 502 },
    )
  }
}
