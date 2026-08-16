import { randomBytes, scryptSync, timingSafeEqual, createHash } from 'node:crypto'

const KEY_LENGTH = 64

export function hashPassword(password) {
  validatePassword(password)
  const salt = randomBytes(16).toString('hex')
  const hash = scryptSync(password, salt, KEY_LENGTH).toString('hex')
  return `scrypt:${salt}:${hash}`
}

export function verifyPassword(password, encoded) {
  const [algorithm, salt, stored] = String(encoded).split(':')
  if (algorithm !== 'scrypt' || !salt || !stored) return false
  const supplied = scryptSync(password, salt, KEY_LENGTH)
  const expected = Buffer.from(stored, 'hex')
  return supplied.length === expected.length && timingSafeEqual(supplied, expected)
}

export function validatePassword(password) {
  if (typeof password !== 'string' || password.length < 10 || password.length > 128) {
    throw new Error('A senha deve ter entre 10 e 128 caracteres.')
  }
}

export function createSessionToken() {
  return randomBytes(32).toString('base64url')
}

export function hashToken(token) {
  return createHash('sha256').update(token).digest('hex')
}

