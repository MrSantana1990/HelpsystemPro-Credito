import { describe, expect, it } from 'vitest'
import {
  addCalendarDays,
  allocatePayment,
  calculateContract,
  renewAfterInterestPayment,
} from './finance'

describe('calculateContract', () => {
  it('calcula 30% sem usar ponto flutuante para dinheiro', () => {
    expect(calculateContract(100_000, 0.3)).toEqual({
      principal: 100_000,
      interest: 30_000,
      fee: 0,
      total: 130_000,
    })
  })

  it('arredonda juros para o centavo mais próximo', () => {
    expect(calculateContract(47_700, 0.3).interest).toBe(14_310)
  })

  it('recusa valores monetários negativos', () => {
    expect(() => calculateContract(-1, 0.3)).toThrow('Principal')
  })
})

describe('allocatePayment', () => {
  it('distribui pagamento entre multa, juros e principal nessa ordem', () => {
    expect(allocatePayment(50_000, { fee: 2_000, interest: 30_000, principal: 100_000 })).toEqual({
      received: 50_000,
      appliedToFee: 2_000,
      appliedToInterest: 30_000,
      appliedToPrincipal: 18_000,
      unapplied: 0,
      remainingFee: 0,
      remainingInterest: 0,
      remainingPrincipal: 82_000,
      remainingTotal: 82_000,
    })
  })

  it('mantém juros pendentes quando o pagamento é insuficiente', () => {
    const result = allocatePayment(10_000, { fee: 0, interest: 30_000, principal: 100_000 })
    expect(result.remainingInterest).toBe(20_000)
    expect(result.remainingPrincipal).toBe(100_000)
  })

  it('separa pagamento excedente para conferência', () => {
    const result = allocatePayment(140_000, { fee: 0, interest: 30_000, principal: 100_000 })
    expect(result.remainingTotal).toBe(0)
    expect(result.unapplied).toBe(10_000)
  })
})

describe('renewAfterInterestPayment', () => {
  it('preserva o principal e cria novo vencimento em 30 dias', () => {
    expect(renewAfterInterestPayment(100_000, 30_000, 0.3, '2026-08-15')).toEqual({
      previousCycleInterestPaid: 30_000,
      renewedPrincipal: 100_000,
      nextInterest: 30_000,
      nextTotal: 130_000,
      nextDueDate: '2026-09-14',
    })
  })

  it('não renova quando os juros não foram pagos integralmente', () => {
    expect(() => renewAfterInterestPayment(100_000, 20_000, 0.3, '2026-08-15')).toThrow(
      'pagamento integral',
    )
  })
})

describe('addCalendarDays', () => {
  it('atravessa virada de mês corretamente', () => {
    expect(addCalendarDays('2026-01-30', 30)).toBe('2026-03-01')
  })

  it('recusa datas inexistentes', () => {
    expect(() => addCalendarDays('2026-02-30', 30)).toThrow('inexistente')
  })
})

