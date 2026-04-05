import type { Prisma } from '@prisma/client'
import type {
  Account,
  Snapshot,
  IncomeSource,
  IncomeEntry,
  JojDetail,
  Liability,
  Investment,
  InvestmentEntry,
  CustomField,
  Settings,
  AccountType,
  CustomFieldType,
} from '@prisma/client'

export type {
  Account,
  Snapshot,
  IncomeSource,
  IncomeEntry,
  JojDetail,
  Liability,
  Investment,
  InvestmentEntry,
  CustomField,
  Settings,
  AccountType,
  CustomFieldType,
}

// With relations
export type AccountWithSnapshots = Prisma.AccountGetPayload<{
  include: { snapshots: true }
}>

export type SnapshotWithAccount = Prisma.SnapshotGetPayload<{
  include: { account: true }
}>

export type IncomeSourceWithEntries = Prisma.IncomeSourceGetPayload<{
  include: { entries: true }
}>

export type IncomeEntryWithSource = Prisma.IncomeEntryGetPayload<{
  include: { source: true }
}>

export type InvestmentWithEntries = Prisma.InvestmentGetPayload<{
  include: { entries: true }
}>

export type InvestmentEntryWithInvestment = Prisma.InvestmentEntryGetPayload<{
  include: { investment: true }
}>

// Settings.data shape — stored as JSON in DB
export interface SettingsData {
  password_hash?: string
  totp_secret?: string
  totp_enabled?: boolean
  backup_codes?: string[]        // bcrypt hashes of backup codes
  push_subscription?: PushSubscriptionData
  savings_goal_pct?: number      // default 20
}

export interface PushSubscriptionData {
  endpoint: string
  keys: {
    p256dh: string
    auth: string
  }
}

// Calculation helper types
export interface MonthlyEntry {
  month: Date
  portfolioValue: number
  cashFlow: number
}

export interface NetWorthData {
  month: Date
  netWorth: number
  netWorthAfterLiabilities: number
  delta: number | null
  deltaPct: number | null
}

export interface MarketCache {
  [ticker: string]: {
    price: number
    fetchedAt: string // ISO string
  }
}
