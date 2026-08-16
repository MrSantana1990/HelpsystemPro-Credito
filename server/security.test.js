import { describe, expect, it } from 'vitest'
import { createSessionToken, hashPassword, hashToken, verifyPassword } from './security.js'

describe('segurança de credenciais', () => {
  it('gera hash com salt e valida a senha correta', () => {
    const encoded = hashPassword('SenhaForte#2026')
    expect(encoded).not.toContain('SenhaForte#2026')
    expect(verifyPassword('SenhaForte#2026', encoded)).toBe(true)
    expect(verifyPassword('SenhaErrada#2026', encoded)).toBe(false)
  })

  it('gera hashes distintos para a mesma senha', () => {
    expect(hashPassword('SenhaForte#2026')).not.toBe(hashPassword('SenhaForte#2026'))
  })

  it('recusa senha curta', () => {
    expect(() => hashPassword('curta')).toThrow('10 e 128')
  })

  it('gera token aleatório e armazena somente seu hash', () => {
    const first = createSessionToken()
    const second = createSessionToken()
    expect(first).not.toBe(second)
    expect(hashToken(first)).toHaveLength(64)
    expect(hashToken(first)).not.toContain(first)
  })
})

