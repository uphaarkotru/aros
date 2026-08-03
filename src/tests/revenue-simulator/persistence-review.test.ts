import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import type { SimulationReview } from "@/domain/simulation/types";
import { defaultSimulationScenario } from "@/data/simulation-scenarios/coinbase-renewal";
import {
  addSimulationReview,
  calculateSimulationQualityScorecard,
  createFilesystemSimulationRepository,
  createInMemorySimulationRepository,
  createSimulationSession,
  exportScenario,
  importScenario,
  replayScenario,
  runRevenueSimulation,
  runSimulationStep,
  validateSimulationReview,
} from "@/revenue-simulator";

const directories: string[] = [];
afterEach(async () => {
  for (const directory of directories.splice(0)) {
    await rm(directory, { recursive: true, force: true });
  }
});

function review(sessionId: string, stepId: string, score = 5): SimulationReview {
  return {
    reviewId: `review-${score}`,
    sessionId,
    stepId,
    reviewer: "Senior AE — Development",
    reviewedAt: "2026-08-08T16:00:00.000Z",
    recommendationCorrectness: score,
    actionability: score,
    evidenceSufficiency: score,
    businessImpactAccuracy: score,
    confidenceAppropriateness: score,
    priorityAppropriateness: score,
    changeAppropriateness: score,
    wouldTakeAction: true,
    savedTimeEstimateMinutes: 30,
    decision: "appropriate",
    flags: [],
    comments: "The change is proportional and grounded.",
  };
}

describe("Revenue Simulator persistence and review", () => {
  it("exports and imports a typed synthetic scenario without secrets", () => {
    const encoded = exportScenario(defaultSimulationScenario);
    expect(importScenario(encoded)).toEqual(defaultSimulationScenario);
    expect(encoded.toLowerCase()).not.toContain("authorization");
  });

  it("saves and loads sessions and custom scenarios in memory", async () => {
    const repository = createInMemorySimulationRepository();
    const session = createSimulationSession({ scenario: defaultSimulationScenario });
    await repository.saveSession(session);
    await repository.saveScenario(defaultSimulationScenario);
    expect((await repository.loadSession(session.sessionId))?.sessionId).toBe(
      session.sessionId,
    );
    expect(
      (await repository.loadScenario(defaultSimulationScenario.scenarioId))?.version,
    ).toBe("1.0.0");
  });

  it("persists sessions to a replaceable filesystem repository", async () => {
    const root = await mkdtemp(path.join(tmpdir(), "aros-simulation-"));
    directories.push(root);
    const repository = createFilesystemSimulationRepository({ rootDirectory: root });
    const session = createSimulationSession({ scenario: defaultSimulationScenario });
    await repository.saveSession(session);
    expect(await repository.listSessions()).toHaveLength(1);
    expect((await repository.loadSession(session.sessionId))?.accountName).toBe(
      "Coinbase",
    );
  });

  it("replays a completed session without provider credentials", async () => {
    const completed = (
      await runRevenueSimulation({ scenario: defaultSimulationScenario })
    ).session;
    const replayed = await replayScenario(completed, (session) =>
      runSimulationStep({ session, scenario: defaultSimulationScenario }),
    );
    expect(replayed.executionMode).toBe("replay");
    expect(replayed.simulationSteps).toHaveLength(completed.simulationSteps.length);
    expect(replayed.diagnostics.providerCalls).toBe(0);
    expect(replayed.currentState.snapshot.healthScore).toBe(
      completed.currentState.snapshot.healthScore,
    );
  });

  it("validates reviews and calculates a design-partner Senior AE scorecard", () => {
    const session = createSimulationSession({ scenario: defaultSimulationScenario });
    const value = review(session.sessionId, "step-1");
    expect(validateSimulationReview(value)).toEqual([]);
    const reviewed = addSimulationReview(session, value);
    const scorecard = calculateSimulationQualityScorecard(reviewed.humanReviews);
    expect(scorecard.overallScore).toBe(100);
    expect(scorecard.wouldTakeActionRate).toBe(100);
    expect(scorecard.readinessStatus).toBe("design-partner-ready");
  });

  it("rejects sensitive persistence material", async () => {
    const repository = createInMemorySimulationRepository();
    const session = createSimulationSession({ scenario: defaultSimulationScenario });
    const unsafe = {
      ...session,
      metadata: { ...session.metadata, authorization: "Bearer secret" },
    };
    await expect(repository.saveSession(unsafe as typeof session)).rejects.toThrow(
      "simulation-sensitive-material-detected",
    );
  });
});
