import { describe, expect, it } from "vitest";
import { createCoinbaseRenewalWorkspaceFixture } from "@/data/renewal-intelligence-fixtures/coinbase";
import { buildRenewalWorkspace } from "@/renewal-intelligence";
describe("Renewal Intelligence Workspace selectors", () => {
  it("renders grounded Coinbase health and executive metrics", () => {
    const { baseline } = createCoinbaseRenewalWorkspaceFixture();
    expect(baseline.accountName).toBe("Coinbase");
    expect(baseline.executiveSummary.healthScore).toBeGreaterThan(0);
    expect(baseline.executiveSummary.arr).toBeGreaterThan(20_000_000);
    expect(baseline.executiveSummary.revenueAtRisk).toBeGreaterThan(0);
    expect(baseline.executiveSummary.evaluationScore).toBeGreaterThanOrEqual(
      90,
    );
  });
  it("ranks declining health drivers before stable drivers with evidence and impact", () => {
    const { baseline } = createCoinbaseRenewalWorkspaceFixture();
    expect(baseline.healthDrivers[0]?.trend).toBe("declining");
    expect(
      baseline.healthDrivers.every(
        (item) => item.businessImpact && item.confidence > 0,
      ),
    ).toBe(true);
    expect(
      baseline.healthDrivers.some((item) => item.evidenceIds.length > 0),
    ).toBe(true);
  });
  it("maps all eight MEDDPICC sections without counting partial evidence as complete", () => {
    const { baseline } = createCoinbaseRenewalWorkspaceFixture();
    expect(baseline.meddpicc.coverage).toBe(75);
    expect(baseline.meddpicc.sections).toHaveLength(8);
    for (const section of baseline.meddpicc.sections) {
      expect(section.coverage).toBeGreaterThanOrEqual(0);
      expect(section.confidence).toBeGreaterThanOrEqual(0);
      expect(section.recommendedAction).toBeTruthy();
      expect(Array.isArray(section.supportingEvidence)).toBe(true);
      expect(Array.isArray(section.missingInformation)).toBe(true);
    }
  });
  it("calculates all nine leading indicators", () => {
    const { baseline } = createCoinbaseRenewalWorkspaceFixture();
    expect(baseline.leadingIndicators.map((item) => item.id)).toEqual([
      "executive-engagement",
      "champion-strength",
      "usage-momentum",
      "support-health",
      "buying-committee-coverage",
      "security-readiness",
      "legal-readiness",
      "procurement-readiness",
      "technical-validation",
    ]);
    expect(
      baseline.leadingIndicators.every(
        (item) => item.currentValue && item.previousValue && item.direction,
      ),
    ).toBe(true);
  });
  it("orders recommendations by Decision Control priority and retains quality controls", () => {
    const { baseline } = createCoinbaseRenewalWorkspaceFixture();
    expect(baseline.plays.length).toBeGreaterThan(0);
    for (let index = 1; index < baseline.plays.length; index++)
      expect(
        baseline.plays[index - 1]!.governedDecision.priorityScore,
      ).toBeGreaterThanOrEqual(
        baseline.plays[index]!.governedDecision.priorityScore,
      );
    expect(baseline.plays[0]?.supportingEvidence.length).toBeGreaterThan(0);
    expect(baseline.plays[0]?.aiConfidence).toBeGreaterThan(0);
    expect(baseline.plays[0]?.evaluationScore).toBeGreaterThan(0);
  });
  it("builds recent and upcoming timeline entries and concise narrative", () => {
    const { baseline } = createCoinbaseRenewalWorkspaceFixture();
    expect(baseline.timeline.some((item) => item.upcoming)).toBe(true);
    expect(baseline.timeline.some((item) => !item.upcoming)).toBe(true);
    expect(baseline.narrative.whatChanged.length).toBeLessThanOrEqual(3);
    expect(baseline.narrative.biggestRisks.length).toBeGreaterThan(0);
    expect(baseline.narrative.whatToDoToday[0]).toBe(
      baseline.plays[0]?.recommendedAction,
    );
  });
  it("replays through the artifact store without provider access and exposes regression state", () => {
    const { replay, replayWorkspace, artifact } =
      createCoinbaseRenewalWorkspaceFixture();
    expect(replay.parseSuccess).toBe(true);
    expect(replay.evaluationMatches).toBe(true);
    expect(replayWorkspace.mode).toBe("artifact-replay");
    expect(replayWorkspace.artifactId).toBe(artifact.artifactId);
    expect(replayWorkspace.regressionStatus).toBe("warning");
  });
  it("supports another normalized renewal twin without changing the builder", () => {
    const { twin, quality } = createCoinbaseRenewalWorkspaceFixture(),
      copy = {
        ...structuredClone(twin),
        accountId: "future-renewal",
        identity: {
          ...twin.identity,
          id: "future-renewal",
          name: "Future Design Partner",
        },
      };
    const result = buildRenewalWorkspace({
      twin: copy,
      evaluation: quality.sample.evaluation!,
      decisions: [],
    });
    expect(result.accountName).toBe("Future Design Partner");
    expect(result.leadingIndicators).toHaveLength(9);
  });
});
