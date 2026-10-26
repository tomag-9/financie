import { closeSync, existsSync, mkdirSync, openSync } from 'node:fs'
import { dirname, resolve } from 'node:path'

const databaseUrl = process.env.DATABASE_URL
if (databaseUrl?.startsWith('file:')) {
  const rawPath = databaseUrl.slice('file:'.length).split('?')[0]
  const databasePath = rawPath.startsWith('/') ? rawPath : resolve('prisma', rawPath)
  mkdirSync(dirname(databasePath), { recursive: true })
  if (!existsSync(databasePath)) closeSync(openSync(databasePath, 'wx', 0o600))
}
