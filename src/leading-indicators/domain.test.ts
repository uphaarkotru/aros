import { describe, expect, it } from "vitest";
import { coachingForIndicator, indicatorStatusWeight } from "./domain";

describe("leading indicator domain", () => {
  it("keeps missing evidence neutral and ranks deterioration explicitly", () => {
    expect(indicatorStatusWeight.UNKNOWN).toBe(0);
    expect(indicatorStatusWeight.CRITICAL).toBeGreaterThan(
      indicatorStatusWeight.AT_RISK,
    );
  });

  it("creates coaching guidance from evidence without claiming causality", () => {
    const insight = coachingForIndicator({
      indicatorType: "EXECUTIVE_ENGAGEMENT",
      status: "AT_RISK",
      evidence: ["No CTO interaction in 45 days"],
    });
    expect(insight.title).toContain("Executive engagement");
    expect(insight.insight).toContain("No CTO interaction");
    expect(insight.suggestedAction).toContain("alignment");
  });
});
