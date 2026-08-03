import type { SimulationScenario } from "@/domain/simulation/types";
import { revenueSimulatorConfig } from "./config";

function containsSensitiveMaterial(value: unknown): boolean {
  if (!value || typeof value !== "object") {
    return (
      typeof value === "string" &&
      /(bearer\s|authorization:|api[_-]?key|client_secret)/i.test(value)
    );
  }
  return Object.entries(value as Record<string, unknown>).some(
    ([key, item]) =>
      [
        "authorization",
        "apikey",
        "api_key",
        "password",
        "secret",
        "credentials",
        "headers",
      ].includes(key.toLowerCase()) || containsSensitiveMaterial(item),
  );
}

export function exportScenario(scenario: SimulationScenario): string {
  const value = JSON.stringify(scenario, null, 2);
  if (value.length > revenueSimulatorConfig.storage.maximumImportBytes) {
    throw new Error("scenario-export-too-large");
  }
  if (containsSensitiveMaterial(scenario)) {
    throw new Error("simulation-sensitive-material-detected");
  }
  return value;
}

export function importScenario(value: string): SimulationScenario {
  if (value.length > revenueSimulatorConfig.storage.maximumImportBytes) {
    throw new Error("scenario-import-too-large");
  }
  const parsed = JSON.parse(value) as SimulationScenario;
  if (
    !parsed.scenarioId ||
    !parsed.metadata?.synthetic ||
    parsed.accountId !== "acct-coinbase"
  ) {
    throw new Error("invalid-simulation-scenario");
  }
  if (containsSensitiveMaterial(parsed)) {
    throw new Error("simulation-sensitive-material-detected");
  }
  return parsed;
}
