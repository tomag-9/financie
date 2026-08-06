import { request as httpRequest } from 'node:http'
import { request as httpsRequest } from 'node:https'

export type ProxmoxAction = 'start' | 'stop' | 'reboot'

export type ProxmoxContainer = {
  vmid: number
  name: string
  status: string
  uptime: number
  cpu: number
  memory: number
  maxMemory: number
}

type ProxmoxConfig = {
  baseUrl: URL
  node: string
  tokenId: string
  tokenSecret: string
  rejectUnauthorized: boolean
  allowedContainers: number[]
}

type ProxmoxResponse<T> = {
  data: T
}

export class ProxmoxConfigurationError extends Error {}

function requiredEnvironmentValue(name: string): string {
  const value = process.env[name]?.trim()
  if (!value) throw new ProxmoxConfigurationError(`Chýba nastavenie ${name}.`)
  return value
}

function getConfig(): ProxmoxConfig {
  const rawBaseUrl = requiredEnvironmentValue('PROXMOX_URL')
  const baseUrl = new URL(rawBaseUrl.endsWith('/') ? rawBaseUrl : `${rawBaseUrl}/`)
  if (baseUrl.protocol !== 'https:' && baseUrl.protocol !== 'http:') {
    throw new ProxmoxConfigurationError('PROXMOX_URL musí používať http alebo https.')
  }

  const allowedContainers = (process.env.PROXMOX_ALLOWED_CTS ?? '101,103')
    .split(',')
    .map((value) => Number(value.trim()))
    .filter((value) => Number.isSafeInteger(value) && value > 0)

  if (allowedContainers.length === 0) {
    throw new ProxmoxConfigurationError('PROXMOX_ALLOWED_CTS neobsahuje žiadne platné CT ID.')
  }

  return {
    baseUrl,
    node: requiredEnvironmentValue('PROXMOX_NODE'),
    tokenId: requiredEnvironmentValue('PROXMOX_TOKEN_ID'),
    tokenSecret: requiredEnvironmentValue('PROXMOX_TOKEN_SECRET'),
    rejectUnauthorized: process.env.PROXMOX_TLS_REJECT_UNAUTHORIZED !== 'false',
    allowedContainers: Array.from(new Set(allowedContainers)),
  }
}

function proxmoxRequest<T>(config: ProxmoxConfig, path: string, method: 'GET' | 'POST'): Promise<T> {
  const url = new URL(`api2/json/${path.replace(/^\/+/, '')}`, config.baseUrl)
  const request = url.protocol === 'https:' ? httpsRequest : httpRequest

  return new Promise((resolve, reject) => {
    const req = request(
      url,
      {
        method,
        headers: {
          Authorization: `PVEAPIToken=${config.tokenId}=${config.tokenSecret}`,
          Accept: 'application/json',
          'Content-Length': '0',
        },
        timeout: 8_000,
        ...(url.protocol === 'https:' ? { rejectUnauthorized: config.rejectUnauthorized } : {}),
      },
      (response) => {
        const chunks: Buffer[] = []
        response.on('data', (chunk: Buffer) => chunks.push(chunk))
        response.on('end', () => {
          const body = Buffer.concat(chunks).toString('utf8')
          if (!response.statusCode || response.statusCode < 200 || response.statusCode >= 300) {
            reject(new Error(`Proxmox API odpovedalo HTTP ${response.statusCode ?? 'error'}.`))
            return
          }

          try {
            const parsed = JSON.parse(body) as ProxmoxResponse<T>
            resolve(parsed.data)
          } catch {
            reject(new Error('Proxmox API vrátilo neplatnú odpoveď.'))
          }
        })
      },
    )

    req.on('timeout', () => req.destroy(new Error('Proxmox API neodpovedalo včas.')))
    req.on('error', reject)
    req.end()
  })
}

function containerPath(config: ProxmoxConfig, vmid: number): string {
  return `nodes/${encodeURIComponent(config.node)}/lxc/${vmid}`
}

export function getAllowedContainerIds(): number[] {
  return getConfig().allowedContainers
}

export async function getContainers(): Promise<ProxmoxContainer[]> {
  const config = getConfig()

  return Promise.all(
    config.allowedContainers.map(async (vmid) => {
      const data = await proxmoxRequest<Record<string, unknown>>(
        config,
        `${containerPath(config, vmid)}/status/current`,
        'GET',
      )

      return {
        vmid,
        name: typeof data.name === 'string' && data.name ? data.name : `CT ${vmid}`,
        status: typeof data.status === 'string' ? data.status : 'unknown',
        uptime: typeof data.uptime === 'number' ? data.uptime : 0,
        cpu: typeof data.cpu === 'number' ? data.cpu : 0,
        memory: typeof data.mem === 'number' ? data.mem : 0,
        maxMemory: typeof data.maxmem === 'number' ? data.maxmem : 0,
      }
    }),
  )
}

export async function runContainerAction(vmid: number, action: ProxmoxAction): Promise<string | null> {
  const config = getConfig()
  if (!config.allowedContainers.includes(vmid)) {
    throw new Error('Tento kontajner nie je povolený na ovládanie.')
  }

  const taskId = await proxmoxRequest<unknown>(
    config,
    `${containerPath(config, vmid)}/status/${action}`,
    'POST',
  )

  return typeof taskId === 'string' ? taskId : null
}
