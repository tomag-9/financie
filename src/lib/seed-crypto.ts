import { createCipheriv, createDecipheriv, randomBytes, scryptSync } from 'crypto'

const MAGIC = Buffer.from('FINSEED1')
const SALT_LENGTH = 16
const IV_LENGTH = 12
const TAG_LENGTH = 16
const KEY_LENGTH = 32

function deriveKey(password: string, salt: Buffer): Buffer {
  return scryptSync(password, salt, KEY_LENGTH)
}

export function encryptSeedBuffer(plain: Buffer, password: string): Buffer {
  const salt = randomBytes(SALT_LENGTH)
  const iv = randomBytes(IV_LENGTH)
  const key = deriveKey(password, salt)
  const cipher = createCipheriv('aes-256-gcm', key, iv)

  const encrypted = Buffer.concat([cipher.update(plain), cipher.final()])
  const tag = cipher.getAuthTag()

  return Buffer.concat([MAGIC, salt, iv, tag, encrypted])
}

export function decryptSeedBuffer(encrypted: Buffer, password: string): Buffer {
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

  const key = deriveKey(password, salt)
  const decipher = createDecipheriv('aes-256-gcm', key, iv)
  decipher.setAuthTag(tag)

  return Buffer.concat([decipher.update(ciphertext), decipher.final()])
}

export function getSeedPassword(): string {
  const password = process.env.SEED_DATA_PASSWORD?.trim()
  if (!password) {
    throw new Error('SEED_DATA_PASSWORD is not set.')
  }

  return password
}

export function getSeedEncodePassword(): string {
  const password = process.env.SEED_DATA_ENCODE_PASSWORD?.trim() || process.env.SEED_DATA_PASSWORD?.trim()
  if (!password) {
    throw new Error('SEED_DATA_ENCODE_PASSWORD or SEED_DATA_PASSWORD is not set.')
  }

  return password
}

export function getSeedDecodePassword(): string {
  const password = process.env.SEED_DATA_DECODE_PASSWORD?.trim() || process.env.SEED_DATA_PASSWORD?.trim()
  if (!password) {
    throw new Error('SEED_DATA_DECODE_PASSWORD or SEED_DATA_PASSWORD is not set.')
  }

  return password
}
