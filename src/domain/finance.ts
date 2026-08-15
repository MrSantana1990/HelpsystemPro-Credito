export type Money = number

export interface ContractCalculation {
  principal: Money
  interest: Money
  fee: Money
  total: Money
}

export interface PaymentAllocation {
  received: Money
  appliedToFee: Money
  appliedToInterest: Money
  appliedToPrincipal: Money
  unapplied: Money
  remainingFee: Money
  remainingInterest: Money
  remainingPrincipal: Money
  remainingTotal: Money
}

export interface RenewalResult {
  previousCycleInterestPaid: Money
  renewedPrincipal: Money
  nextInterest: Money
  nextTotal: Money
  nextDueDate: string
}

const assertMoney = (value: number, field: string) => {
  if (!Number.isInteger(value) || value < 0) {
    throw new Error(`${field} deve ser informado em centavos inteiros e não negativos.`)
  }
}

export const calculateContract = (
  principal: Money,
  monthlyRate: number,
  fee: Money = 0,
): ContractCalculation => {
  assertMoney(principal, 'Principal')
  assertMoney(fee, 'Multa')
  if (!Number.isFinite(monthlyRate) || monthlyRate < 0) {
    throw new Error('Taxa mensal inválida.')
  }

  const interest = Math.round(principal * monthlyRate)
  return { principal, interest, fee, total: principal + interest + fee }
}

export const allocatePayment = (
  received: Money,
  balances: Pick<ContractCalculation, 'fee' | 'interest' | 'principal'>,
): PaymentAllocation => {
  assertMoney(received, 'Pagamento')
  assertMoney(balances.fee, 'Multa')
  assertMoney(balances.interest, 'Juros')
  assertMoney(balances.principal, 'Principal')

  let available = received
  const appliedToFee = Math.min(available, balances.fee)
  available -= appliedToFee
  const appliedToInterest = Math.min(available, balances.interest)
  available -= appliedToInterest
  const appliedToPrincipal = Math.min(available, balances.principal)
  available -= appliedToPrincipal

  const remainingFee = balances.fee - appliedToFee
  const remainingInterest = balances.interest - appliedToInterest
  const remainingPrincipal = balances.principal - appliedToPrincipal

  return {
    received,
    appliedToFee,
    appliedToInterest,
    appliedToPrincipal,
    unapplied: available,
    remainingFee,
    remainingInterest,
    remainingPrincipal,
    remainingTotal: remainingFee + remainingInterest + remainingPrincipal,
  }
}

export const addCalendarDays = (isoDate: string, days: number): string => {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(isoDate) || !Number.isInteger(days)) {
    throw new Error('Data ou prazo inválido.')
  }
  const [year, month, day] = isoDate.split('-').map(Number)
  const date = new Date(Date.UTC(year, month - 1, day))
  if (
    date.getUTCFullYear() !== year ||
    date.getUTCMonth() !== month - 1 ||
    date.getUTCDate() !== day
  ) {
    throw new Error('Data inexistente.')
  }
  date.setUTCDate(date.getUTCDate() + days)
  return date.toISOString().slice(0, 10)
}

export const renewAfterInterestPayment = (
  principal: Money,
  interestPaid: Money,
  monthlyRate: number,
  renewalDate: string,
  termDays = 30,
): RenewalResult => {
  const current = calculateContract(principal, monthlyRate)
  assertMoney(interestPaid, 'Juros pagos')
  if (interestPaid !== current.interest) {
    throw new Error('A renovação exige o pagamento integral dos juros do ciclo.')
  }
  if (!Number.isInteger(termDays) || termDays <= 0) {
    throw new Error('Prazo de renovação inválido.')
  }

  const next = calculateContract(principal, monthlyRate)
  return {
    previousCycleInterestPaid: interestPaid,
    renewedPrincipal: principal,
    nextInterest: next.interest,
    nextTotal: next.total,
    nextDueDate: addCalendarDays(renewalDate, termDays),
  }
}

