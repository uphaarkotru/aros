import { notFound } from "next/navigation";
import { ApplicationShell } from "@/components/application-shell";
import { defaultSimulationScenario } from "@/data/simulation-scenarios/coinbase-renewal";
import { RevenueSimulatorWorkspace } from "@/features/dev/revenue-simulator/revenue-simulator-workspace";
import { createSimulationSession } from "@/revenue-simulator/runner";
import { createCoinbaseQualityFixture } from "@/data/ai-quality-fixtures/coinbase-renewal";
import {
  createPreRunCostEstimate,
  defaultSimulationBudgetPolicy,
  developmentPricingCatalog,
} from "@/revenue-simulator/analytics";

export default function RevenueSimulatorPage() {
  if (process.env.NODE_ENV === "production") notFound();
  const session = createSimulationSession({ scenario: defaultSimulationScenario });
  const quality = createCoinbaseQualityFixture();
  const preRunEstimate = createPreRunCostEstimate({
    promptPackage: quality.promptPackage,
    providerId: "openai-development",
    modelId: "gpt-5.6-sol",
    currentSessionCostUsd: 0,
    catalog: developmentPricingCatalog,
    budgetPolicy: defaultSimulationBudgetPolicy,
    confirmed: false,
    now: quality.sample.completedAt,
  });
  return (
    <ApplicationShell active="accounts">
      <RevenueSimulatorWorkspace initialSession={session} preRunEstimate={preRunEstimate} />
    </ApplicationShell>
  );
}
