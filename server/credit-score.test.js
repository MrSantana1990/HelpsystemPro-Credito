import { describe, expect, it } from "vitest";
import { calculateBehaviorScore, calculateInternalCreditScore } from "./credit-score.js";

describe("score interno de crédito", () => {
  it("recomenda limite e explica um perfil saudável", () => {
    const result = calculateInternalCreditScore(
      { monthlyIncomeCents: 500000, monthlyExpensesCents: 180000, existingDebtCents: 20000, requestedCents: 100000, employmentMonths: 36 },
      { paidContracts: 3, overdueContracts: 0, renegotiatedContracts: 0 },
    );
    expect(result.score).toBeGreaterThanOrEqual(750);
    expect(result.recommendedLimitCents).toBeGreaterThan(0);
    expect(result.riskBand).toBe("baixo");
    expect(result.reasons).toHaveLength(6);
  });

  it("reduz pontuação por comprometimento e atraso", () => {
    const result = calculateInternalCreditScore(
      { monthlyIncomeCents: 200000, monthlyExpensesCents: 150000, existingDebtCents: 40000, requestedCents: 150000, employmentMonths: 2 },
      { paidContracts: 0, overdueContracts: 2, renegotiatedContracts: 1 },
    );
    expect(result.score).toBeLessThan(450);
    expect(result.riskBand).toBe("muito_alto");
  });
});

describe("indicador comportamental automático", () => {
  it("começa neutro e melhora com cadastro e quitações", () => {
    const result = calculateBehaviorScore(
      { document: "123", phone: "11999999999", email: "cliente@teste.local", created_at: "2025-01-01" },
      { paidContracts: 4, onTimePayments: 3, paidPrincipalCents: 400_000 },
    );
    expect(result.score).toBeGreaterThanOrEqual(750);
    expect(result.riskBand).toBe("baixo");
    expect(result.recommendedLimitCents).toBeGreaterThan(0);
  });

  it("expõe atrasos, renegociações e pendências sem decisão automática", () => {
    const result = calculateBehaviorScore(
      { created_at: new Date().toISOString() },
      { overdueContracts: 2, renegotiatedContracts: 1, reviewContracts: 2, latePayments: 1 },
    );
    expect(result.score).toBeLessThan(450);
    expect(result.reasons.some((reason) => reason.includes("vencido"))).toBe(true);
  });
});
