import { describe, expect, it } from "vitest";
import { assessForecast, rollUpForecast } from "./domain";

const base = {
  sellerCategory: "COMMIT" as const,
  managerCategory: "COMMIT" as const,
  strongUsage: true,
  customerIntentPositive: true,
  economicBuyerEngaged: true,
  commercialProgress: false,
  methodologyCompleteness: 72,
  securityOrProcurementBlocker: false,
  blockerDays: 0,
  missedCommitments: 0,
  completedCommitments: 1,
  executiveEngagementDeclining: false,
  coverageGapCount: 0,
  indicatorRiskCount: 0,
  indicatorCriticalCount: 0,
  activeManagerInterventions: 0,
  crossFunctionalReviewCompleted: false,
  riskImproved: true,
  daysToClose: 80,
  missingEvidence: [] as string[],
};

describe("evidence forecast", () => {
  it("separates probability, confidence, and official human categories", () => {
    const healthy = assessForecast(base);
    expect(healthy.arosCategory).toBe("LIKELY");
    expect(healthy.confidence).toBe("HIGH");
    expect(healthy.probability).toBeGreaterThan(80);
  });

  it("explains deterioration and detects commit discrepancies", () => {
    const result = assessForecast({
      ...base,
      securityOrProcurementBlocker: true,
      blockerDays: 21,
      missedCommitments: 2,
      executiveEngagementDeclining: true,
      activeManagerInterventions: 1,
      crossFunctionalReviewCompleted: true,
      riskImproved: false,
      daysToClose: 40,
      previousProbability: 82,
    });
    expect(result.arosCategory).toBe("HIGH_RISK");
    expect(result.probability).toBeLessThan(72);
    expect(result.discrepancyTypes).toEqual(
      expect.arrayContaining([
        "SELLER_AROS_DISAGREEMENT",
        "MANAGER_AROS_DISAGREEMENT",
        "LARGE_PROBABILITY_DROP",
      ]),
    );
    expect(result.negativeEvidence.join(" ")).toMatch(/security|commitments/i);
  });

  it("reduces confidence when evidence is missing", () => {
    expect(
      assessForecast({
        ...base,
        missingEvidence: ["economic buyer", "security date", "decision date"],
      }).confidence,
    ).toBe("LOW");
  });

  it("uses leading-indicator deterioration as evidence without changing human categories", () => {
    const result = assessForecast({
      ...base,
      indicatorRiskCount: 3,
      indicatorCriticalCount: 1,
    });
    expect(result.negativeEvidence.join(" ")).toMatch(/leading indicator|critical/i);
    expect(result.discrepancyTypes).toContain("SELLER_AROS_DISAGREEMENT");
  });

  it("rolls up each opportunity once", () => {
    const item = {
      opportunityId: "opp-1",
      amount: 10_000_000,
      sellerCategory: "COMMIT" as const,
      managerCategory: "COMMIT" as const,
      probability: 60,
      arosCategory: "HIGH_RISK" as const,
    };
    const rollup = rollUpForecast([item, item]);
    expect(rollup.opportunityCount).toBe(1);
    expect(rollup.sellerCommit).toBe(10_000_000);
    expect(rollup.evidenceWeighted).toBe(6_000_000);
  });
});
