import { describe, expect, it } from 'vitest'
import { addDays, allocate, interestFor } from './finance.js'

describe('regras financeiras da API', () => {
  it('calcula juros em centavos', () => {
    expect(interestFor(100_000, 0.3)).toBe(30_000)
  })

  it('distribui multa, juros e principal na ordem prevista', () => {
    expect(allocate(50_000, { fee: 2_000, interest: 30_000, principal: 100_000 })).toEqual({
      toFee: 2_000,
      toInterest: 30_000,
      toPrincipal: 18_000,
      unapplied: 0,
    })
  })

  it('preserva excedente sem aplicá-lo silenciosamente', () => {
    expect(allocate(140_000, { fee: 0, interest: 30_000, principal: 100_000 }).unapplied).toBe(10_000)
  })

  it('soma 30 dias corridos na virada do mês', () => {
    expect(addDays('2026-08-15', 30)).toBe('2026-09-14')
  })

  it('recusa data inexistente', () => {
    expect(() => addDays('2026-02-30', 30)).toThrow('inexistente')
  })
})

