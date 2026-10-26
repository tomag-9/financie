import { closeSync, existsSync, mkdirSync, openSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { spawnSync } from 'node:child_process'

const databaseUrl = process.env.DATABASE_URL ?? 'file:./financie.db'
process.env.DATABASE_URL = databaseUrl
if (databaseUrl?.startsWith('file:')) {
  const rawPath = databaseUrl.slice('file:'.length).split('?')[0]
  const databasePath = rawPath.startsWith('/') ? rawPath : resolve('prisma', rawPath)
  mkdirSync(dirname(databasePath), { recursive: true })
  if (!existsSync(databasePath)) closeSync(openSync(databasePath, 'wx', 0o600))
}

const command = process.platform === 'win32' ? 'npx.cmd' : 'npx'
const result = spawnSync(command, ['prisma', 'migrate', 'deploy'], {
  stdio: 'inherit',
  env: process.env,
})
if (result.error) throw result.error
process.exit(result.status ?? 1)
