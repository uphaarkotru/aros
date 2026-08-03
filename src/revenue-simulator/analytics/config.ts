import type {
  PricingCatalog,
  SimulationBudgetPolicy,
} from "@/domain/simulation/analytics-types";

export const simulationAnalyticsConfig = {
  analyticsVersion: "revenue-simulator-analytics-v1",
  pricingCatalogVersion: "development-pricing-catalog-v1",
  currencyPrecision: 6,
  qualityPointPrecision: 2,
} as const;

export const developmentPricingCatalog: PricingCatalog = {
  catalogVersion: simulationAnalyticsConfig.pricingCatalogVersion,
  prices: [
    {
      pricingId: "openai-development-gpt-5.6-sol-2026-v1",
      providerId: "openai-development",
      modelId: "gpt-5.6-sol",
      currency: "USD",
      inputUsdPerMillionTokens: 2,
      outputUsdPerMillionTokens: 10,
      effectiveFrom: "2026-01-01T00:00:00.000Z",
      version: "1.0.0",
      source: "development-configuration",
      notes: [
        "Development planning assumption; verify against the provider billing schedule before use.",
        "Configured token pricing is not an invoice or provider-reported dollar charge.",
      ],
    },
  ],
};

export const defaultSimulationBudgetPolicy: SimulationBudgetPolicy = {
  policyVersion: "simulation-budget-policy-v1",
  maximumEstimatedCostPerCallUsd: 0.25,
  maximumSessionCostUsd: 2,
  maximumInputTokens: 24_000,
  maximumOutputTokens: 4_000,
  requireExplicitLiveConfirmation: true,
  blockWhenPricingUnavailable: true,
};
