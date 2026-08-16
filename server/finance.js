export function addDays(isoDate, days) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(isoDate) || !Number.isInteger(days) || days <= 0) {
    throw new Error('Data ou prazo inválido.')
  }
  const [year, month, day] = isoDate.split('-').map(Number)
  const date = new Date(Date.UTC(year, month - 1, day))
  if (date.getUTCFullYear() !== year || date.getUTCMonth() !== month - 1 || date.getUTCDate() !== day) {
    throw new Error('Data inexistente.')
  }
  date.setUTCDate(date.getUTCDate() + days)
  return date.toISOString().slice(0, 10)
}

export function interestFor(principalCents, rate) {
  if (!Number.isInteger(principalCents) || principalCents < 0 || !Number.isFinite(rate) || rate < 0) {
    throw new Error('Principal ou taxa inválida.')
  }
  return Math.round(principalCents * rate)
}

export function allocate(amount, { fee, interest, principal }) {
  for (const value of [amount, fee, interest, principal]) {
    if (!Number.isInteger(value) || value < 0) throw new Error('Valores devem ser centavos inteiros.')
  }
  let available = amount
  const toFee = Math.min(available, fee); available -= toFee
  const toInterest = Math.min(available, interest); available -= toInterest
  const toPrincipal = Math.min(available, principal); available -= toPrincipal
  return { toFee, toInterest, toPrincipal, unapplied: available }
}

