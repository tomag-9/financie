// prisma/seed.ts
// Spusti: npx prisma db seed
// Pridá predvolené účty, income sources a historické JOJ dáta

import { createDecipheriv, scryptSync } from 'crypto'
import { readFileSync } from 'fs'
import { resolve } from 'path'
import { PrismaClient } from '@prisma/client'
import bcrypt from 'bcryptjs'

const prisma = new PrismaClient()

const MAGIC = Buffer.from('FINSEED1')
const SALT_LENGTH = 16
const IV_LENGTH = 12
const TAG_LENGTH = 16
const KEY_LENGTH = 32

const ACCOUNT_TYPES = {
  BANK: 'BANK',
  INVESTMENT: 'INVESTMENT',
  CASH: 'CASH',
  PENSION: 'PENSION',
} as const

type SeedPayload = {
  accounts: Array<{
    id: string
    name: string
    type: keyof typeof ACCOUNT_TYPES
    sortOrder: number
  }>
  incomeSources: Array<{
    id: string
    name: string
    color: string
  }>
  jojHistory: Array<[
    number,
    number,
    number,
    number,
    number,
    number,
    number,
  ]>
  snapshots: Array<[
    string,
    Record<string, number>
  ]>
  income2026: Array<[
    string,
    string,
    number,
  ]>
}

function getSeedDecodePassword(): string {
  const password = process.env.SEED_DATA_DECODE_PASSWORD?.trim() || process.env.SEED_DATA_PASSWORD?.trim()
  if (!password) {
    throw new Error('SEED_DATA_DECODE_PASSWORD or SEED_DATA_PASSWORD is not set.')
  }

  return password
}

function decryptSeedBuffer(encrypted: Buffer, password: string): Buffer {
  if (encrypted.length < MAGIC.length + SALT_LENGTH + IV_LENGTH + TAG_LENGTH) {
    throw new Error('Encrypted seed file is too short.')
  }

  const magic = encrypted.subarray(0, MAGIC.length)
  if (!magic.equals(MAGIC)) {
    throw new Error('Invalid seed file format.')
  }

  const saltStart = MAGIC.length
  const ivStart = saltStart + SALT_LENGTH
  const tagStart = ivStart + IV_LENGTH
  const dataStart = tagStart + TAG_LENGTH

  const salt = encrypted.subarray(saltStart, ivStart)
  const iv = encrypted.subarray(ivStart, tagStart)
  const tag = encrypted.subarray(tagStart, dataStart)
  const ciphertext = encrypted.subarray(dataStart)

  const key = scryptSync(password, salt, KEY_LENGTH)
  const decipher = createDecipheriv('aes-256-gcm', key, iv)
  decipher.setAuthTag(tag)

  return Buffer.concat([decipher.update(ciphertext), decipher.final()])
}

function loadSeedPayload(): SeedPayload {
  const payloadPath = resolve(process.cwd(), 'prisma/seed-data/seed-data.json.enc')
  const encrypted = readFileSync(payloadPath)
  const password = getSeedDecodePassword()
  const decrypted = decryptSeedBuffer(encrypted, password)
  return JSON.parse(decrypted.toString('utf8')) as SeedPayload
}

async function main() {
  console.log('🌱 Seeding database...')

  const seedPayload = loadSeedPayload()

  // ─── Settings (heslo z ENV) ──────────────────────────────────────────────
  const adminPassword = process.env.ADMIN_PASSWORD
  if (!adminPassword) throw new Error('ADMIN_PASSWORD nie je nastavené v .env')

  const passwordHash = await bcrypt.hash(adminPassword, 12)
  const existingSettings = await prisma.settings.findUnique({
    where: { id: 'singleton' },
    select: { data: true },
  })
  const existingData =
    existingSettings?.data && typeof existingSettings.data === 'object' && !Array.isArray(existingSettings.data)
      ? (existingSettings.data as Record<string, unknown>)
      : {}

  const nextData = {
    ...existingData,
    password_hash: passwordHash,
    totp_secret: existingData.totp_secret ?? null,
    totp_enabled: existingData.totp_enabled ?? false,
    backup_codes: Array.isArray(existingData.backup_codes) ? existingData.backup_codes : [],
    push_subscription: existingData.push_subscription ?? null,
    savings_goal_pct:
      typeof existingData.savings_goal_pct === 'number' ? existingData.savings_goal_pct : 20,
  }

  await prisma.settings.upsert({
    where: { id: 'singleton' },
    update: {
      data: nextData,
    },
    create: {
      id: 'singleton',
      data: nextData,
    },
  })
  console.log('✓ Settings created')

  // ─── Účty ────────────────────────────────────────────────────────────────
  for (const acc of seedPayload.accounts) {
    await prisma.account.upsert({
      where: { id: acc.id },
      update: {
        name: acc.name,
        type: ACCOUNT_TYPES[acc.type],
        sortOrder: acc.sortOrder,
        isActive: true,
      },
      create: {
        id: acc.id,
        name: acc.name,
        type: ACCOUNT_TYPES[acc.type],
        sortOrder: acc.sortOrder,
      },
    })
  }
  console.log('✓ Accounts created')

  // ─── Income sources ───────────────────────────────────────────────────────
  for (const src of seedPayload.incomeSources) {
    await prisma.incomeSource.upsert({
      where: { id: src.id },
      update: {
        name: src.name,
        color: src.color,
        isActive: true,
      },
      create: src,
    })
  }
  console.log('✓ Income sources created')

  // ─── Historické JOJ dáta (z tvojho sheetu) ───────────────────────────────
  for (const [year, month, streams, rate, tv, bonus, received] of seedPayload.jojHistory) {
    const monthDate = new Date(Date.UTC(year, month, 1))
    const expected = streams * rate + tv + bonus
    const receivedValue = received
    const diff = receivedValue !== null && receivedValue !== undefined ? receivedValue - expected : null

    await prisma.jojDetail.upsert({
      where: { month: monthDate },
      update: {
        streamCount: streams,
        ratePerStream: rate,
        tvHonorar: tv,
        bonus: bonus,
        expectedTotal: expected,
        receivedTotal: receivedValue,
        diff,
      },
      create: {
        month: monthDate,
        streamCount: streams,
        ratePerStream: rate,
        tvHonorar: tv,
        bonus: bonus,
        expectedTotal: expected,
        receivedTotal: receivedValue,
        diff,
      },
    })

    // Uloží aj do IncomeEntry
    if (receivedValue !== null && receivedValue !== undefined) {
      await prisma.incomeEntry.upsert({
        where: { sourceId_month: { sourceId: 'joj', month: monthDate } },
        update: {
          amount: receivedValue,
        },
        create: {
          sourceId: 'joj',
          month: monthDate,
          amount: receivedValue,
        },
      })
    }
  }
  console.log('✓ JOJ history seeded')

  // ─── Historické Sumár snapshoty (Jan–Apr 2026) ────────────────────────────
  for (const [monthStr, balances] of seedPayload.snapshots) {
    const [y, m] = monthStr.split('-').map(Number)
    const monthDate = new Date(Date.UTC(y, m - 1, 1))

    for (const [accountId, balance] of Object.entries(balances)) {
      await prisma.snapshot.upsert({
        where: { accountId_month: { accountId, month: monthDate } },
        update: { balance },
        create: { accountId, month: monthDate, balance },
      })
    }
  }
  console.log('✓ Historical snapshots seeded (Jan–Apr 2026)')

  // ─── Zárobky 2026 ────────────────────────────────────────────────────────
  for (const [monthStr, sourceId, amount] of seedPayload.income2026) {
    const [y, m] = monthStr.split('-').map(Number)
    const monthDate = new Date(Date.UTC(y, m - 1, 1))
    await prisma.incomeEntry.upsert({
      where: { sourceId_month: { sourceId, month: monthDate } },
      update: {
        amount,
      },
      create: { sourceId, month: monthDate, amount },
    })
  }
  console.log('✓ Income 2026 seeded')

  console.log('\n✅ Seed dokončený!')
  console.log('   Prihlás sa s heslom z ADMIN_PASSWORD v .env')
}

main()
  .catch((e) => { console.error(e); process.exit(1) })
  .finally(() => prisma.$disconnect())
