import { describe, expect, it } from "vitest";
import { createCoinbaseQualityFixture } from "@/data/ai-quality-fixtures/coinbase-renewal";
import { getSimulationScenario } from "@/data/simulation-scenarios/coinbase-renewal";
import { normalizeLLMResponse } from "@/llm-provider";
import {
  aggregateSimulationAnalytics,
  attachSimulationAnalytics,
  calculateLLMCost,
  calculateNumericStatistics,
  compareCostQuality,
  createPreRunCostEstimate,
  createSimulationStepAnalytics,
  defaultSimulationBudgetPolicy,
  developmentPricingCatalog,
  evaluateSimulationBudget,
  getModelPricing,
} from "@/revenue-simulator/analytics";
import {
  createInMemorySimulationRepository,
  runRevenueSimulation,
} from "@/revenue-simulator";

const now = "2026-08-04T16:00:00.000Z";
const fixture = createCoinbaseQualityFixture();
const reportedResponse = normalizeLLMResponse({
  requestId: "analytics-request",
  provider: "openai-development",
  model: "gpt-5.6-sol",
  rawOutput: fixture.candidate,
  format: "json-object",
  latencyMs: 1_250,
  usage: { inputTokens: 10_000, outputTokens: 1_000, totalTokens: 11_000, estimated: false },
  createdAt: now,
});

describe("Revenue Simulator cost, latency, and quality analytics", () => {
  it("selects versioned effective pricing by provider and model", () => {
    const price = getModelPricing({
      providerId: "openai-development",
      modelId: "gpt-5.6-sol",
      at: now,
      catalog: developmentPricingCatalog,
    });
    expect(price?.pricingId).toBe("openai-development-gpt-5.6-sol-2026-v1");
    expect(price?.source).toBe("development-configuration");
  });

  it("forces deterministic incremental API cost and provider usage to zero", () => {
    const cost = calculateLLMCost({
      executionMode: "deterministic",
      providerId: "deterministic",
      modelId: "rule-reasoner-v1",
      at: now,
      catalog: developmentPricingCatalog,
      promptPackage: fixture.promptPackage,
    });
    expect(cost.incrementalCostUsd).toBe(0);
    expect(cost.usage.totalTokens).toBe(0);
    expect(cost.usage.newProviderCall).toBe(false);
    expect(cost.classification).toBe("zero-incremental");
  });

  it("prices provider-reported live usage with the versioned catalog", () => {
    const cost = calculateLLMCost({
      executionMode: "real-provider-development",
      providerId: reportedResponse.provider,
      modelId: reportedResponse.model,
      at: now,
      catalog: developmentPricingCatalog,
      response: reportedResponse,
    });
    expect(cost.incrementalCostUsd).toBe(0.03);
    expect(cost.usage.provenance).toBe("provider-reported");
    expect(cost.usage.estimated).toBe(false);
    expect(cost.pricingVersion).toBe("1.0.0");
  });

  it("uses clearly labeled PromptPackage estimates before a live call", () => {
    const estimate = createPreRunCostEstimate({
      promptPackage: fixture.promptPackage,
      providerId: "openai-development",
      modelId: "gpt-5.6-sol",
      currentSessionCostUsd: 0,
      catalog: developmentPricingCatalog,
      budgetPolicy: defaultSimulationBudgetPolicy,
      confirmed: false,
      now,
    });
    expect(estimate.usage.estimated).toBe(true);
    expect(estimate.cost.usage.provenance).toBe("prompt-estimate");
    expect(estimate.budget.allowed).toBe(false);
    expect(estimate.budget.blockingReasons.join(" ")).toContain("Explicit confirmation");
    const confirmed = createPreRunCostEstimate({
      promptPackage: fixture.promptPackage,
      providerId: "openai-development",
      modelId: "gpt-5.6-sol",
      currentSessionCostUsd: 0,
      catalog: developmentPricingCatalog,
      budgetPolicy: defaultSimulationBudgetPolicy,
      confirmed: true,
      now,
    });
    expect(confirmed.budget.allowed).toBe(true);
  });

  it("keeps replay incremental cost at zero and separates historical original cost", () => {
    const historicalUsage = {
      inputTokens: 10_000,
      outputTokens: 1_000,
      totalTokens: 11_000,
      estimated: false,
    };
    const cost = calculateLLMCost({
      executionMode: "replay",
      providerId: "openai-development",
      modelId: "gpt-5.6-sol",
      at: now,
      catalog: developmentPricingCatalog,
      historicalUsage,
    });
    expect(cost.incrementalCostUsd).toBe(0);
    expect(cost.historicalOriginalCostUsd).toBe(0.03);
    expect(cost.usage.provenance).toBe("recorded-original");
    expect(cost.usage.newProviderCall).toBe(false);
  });

  it("fails closed for missing pricing and exceeded budgets", () => {
    const unavailable = calculateLLMCost({
      executionMode: "real-provider-development",
      providerId: "unknown",
      modelId: "unknown",
      at: now,
      catalog: developmentPricingCatalog,
      response: reportedResponse,
    });
    const budget = evaluateSimulationBudget({
      cost: unavailable,
      usage: unavailable.usage,
      currentSessionCostUsd: 0,
      policy: defaultSimulationBudgetPolicy,
      liveConfirmed: true,
    });
    expect(unavailable.classification).toBe("unavailable");
    expect(budget.allowed).toBe(false);
    expect(budget.blockingReasons.join(" ")).toContain("Pricing is unavailable");
  });

  it("combines quality, grounding, eligibility, latency, retries, and cost", () => {
    const analytics = createSimulationStepAnalytics({
      executionMode: "real-provider-development",
      providerId: reportedResponse.provider,
      modelId: reportedResponse.model,
      promptPackage: fixture.promptPackage,
      response: reportedResponse,
      evaluation: fixture.sample.evaluation,
      baselineQuality: fixture.report.overallScore - 2,
      contextBuildMs: 10,
      orchestrationMs: 5,
      catalog: developmentPricingCatalog,
      budgetPolicy: defaultSimulationBudgetPolicy,
      liveConfirmed: true,
      now,
    });
    expect(analytics.quality.overallScore).toBe(fixture.sample.evaluation?.overallScore);
    expect(analytics.quality.groundingScore).toBeGreaterThan(0);
    expect(analytics.quality.eligibilityScore).toBe(100);
    expect(analytics.latency.providerMs).toBe(1_250);
    expect(analytics.latency.totalMs).toBeGreaterThan(1_250);
    expect(analytics.efficiency.qualityDeltaFromBaseline).toBeGreaterThanOrEqual(0);
  });

  it("calculates stable repeated-run statistics and session aggregation", () => {
    expect(calculateNumericStatistics([100, 200, 300])).toEqual({
      count: 3,
      mean: 200,
      variance: 6666.666666666667,
      standardDeviation: 81.64965809277261,
      minimum: 100,
      maximum: 300,
    });
    const one = createSimulationStepAnalytics({
      executionMode: "real-provider-development",
      providerId: reportedResponse.provider,
      modelId: reportedResponse.model,
      response: reportedResponse,
      evaluation: fixture.sample.evaluation,
      catalog: developmentPricingCatalog,
      budgetPolicy: defaultSimulationBudgetPolicy,
      liveConfirmed: true,
      now,
    });
    const aggregate = aggregateSimulationAnalytics([one, one]);
    expect(aggregate.providerCallCount).toBe(2);
    expect(aggregate.totalIncrementalCostUsd).toBe(0.06);
    expect(aggregate.totalTokens).toBe(22_000);
    expect(aggregate.averageQualityScore).toBe(fixture.sample.evaluation?.overallScore);
    const baseline = createSimulationStepAnalytics({
      executionMode: "deterministic",
      providerId: "deterministic",
      modelId: "rule-reasoner-v1",
      evaluation: { ...fixture.sample.evaluation!, overallScore: fixture.sample.evaluation!.overallScore - 2 },
      catalog: developmentPricingCatalog,
      budgetPolicy: defaultSimulationBudgetPolicy,
      liveConfirmed: false,
      now,
    });
    const comparison = compareCostQuality({ baseline, candidate: one });
    expect(comparison.qualityDelta).toBe(2);
    expect(comparison.verdict).toBe("higher-quality-higher-cost");
  });

  it("annotates deterministic and replay sessions and persists replay economics", async () => {
    const scenario = getSimulationScenario("coinbase-champion-leaves")!;
    const deterministic = (await runRevenueSimulation({ scenario })).session;
    expect(deterministic.analytics?.totalIncrementalCostUsd).toBe(0);
    expect(deterministic.simulationSteps[0]?.analytics?.usage.totalTokens).toBe(0);

    const replay = (
      await runRevenueSimulation({ scenario, executionMode: "replay" })
    ).session;
    expect(replay.analytics?.totalIncrementalCostUsd).toBe(0);
    expect(replay.analytics?.totalHistoricalReplayCostUsd).toBeGreaterThan(0);
    expect(replay.simulationSteps[0]?.analytics?.usage.newProviderCall).toBe(false);

    const repository = createInMemorySimulationRepository();
    await repository.saveSession(attachSimulationAnalytics(replay));
    const loaded = await repository.loadSession(replay.sessionId);
    expect(loaded?.analytics).toEqual(replay.analytics);
    expect(JSON.stringify(loaded).toLowerCase()).not.toContain("authorization");
  });
});
