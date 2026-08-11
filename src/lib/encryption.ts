/**
 * Application-level AES-256-GCM encryption for vendor API keys.
 *
 * Key: 32-byte hex string from VENDOR_KEY_ENCRYPTION_SECRET env var.
 * Format stored in DB: "iv_hex:ciphertext_hex:tag_hex"
 *
 * This protects against DB leaks — even if someone dumps the vendor_payment_config
 * table, they cannot use the API keys without the encryption secret.
 */
import { createCipheriv, createDecipheriv, randomBytes } from 'crypto'

function getKey(): Buffer {
  const hex = process.env.VENDOR_KEY_ENCRYPTION_SECRET
  if (!hex || hex.length !== 64) {
    throw new Error('VENDOR_KEY_ENCRYPTION_SECRET must be a 64-character hex string (32 bytes)')
  }
  return Buffer.from(hex, 'hex')
}

export function encryptApiKey(plaintext: string): string {
  const key = getKey()
  const iv  = randomBytes(12)
  const cipher = createCipheriv('aes-256-gcm', key, iv)
  const encrypted = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()])
  const tag = cipher.getAuthTag()
  return `${iv.toString('hex')}:${encrypted.toString('hex')}:${tag.toString('hex')}`
}

export function decryptApiKey(ciphertext: string): string {
  const key = getKey()
  const parts = ciphertext.split(':')
  if (parts.length !== 3) throw new Error('Invalid ciphertext format')
  const [ivHex, encHex, tagHex] = parts
  const iv        = Buffer.from(ivHex,  'hex')
  const encrypted = Buffer.from(encHex, 'hex')
  const tag       = Buffer.from(tagHex, 'hex')
  const decipher  = createDecipheriv('aes-256-gcm', key, iv)
  decipher.setAuthTag(tag)
  return Buffer.concat([decipher.update(encrypted), decipher.final()]).toString('utf8')
}

/** Returns true if the value looks like an encrypted key (not plaintext). */
export function isEncrypted(value: string): boolean {
  const parts = value.split(':')
  return parts.length === 3 && parts[0].length === 24 // 12-byte IV = 24 hex chars
}
