import bcrypt from 'bcryptjs'
import crypto from 'node:crypto'
import { generateSecret, generateURI, verifySync } from 'otplib'

const BACKUP_CODES_COUNT = 8

export function createTotpSecret(): string {
  return generateSecret()
}

export function createOtpAuthUrl(userLabel: string, secret: string): string {
  return generateURI({
    issuer: 'Financie',
    label: userLabel,
    secret,
    digits: 6,
    period: 30,
  })
}

export function verifyTotpToken(secret: string, token: string): boolean {
  const result = verifySync({
    secret,
    token,
    digits: 6,
    period: 30,
    epochTolerance: 30,
  })

  return result.valid
}

function randomBackupChunk(length: number): string {
  const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'
  const bytes = crypto.randomBytes(length)
  let out = ''

  for (let i = 0; i < length; i += 1) {
    out += alphabet[bytes[i] % alphabet.length]
  }

  return out
}

export function normalizeBackupCode(code: string): string {
  return code.trim().toUpperCase().replace(/[^A-Z0-9]/g, '')
}

function formatBackupCode(raw: string): string {
  return `${raw.slice(0, 4)}-${raw.slice(4, 8)}`
}

export async function generateBackupCodes(): Promise<{
  plainCodes: string[]
  hashedCodes: string[]
}> {
  const rawCodes = Array.from({ length: BACKUP_CODES_COUNT }, () => randomBackupChunk(8))
  const plainCodes = rawCodes.map(formatBackupCode)
  const hashedCodes = await Promise.all(rawCodes.map(async (code) => bcrypt.hash(code, 12)))

  return { plainCodes, hashedCodes }
}

export async function consumeBackupCode(
  inputCode: string,
  hashedCodes: string[]
): Promise<{ matched: boolean; remainingHashes: string[] }> {
  const normalized = normalizeBackupCode(inputCode)
  if (!normalized) {
    return { matched: false, remainingHashes: hashedCodes }
  }

  for (let i = 0; i < hashedCodes.length; i += 1) {
    const hash = hashedCodes[i]
    const isMatch = await bcrypt.compare(normalized, hash)

    if (isMatch) {
      return {
        matched: true,
        remainingHashes: hashedCodes.filter((_, idx) => idx !== i),
      }
    }
  }

  return { matched: false, remainingHashes: hashedCodes }
}
