const clamp = (value, minimum, maximum) =>
  Math.max(minimum, Math.min(maximum, value));

export function calculateInternalCreditScore(input, history = {}) {
  const income = Number(input.monthlyIncomeCents);
  const expenses = Number(input.monthlyExpensesCents || 0);
  const debt = Number(input.existingDebtCents || 0);
  const requested = Number(input.requestedCents);
  const employmentMonths = Number(input.employmentMonths || 0);
  if (!Number.isInteger(income) || income <= 0)
    throw new Error("Renda mensal inválida.");
  for (const [label, value] of [
    ["Despesas", expenses],
    ["Dívidas", debt],
    ["Tempo de renda", employmentMonths],
  ]) {
    if (!Number.isInteger(value) || value < 0)
      throw new Error(`${label} inválido.`);
  }
  if (!Number.isInteger(requested) || requested <= 0)
    throw new Error("Valor solicitado inválido.");

  const disposable = Math.max(0, income - expenses - debt);
  const commitment = (expenses + debt) / income;
  const paid = Number(history.paidContracts || 0);
  const overdue = Number(history.overdueContracts || 0);
  const renegotiated = Number(history.renegotiatedContracts || 0);
  let score = 430;
  score += Math.round(clamp(disposable / income, 0, 0.7) * 260);
  score += Math.round(clamp(employmentMonths / 24, 0, 1) * 120);
  score += Math.min(160, paid * 40);
  score -= Math.min(260, overdue * 100);
  score -= Math.min(180, renegotiated * 60);
  if (commitment > 0.8) score -= 120;
  else if (commitment > 0.6) score -= 60;
  score = Math.round(clamp(score, 0, 1000));

  const historyMultiplier = clamp(1 + paid * 0.1 - overdue * 0.25, 0.35, 1.5);
  const recommendedLimitCents = Math.max(
    0,
    Math.round(Math.min(income * 0.5, disposable * 0.6) * historyMultiplier),
  );
  const riskBand = score >= 750 ? "baixo" : score >= 600 ? "moderado" : score >= 450 ? "alto" : "muito_alto";
  const reasons = [
    `Comprometimento mensal de ${Math.round(commitment * 100)}%.`,
    `Renda livre estimada em ${disposable} centavos.`,
    employmentMonths >= 24 ? "Renda estável há pelo menos 24 meses." : "Estabilidade de renda inferior a 24 meses.",
    paid ? `${paid} contrato(s) quitado(s) no histórico.` : "Ainda não há contratos quitados no histórico.",
    overdue ? `${overdue} contrato(s) vencido(s) reduzem a pontuação.` : "Nenhum contrato vencido no histórico interno.",
    requested > recommendedLimitCents ? "Valor solicitado acima do limite interno recomendado." : "Valor solicitado dentro do limite interno recomendado.",
  ];
  return { score, recommendedLimitCents, riskBand, reasons };
}
