import type {
  Account,
  Snapshot,
  IncomeSource,
  IncomeEntry,
  JojDetail,
  Liability,
  Investment,
  InvestmentEntry,
  InvestmentContribution,
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
  InvestmentContribution,
  CustomField,
  Settings,
  AccountType,
  CustomFieldType,
}
// Settings.data shape — stored as JSON in DB
export interface SettingsData {
  password_hash?: string
  passwordHash?: string
  totp_secret?: string
  totpSecret?: string
  totp_enabled?: boolean
  totpEnabled?: boolean
  backup_codes?: string[]        // bcrypt hashes of backup codes
  backupCodes?: string[]
  push_subscription?: PushSubscriptionData
  pushSubscription?: PushSubscriptionData
  ai_alarm_success_push_enabled?: boolean
  aiAlarmSuccessPushEnabled?: boolean
  ai_alarm_error_push_enabled?: boolean
  aiAlarmErrorPushEnabled?: boolean
  savings_goal_pct?: number      // default 20
  savingsTarget?: number
}

export interface PushSubscriptionData {
  endpoint: string
  keys: {
    p256dh: string
    auth: string
  }
}
