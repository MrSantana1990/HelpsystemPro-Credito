import { describe, expect, it } from "vitest";
import { calculateInternalCreditScore } from "./credit-score.js";

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
