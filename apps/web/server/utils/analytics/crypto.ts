import { createCipheriv, createDecipheriv, randomBytes } from 'node:crypto'
import { createError } from 'h3'

const ALGO = 'aes-256-gcm'
const IV_LENGTH = 12
const TAG_LENGTH = 16

function resolveEncryptionKey(explicitKey?: string): Buffer {
  const raw = (explicitKey || process.env.ANALYTICS_CREDENTIALS_ENCRYPTION_KEY || '').trim()
  if (!raw) {
    throw createError({
      statusCode: 503,
      statusMessage: 'ANALYTICS_CREDENTIALS_ENCRYPTION_KEY is not configured'
    })
  }

  let key: Buffer
  try {
    key = Buffer.from(raw, 'base64')
  } catch {
    throw createError({
      statusCode: 503,
      statusMessage: 'ANALYTICS_CREDENTIALS_ENCRYPTION_KEY must be base64-encoded'
    })
  }

  if (key.length !== 32) {
    throw createError({
      statusCode: 503,
      statusMessage: 'ANALYTICS_CREDENTIALS_ENCRYPTION_KEY must decode to 32 bytes (AES-256)'
    })
  }

  return key
}

/** Encrypt a JSON-serializable credentials object. Returns base64(iv + tag + ciphertext). */
export function encryptCredentials(payload: unknown, encryptionKey?: string): string {
  const key = resolveEncryptionKey(encryptionKey)
  const iv = randomBytes(IV_LENGTH)
  const cipher = createCipheriv(ALGO, key, iv)
  const plaintext = Buffer.from(JSON.stringify(payload), 'utf8')
  const encrypted = Buffer.concat([cipher.update(plaintext), cipher.final()])
  const tag = cipher.getAuthTag()
  return Buffer.concat([iv, tag, encrypted]).toString('base64')
}

/** Decrypt a credentials ciphertext produced by encryptCredentials. */
export function decryptCredentials<T = Record<string, unknown>>(
  ciphertext: string,
  encryptionKey?: string
): T {
  const key = resolveEncryptionKey(encryptionKey)
  const buf = Buffer.from(ciphertext, 'base64')
  if (buf.length < IV_LENGTH + TAG_LENGTH + 1) {
    throw createError({ statusCode: 500, statusMessage: 'Invalid encrypted credentials payload' })
  }

  const iv = buf.subarray(0, IV_LENGTH)
  const tag = buf.subarray(IV_LENGTH, IV_LENGTH + TAG_LENGTH)
  const data = buf.subarray(IV_LENGTH + TAG_LENGTH)
  const decipher = createDecipheriv(ALGO, key, iv)
  decipher.setAuthTag(tag)
  const decrypted = Buffer.concat([decipher.update(data), decipher.final()])
  return JSON.parse(decrypted.toString('utf8')) as T
}

export function maskSecretLast4(secret: string | undefined | null): string | undefined {
  const value = String(secret ?? '').trim()
  if (value.length < 4) return undefined
  return value.slice(-4)
}

export function isEncryptionConfigured(): boolean {
  try {
    resolveEncryptionKey()
    return true
  } catch {
    return false
  }
}
