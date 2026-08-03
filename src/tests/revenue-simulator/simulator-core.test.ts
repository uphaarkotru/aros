import { describe, expect, it } from "vitest";
import {
  advanceSimulationClock,
  createSimulationClock,
  createSimulationEvent,
  createSimulationSession,
  getSimulationStateAtStep,
  injectSimulationEvent,
  runRevenueSimulation,
  simulationEventToSourceRecords,
} from "@/revenue-simulator";
import {
  coinbaseSimulationScenarios,
  defaultSimulationScenario,
  getSimulationScenario,
} from "@/data/simulation-scenarios/coinbase-renewal";
import { validateSourceRecords } from "@/evidence-reconciliation";

describe("Revenue Simulator core", () => {
  it("creates a Coinbase session with an immutable baseline", () => {
    const session = createSimulationSession({ scenario: defaultSimulationScenario });
    expect(session.accountName).toBe("Coinbase");
    expect(session.baselineState.accountDigitalTwin.accountId).toBe("acct-coinbase");
    expect(session.currentState).not.toBe(session.baselineState);
  });

  it("advances a deterministic clock and prevents backward movement", () => {
    const clock = createSimulationClock("2026-08-03T16:00:00.000Z");
    expect(advanceSimulationClock(clock, 2, "days").currentTime).toBe(
      "2026-08-05T16:00:00.000Z",
    );
    expect(() =>
      advanceSimulationClock(clock, -1, "hours"),
    ).toThrow("simulation-clock-cannot-move-backward");
  });

  it.each([
    "champion-left",
    "product-usage-declined",
    "security-review-stalled",
    "security-review-approved",
    "executive-meeting-completed",
    "procurement-delayed",
    "external-news-risk",
  ] as const)("creates validated source records for %s", (eventType) => {
    const event = createSimulationEvent({
      eventType,
      accountId: "acct-coinbase",
      effectiveAt: "2026-08-04T16:00:00.000Z",
      payload: eventType === "product-usage-declined" ? { percentageChange: -0.18 } : {},
    });
    const records = simulationEventToSourceRecords(event, {
      activeUsers: 800,
      licensedUsers: 1_000,
      adoptionRate: 0.8,
      renewalDate: "2026-12-01T00:00:00.000Z",
      annualContractValue: 25_000_000,
    });
    const result = validateSourceRecords({
      records,
      accountIds: ["acct-coinbase"],
      now: event.effectiveAt,
    });
    expect(records.length).toBeGreaterThan(0);
    expect(result.acceptedRecords).toHaveLength(records.length);
  });

  it("rejects duplicate event injection", () => {
    const scenario = getSimulationScenario("coinbase-champion-leaves")!;
    const session = createSimulationSession({ scenario });
    const event = scenario.predefinedEvents[0]!;
    expect(() => injectSimulationEvent(session, event)).toThrow(
      "duplicate-simulation-event",
    );
  });

  it("runs every Coinbase scenario through reconciliation and governance", async () => {
    for (const scenario of coinbaseSimulationScenarios) {
      const result = await runRevenueSimulation({ scenario });
      expect(result.completed, scenario.scenarioId).toBe(true);
      expect(result.session.status, scenario.scenarioId).toBe("completed");
      expect(result.session.diagnostics.errors, scenario.scenarioId).toEqual([]);
      for (const step of result.session.simulationSteps) {
        expect(step.addedSourceRecordIds.length).toBeGreaterThan(0);
        expect(step.contextBuildResult.context).toBeDefined();
        expect(step.evaluationResult).toBeDefined();
      }
    }
  }, 30_000);

  it("runs the simulated week and supports baseline and intermediate Time Machine views", async () => {
    const result = await runRevenueSimulation({ scenario: defaultSimulationScenario });
    expect(result.session.simulationSteps).toHaveLength(4);
    expect(getSimulationStateAtStep(result.session, "baseline").asOf).toBe(
      result.session.baselineState.asOf,
    );
    expect(getSimulationStateAtStep(result.session, 2).asOf).toBe(
      result.session.simulationSteps[1]!.simulatedTime,
    );
    expect(result.session.currentState.sourceRecords.length).toBeGreaterThan(
      result.session.baselineState.sourceRecords.length,
    );
  });

  it("responds proportionally to champion loss, usage decline, and security approval", async () => {
    const champion = (
      await runRevenueSimulation({
        scenario: getSimulationScenario("coinbase-champion-leaves")!,
      })
    ).session.simulationSteps[0]!;
    expect(champion.afterSnapshot.relationshipScore).toBeLessThan(
      champion.beforeSnapshot.relationshipScore,
    );
    expect(
      champion.state.decisionCandidates.some((item) =>
        item.proposedTitle.toLowerCase().includes("lost"),
      ),
    ).toBe(false);

    const usage = (
      await runRevenueSimulation({
        scenario: getSimulationScenario("coinbase-usage-drops")!,
      })
    ).session.simulationSteps[0]!;
    expect(usage.state.accountDigitalTwin.productUsage[0]?.usageTrend).toBe("declining");

    const security = (
      await runRevenueSimulation({
        scenario: getSimulationScenario("coinbase-security-approved")!,
      })
    ).session.simulationSteps[0]!;
    expect(security.state.accountDigitalTwin.renewalProfile?.securityReviewStatus).toBe(
      "approved",
    );
  });

  it("introduces conflicting renewal evidence without silently discarding lineage", async () => {
    const step = (
      await runRevenueSimulation({
        scenario: getSimulationScenario("coinbase-renewal-conflict")!,
      })
    ).session.simulationSteps[0]!;
    expect(step.state.resolvedAccountContext.conflicts.length).toBeGreaterThan(0);
    expect(step.addedSourceRecordIds).toHaveLength(1);
    expect(step.state.accountDigitalTwin.reconciliation).toBeDefined();
  });

  it("fails closed when real-provider development mode bypasses readiness", async () => {
    const result = await runRevenueSimulation({
      scenario: getSimulationScenario("coinbase-champion-leaves")!,
      executionMode: "real-provider-development",
    });
    expect(result.completed).toBe(false);
    expect(result.session.status).toBe("failed");
    expect(result.errors.join(" ")).toContain("readiness-gated");
  });
});
