// prisma/seed.ts
// Spusti: npx prisma db seed
// Pridá predvolené účty, income sources a historické JOJ dáta

import { PrismaClient, AccountType } from '@prisma/client'
import bcrypt from 'bcryptjs'

const prisma = new PrismaClient()

async function main() {
  console.log('🌱 Seeding database...')

  // ─── Settings (heslo z ENV) ──────────────────────────────────────────────
  const adminPassword = process.env.ADMIN_PASSWORD
  if (!adminPassword) throw new Error('ADMIN_PASSWORD nie je nastavené v .env')

  const passwordHash = await bcrypt.hash(adminPassword, 12)
  await prisma.settings.upsert({
    where: { id: 'singleton' },
    update: {
      data: {
        passwordHash,
      },
    },
    create: {
      id: 'singleton',
      data: {
        passwordHash,
        totpSecret: null,
        totpEnabled: false,
        backupCodes: [],
        pushSubscription: null,
        savingsTarget: 20,
      },
    },
  })
  console.log('✓ Settings created')

  // ─── Účty ────────────────────────────────────────────────────────────────
  const accounts = [
    { name: 'Tatra',    type: AccountType.BANK,       sortOrder: 0 },
    { name: 'Revolut',  type: AccountType.BANK,       sortOrder: 1 },
    { name: 'Cash',     type: AccountType.CASH,       sortOrder: 2 },
    { name: 'Conseq',   type: AccountType.INVESTMENT, sortOrder: 3 },
    { name: 'EIC',      type: AccountType.INVESTMENT, sortOrder: 4 },
    { name: 'XTB',      type: AccountType.INVESTMENT, sortOrder: 5 },
    { name: '2. pilier',type: AccountType.PENSION,    sortOrder: 6 },
  ]

  for (const acc of accounts) {
    await prisma.account.upsert({
      where: { id: acc.name.toLowerCase().replace(/[^a-z0-9]/g, '') },
      update: {},
      create: { ...acc, id: acc.name.toLowerCase().replace(/[^a-z0-9]/g, '') },
    })
  }
  console.log('✓ Accounts created')

  // ─── Income sources ───────────────────────────────────────────────────────
  const sources = [
    { id: 'joj',    name: 'JOJ',            color: '#378ADD' },
    { id: 'brusko', name: 'Zdravé Brusko',  color: '#1D9E75' },
    { id: 'ine',    name: 'Iné',            color: '#888780' },
  ]

  for (const src of sources) {
    await prisma.incomeSource.upsert({
      where: { id: src.id },
      update: {},
      create: src,
    })
  }
  console.log('✓ Income sources created')

  // ─── Historické JOJ dáta (z tvojho sheetu) ───────────────────────────────
  const jojHistory = [
    // [rok, mesiac (0-indexed), streamy, rate, tv, bonus, received]
    [2022,  8,  3, 30,    0,   0,     0],
    [2022,  9, 15, 30,    0,   0,   549],
    [2022, 10, 14, 30,    0,   0,   427],
    [2022, 11,  9, 30,    0,   0, 298.9],
    [2023,  0, 16, 30,    0,   0, 418.46],
    [2023,  1, 12, 30,    0,   0, 358.68],
    [2023,  2, 22, 30,    0,   0, 657.91],
    [2023,  3, 19, 30,    0,   0, 567.91],
    [2023,  4, 11, 30,    0,   0, 298.9],
    [2023,  5,  4, 30,    0,   0, 159.41],
    [2023,  7,  4, 30,    0,   0,   122],
    [2023,  8, 20, 30,    0,   0,  579.5],
    [2023,  9, 20, 40,    0,  80, 894.56],
    [2023, 10, 19, 40,    0,   0, 731.88],
    [2023, 11, 17, 40,    0,   0, 691.22],
    [2024,  0, 14, 40,  440,   0, 1097.89],
    [2024,  1, 12, 40,    0,   0, 487.92],
    [2024,  2, 20, 40,  520,   0, 1341.84],
    [2024,  3, 10, 40, 1190, 120, 1737.74],
    [2024,  4, 14, 40,  950,   0, 1535.03],
    [2024,  5,  1, 40,  570,   0, 620.11],
    [2024,  6,  1, 40,   70,   0, 111.82],
    [2024,  7,  1, 40,  560,   0, 609.94],
    [2024,  8,  6, 40,  360,   0, 609.92],
    [2024,  9, 10, 40,  770,   0, 1189.36],
    [2024, 10,  8, 40,  440, 150, 919.99],
  ]

  for (const [year, month, streams, rate, tv, bonus, received] of jojHistory) {
    const monthDate = new Date(Date.UTC(year as number, month as number, 1))
    const expected = (streams as number) * (rate as number) + (tv as number) + (bonus as number)
    const hasReceived = received !== null && received !== undefined
    const receivedValue = hasReceived ? (received as number) : null
    const diff = hasReceived ? (received as number) - expected : null

    await prisma.jojDetail.upsert({
      where: { month: monthDate },
      update: {},
      create: {
        month: monthDate,
        streamCount: streams as number,
        ratePerStream: rate as number,
        tvHonorar: tv as number,
        bonus: bonus as number,
        expectedTotal: expected,
        receivedTotal: receivedValue,
        diff,
      },
    })

    // Uloží aj do IncomeEntry
    if (hasReceived) {
      await prisma.incomeEntry.upsert({
        where: { sourceId_month: { sourceId: 'joj', month: monthDate } },
        update: {},
        create: {
          sourceId: 'joj',
          month: monthDate,
          amount: received as number,
        },
      })
    }
  }
  console.log('✓ JOJ history seeded')

  // ─── Historické Sumár snapshoty (Jan–Apr 2026) ────────────────────────────
  const snapshots = [
    // [mesiac, { accountId: balance }]
    ['2026-01', { tatra: 11945.36, cash: 2000, conseq: 1346.61, eic: 30496.55, '2pilier': 59.43 }],
    ['2026-02', { tatra: 15597.12, cash: 2000, conseq: 1306.96, eic: 30366.90, '2pilier': 60.28 }],
    ['2026-03', { tatra: 7202.32,  cash: 2000, conseq: 1331.15, eic: 35992.80, xtb: 4500, '2pilier': 77.04 }],
    ['2026-04', { tatra: 4741.21,  revolut: 112, cash: 2000, conseq: 1326.8, eic: 35220.56, xtb: 5218.16, '2pilier': 75.03 }],
  ]

  for (const [monthStr, balances] of snapshots) {
    const [y, m] = (monthStr as string).split('-').map(Number)
    const monthDate = new Date(Date.UTC(y, m - 1, 1))

    for (const [accountId, balance] of Object.entries(balances as Record<string, number>)) {
      await prisma.snapshot.upsert({
        where: { accountId_month: { accountId, month: monthDate } },
        update: { balance },
        create: { accountId, month: monthDate, balance },
      })
    }
  }
  console.log('✓ Historical snapshots seeded (Jan–Apr 2026)')

  // ─── Zárobky 2026 ────────────────────────────────────────────────────────
  const income2026 = [
    ['2026-01', 'joj',    1458.83],
    ['2026-01', 'brusko', 1500.00],
    ['2026-02', 'brusko', 1000.00],
  ]

  for (const [monthStr, sourceId, amount] of income2026) {
    const [y, m] = (monthStr as string).split('-').map(Number)
    const monthDate = new Date(Date.UTC(y, m - 1, 1))
    await prisma.incomeEntry.upsert({
      where: { sourceId_month: { sourceId: sourceId as string, month: monthDate } },
      update: {},
      create: { sourceId: sourceId as string, month: monthDate, amount: amount as number },
    })
  }
  console.log('✓ Income 2026 seeded')

  console.log('\n✅ Seed dokončený!')
  console.log('   Prihlás sa s heslom z ADMIN_PASSWORD v .env')
}

main()
  .catch((e) => { console.error(e); process.exit(1) })
  .finally(() => prisma.$disconnect())
