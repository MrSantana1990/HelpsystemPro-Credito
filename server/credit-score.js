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

export function calculateBehaviorScore(client, history = {}) {
  const paid = Number(history.paidContracts || 0);
  const overdue = Number(history.overdueContracts || 0);
  const renegotiated = Number(history.renegotiatedContracts || 0);
  const review = Number(history.reviewContracts || 0);
  const onTime = Number(history.onTimePayments || 0);
  const late = Number(history.latePayments || 0);
  const totalPrincipal = Number(history.paidPrincipalCents || 0);
  const verifiedIncomeDocuments = Number(history.verifiedIncomeDocuments || 0);
  const declaredIncome = Number(client.declared_income_cents || 0);
  const profileFields = [client.document, client.phone, client.email].filter(Boolean).length;
  const createdAt = Date.parse(client.created_at || new Date().toISOString());
  const tenureDays = Math.max(0, Math.floor((Date.now() - createdAt) / 86_400_000));
  let score = 500;
  score += profileFields * 20;
  score += Math.min(50, Math.floor(tenureDays / 30) * 5);
  score += Math.min(180, paid * 30);
  score += Math.min(100, onTime * 20);
  score -= Math.min(300, overdue * 90);
  score -= Math.min(180, renegotiated * 45);
  score -= Math.min(120, late * 30);
  score -= Math.min(75, review * 25);
  if (verifiedIncomeDocuments && declaredIncome > 0) {
    const incomeWeights = { clt: 50, autonomo: 30, beneficio: 60, empresario: 35, outro: 20 };
    score += incomeWeights[client.income_type] || 20;
  }
  score = Math.round(clamp(score, 0, 1000));
  const riskBand = score >= 750 ? "baixo" : score >= 600 ? "moderado" : score >= 450 ? "alto" : "muito_alto";
  const averagePaidPrincipalCents = paid ? Math.round(totalPrincipal / paid) : 0;
  const historyLimit = paid ? averagePaidPrincipalCents * clamp(score / 700, 0.4, 1.3) : 0;
  const verifiedIncomeLimit = verifiedIncomeDocuments && declaredIncome ? declaredIncome * (client.income_type === "beneficio" || client.income_type === "clt" ? 0.35 : 0.25) : 0;
  const recommendedLimitCents = Math.max(0, Math.round(historyLimit && verifiedIncomeLimit ? Math.min(historyLimit, verifiedIncomeLimit) : historyLimit || verifiedIncomeLimit));
  const reasons = [
    profileFields === 3 ? "Cadastro essencial completo." : `${3 - profileFields} dado(s) essencial(is) ainda não informado(s).`,
    tenureDays < 30 ? "Relacionamento recente, com menos de 30 dias." : `${tenureDays} dias de relacionamento registrados.`,
    paid ? `${paid} contrato(s) quitado(s) fortalecem o histórico.` : "Ainda não há quitações registradas.",
    onTime ? `${onTime} pagamento(s) identificado(s) até o vencimento.` : "Ainda não há pontualidade comprovada por pagamentos datados.",
    overdue ? `${overdue} contrato(s) vencido(s) reduzem a nota.` : "Nenhum contrato aberto vencido.",
    renegotiated ? `${renegotiated} renegociação(ões) considerada(s).` : "Nenhuma renegociação registrada.",
    review ? `${review} contrato(s) legado(s) aguardam revisão.` : "Nenhuma pendência de revisão.",
    verifiedIncomeDocuments ? `Renda ${client.income_type || "declarada"} possui comprovante verificado.` : "Renda ainda não possui comprovante verificado.",
  ];
  return { score, riskBand, recommendedLimitCents, reasons, factors: { paid, overdue, renegotiated, review, onTime, late, tenureDays, profileFields, verifiedIncomeDocuments } };
}
