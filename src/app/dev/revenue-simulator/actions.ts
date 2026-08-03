"use server";

import { notFound } from "next/navigation";
import type { SimulationSession } from "@/domain/simulation/types";
import { createFilesystemSimulationRepository } from "@/revenue-simulator/persistence";
import { createCoinbaseQualityFixture } from "@/data/ai-quality-fixtures/coinbase-renewal";
import { runRealCoinbaseRenewalAction } from "@/app/dev/provider-readiness/actions";
import {
  createPreRunCostEstimate,
  createSimulationStepAnalytics,
  defaultSimulationBudgetPolicy,
  developmentPricingCatalog,
} from "@/revenue-simulator/analytics";

function repository() {
  if (process.env.NODE_ENV === "production") notFound();
  return createFilesystemSimulationRepository();
}

export async function saveSimulationSessionAction(session: SimulationSession) {
  if (
    session.accountId !== "acct-coinbase" ||
    session.metadata.synthetic !== true ||
    !session.scenarioId.startsWith("coinbase-")
  ) {
    return { success: false, message: "Rejected invalid simulation session." };
  }
  await repository().saveSession(session);
  return { success: true, message: `Saved ${session.sessionId}.` };
}

export async function loadSimulationSessionAction(sessionId: string) {
  if (!/^[a-zA-Z0-9._:-]+$/.test(sessionId)) {
    return { success: false, message: "Invalid session ID." } as const;
  }
  const session = await repository().loadSession(sessionId);
  return session
    ? { success: true, message: `Loaded ${sessionId}.`, session }
    : { success: false, message: `Session ${sessionId} was not found.` };
}

export async function estimateLiveSimulationAction(
  confirmed: boolean,
  currentSessionCostUsd = 0,
) {
  if (process.env.NODE_ENV === "production") notFound();
  const fixture = createCoinbaseQualityFixture();
  return createPreRunCostEstimate({
    promptPackage: fixture.promptPackage,
    providerId: "openai-development",
    modelId: "gpt-5.6-sol",
    currentSessionCostUsd,
    catalog: developmentPricingCatalog,
    budgetPolicy: defaultSimulationBudgetPolicy,
    confirmed,
    now: fixture.sample.completedAt,
  });
}

export async function runLiveSimulationAnalyticsAction({
  confirmed,
  currentSessionCostUsd,
}: {
  confirmed: boolean;
  currentSessionCostUsd: number;
}) {
  if (process.env.NODE_ENV === "production") notFound();
  const estimate = await estimateLiveSimulationAction(confirmed, currentSessionCostUsd);
  if (!estimate.budget.allowed) {
    return {
      success: false,
      message: estimate.budget.blockingReasons.join(" "),
      estimate,
    };
  }
  const result = await runRealCoinbaseRenewalAction(confirmed);
  if (!result.success || !result.response || !result.evaluation) {
    return {
      success: false,
      message: result.errors.map((item) => item.message).join(" ") || "Live run failed closed.",
      estimate,
    };
  }
  const analytics = createSimulationStepAnalytics({
    executionMode: "real-provider-development",
    providerId: result.response.provider,
    modelId: result.response.model,
    promptPackage: createCoinbaseQualityFixture().promptPackage,
    response: result.response,
    evaluation: result.evaluation,
    currentSessionCostUsd,
    baselineQuality: createCoinbaseQualityFixture().report.overallScore,
    catalog: developmentPricingCatalog,
    budgetPolicy: defaultSimulationBudgetPolicy,
    liveConfirmed: confirmed,
    now: result.response.createdAt,
  });
  return {
    success: true,
    message: "Readiness-gated Coinbase live run completed.",
    estimate,
    analytics,
  };
}
