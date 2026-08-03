import type {
  ModelPricingDefinition,
  PricingCatalog,
} from "@/domain/simulation/analytics-types";

export function getModelPricing({
  providerId,
  modelId,
  at,
  catalog,
}: {
  providerId: string;
  modelId: string;
  at: string;
  catalog: PricingCatalog;
}): ModelPricingDefinition | undefined {
  const timestamp = Date.parse(at);
  if (Number.isNaN(timestamp)) throw new Error("invalid-pricing-time");
  return [...catalog.prices]
    .filter(
      (item) =>
        item.providerId === providerId &&
        item.modelId === modelId &&
        Date.parse(item.effectiveFrom) <= timestamp &&
        (!item.effectiveTo || Date.parse(item.effectiveTo) > timestamp),
    )
    .sort(
      (left, right) =>
        right.effectiveFrom.localeCompare(left.effectiveFrom) ||
        right.version.localeCompare(left.version),
    )[0];
}
