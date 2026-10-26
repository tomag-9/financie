# Financie App — Claude Context

## Čo je tento projekt
Osobná self-hosted webová appka na sledovanie financií pre jedného používateľa (Tomi).
Nahradza Excel sheet s mesačnými snapshotmi účtov, zárobkov a investícií.

## Tech stack (NEzmeňuj bez súhlasu)
- **Framework**: Next.js 16 (App Router) + TypeScript
- **Databáza**: SQLite cez Prisma ORM
- **Auth**: NextAuth.js v5 — credentials provider + TOTP (otplib)
- **Štýly**: Tailwind CSS v4
- **Grafy**: Recharts
- **Push notifikácie**: web-push + service worker (PWA)
- **Cron**: node-cron (každý 2. v mesiaci, 9:00)
- **Deploy**: Dokploy na vlastnom serveri, HTTPS cez Cloudflare Tunnel

## Štruktúra projektu
```
src/
  app/
    (auth)/login/         # login + TOTP stránky
    (app)/                # chránené route group
      dashboard/          # hlavný prehľad
      accounts/           # správa účtov
      snapshots/          # mesačné zadávanie
      income/             # zárobky (JOJ, Brusko, iné)
      investments/        # ETF/akcie pozície
      liabilities/        # záväzky
      settings/           # nastavenia, custom fields, TOTP setup
    api/
      auth/               # NextAuth handlers
      snapshots/          # CRUD snapshots
      income/             # CRUD income entries
      investments/        # mesačné investované príspevky podľa účtu
      liabilities/        # CRUD záväzky
      push/               # web-push subscription
      cron/               # cron trigger endpoint
  components/
    ui/                   # zdieľané UI komponenty
    charts/               # Recharts wrappery
    forms/                # formulárové komponenty
  lib/
    prisma.ts             # Prisma client singleton
    auth.ts               # NextAuth config
    totp.ts               # TOTP helpers
    push.ts               # web-push helpers
    calculations.ts       # net worth, savings rate a delta výpočty
  types/
    index.ts              # zdieľané TypeScript typy
prisma/
  schema.prisma           # databázová schéma
  migrations/             # Prisma migrácie
public/
  sw.js                   # service worker pre PWA + push
  manifest.json           # PWA manifest
```

## Databázová schéma (Prisma) — FINÁLNA, neupravuj bez migrácií

```prisma
model Account {
  id         String     @id @default(cuid())
  name       String                          // "Tatra", "Revolut", "Conseq"...
  type       AccountType                     // BANK | INVESTMENT | CASH | PENSION
  currency   String     @default("EUR")
  isActive   Boolean    @default(true)
  sortOrder  Int        @default(0)
  trackingStartMonth DateTime?
  closedAt   DateTime?
  snapshots  Snapshot[]
  investmentContributions InvestmentContribution[]
  createdAt  DateTime   @default(now())
}

model Snapshot {
  id        String   @id @default(cuid())
  accountId String
  account   Account  @relation(fields: [accountId], references: [id])
  month     DateTime                         // vždy 1. deň mesiaca, 00:00:00
  balance   Decimal?                         // null = nezadané ešte
  note      String?
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt
  customValues SnapshotCustomValue[]
  @@unique([accountId, month])
}

model IncomeSource {
  id       String        @id @default(cuid())
  name     String                            // "JOJ", "Zdravé Brusko", "Iné"
  color    String        @default("#378ADD")
  isActive Boolean       @default(true)
  entries  IncomeEntry[]
}

model IncomeEntry {
  id       String       @id @default(cuid())
  sourceId String
  source   IncomeSource @relation(fields: [sourceId], references: [id])
  month    DateTime
  amount   Decimal
  note     String?
  @@unique([sourceId, month])
}

// JOJ-špecifický detail (stream count, TV honorár, bonus)
model JojDetail {
  id          String   @id @default(cuid())
  month       DateTime @unique
  streamCount Int      @default(0)
  ratePerStream Decimal @default(0)
  tvHonorar   Decimal  @default(0)
  bonus       Decimal  @default(0)
  expectedTotal Decimal                      // vypočítané: stream*rate + tv + bonus
  receivedTotal Decimal?                     // reálne prijaté z banky
  diff          Decimal?                     // receivedTotal - expectedTotal
}

model Liability {
  id          String   @id @default(cuid())
  name        String
  totalAmount Decimal
  remaining   Decimal
  dueDate     DateTime?
  category    String?                        // "pôžička", "kreditka", "iné"
  isActive    Boolean  @default(true)
  createdAt   DateTime @default(now())
  updatedAt   DateTime @updatedAt
}

model Investment {
  id         String   @id @default(cuid())
  ticker     String                          // "VWCE", "CSPX"
  isin       String?
  name       String                          // "Vanguard FTSE All-World"
  platform   String                          // "XTB", "Conseq", "EIC"
  units      Decimal  @default(0)
  avgPrice   Decimal?                        // priemerná nákupná cena
  entries    InvestmentEntry[]
}

model InvestmentEntry {
  id           String     @id @default(cuid())
  investmentId String
  investment   Investment @relation(fields: [investmentId], references: [id])
  month        DateTime
  unitsAdded   Decimal    @default(0)
  amountAdded  Decimal    @default(0)        // investovaná suma tento mesiac
  priceAtTime  Decimal?                      // cena pri nákupe
  @@unique([investmentId, month])
}

model InvestmentContribution {
  id        String   @id @default(cuid())
  accountId String
  account   Account  @relation(fields: [accountId], references: [id])
  month     DateTime
  mode      String   @default("RECURRING")
  amount    Decimal  @default(0)
  @@unique([accountId, month])
}

model CustomField {
  id         String          @id @default(cuid())
  entityType String                          // "snapshot" | "income" | "liability"
  label      String
  fieldType  CustomFieldType                 // TEXT | NUMBER | BOOLEAN
  sortOrder  Int             @default(0)
  isActive   Boolean         @default(true)
  values     SnapshotCustomValue[]
}

model SnapshotCustomValue {
  id         String      @id @default(cuid())
  snapshotId String
  snapshot   Snapshot    @relation(fields: [snapshotId], references: [id])
  fieldId    String
  field      CustomField @relation(fields: [fieldId], references: [id])
  value      Json
  @@unique([snapshotId, fieldId])
}

model Settings {
  id    String @id @default("singleton")
  data  Json                                 // { totp_secret, push_subscription, ... }
}

enum AccountType { BANK INVESTMENT CASH PENSION }
enum CustomFieldType { TEXT NUMBER BOOLEAN }
```

## Kľúčové business pravidlá

### Snapshots
- Mesiac sa vždy ukladá ako `new Date(year, month, 1)` — prvý deň mesiaca
- `balance` môže byť `null` (partial entry je OK)
- Kompletnosť mesiaca sa riadi `trackingStartMonth`/`closedAt`; missing účet nie je platná nula.
- Net worth sa zobrazuje aj čiastkovo, ale delta sa počíta iba medzi dvoma kompletnými mesiacmi.
- Do EUR net worth sa bez kurzového prepočtu nezapočítavajú účty v cudzej mene.
- Net worth po záväzkoch = net worth - SUM(liability.remaining)

### Zárobky
- Každý zdroj má vlastné `IncomeEntry` per mesiac
- JOJ má extra `JojDetail` s breakdown streamov
- `savings_rate` = SUM(InvestmentContribution.amount za mesiac) / SUM(IncomeEntry.amount za mesiac) × 100
- Hodnota nad 100 % je platná a nesmie sa orezať; môže ísť o investovanie staršej hotovosti.

### Investície
- Aktuálny produkt eviduje mesačné investované príspevky v `InvestmentContribution`.
- `RECURRING` príspevok sa v ďalšom mesiaci zobrazí ako návrh a do štatistík vstúpi až po uložení.
- Staré `Investment` a `InvestmentEntry` záznamy ostávajú v databáze ako legacy portfólio, ale aktuálne UI ich nepoužíva.
- Market quotes a TWRR nie sú súčasťou aktuálneho produktu.

### JOJ alert
- Ak `JojDetail.diff` existuje a `Math.abs(diff) > 5` → badge v navigácii + push notifikácia

### Push notifikácie
- Cron: `0 9 2 * *` → odošle push "Čas zadať financie za [mesiac]"
- Klik na notifikáciu → otvorí `/finance/snapshots?month=YYYY-MM`

## Štýlové konvencie
- Server Components kde sa dá, Client Components len kde treba interaktivitu
- `'use server'` actions pre formuláre (nie API routes pre jednoduché CRUD)
- Dátumy vždy v UTC, zobrazovanie v `sk-SK` locale
- Sumy vždy `Decimal` v databáze, `number` v JS po `.toNumber()`
- Všetky skvantované hodnoty: `Intl.NumberFormat('sk-SK', { style: 'currency', currency: 'EUR' })`

## Čo NErobíme (mimo scope)
- Multi-user / tímové funkcie
- Mobile native app (PWA stačí)
- Automatická banka sync v prvej verzii (Open Banking je V2)
- Export do Excelu (nice-to-have neskôr)
