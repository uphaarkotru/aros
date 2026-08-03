import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { defaultSimulationScenario } from "@/data/simulation-scenarios/coinbase-renewal";
import { createSimulationSession } from "@/revenue-simulator/runner";
import { RevenueSimulatorWorkspace } from "./revenue-simulator-workspace";

vi.mock("@/app/dev/revenue-simulator/actions", () => ({
  saveSimulationSessionAction: vi.fn(async () => ({
    success: true,
    message: "Saved simulation.",
  })),
  loadSimulationSessionAction: vi.fn(async () => ({
    success: false,
    message: "Not found.",
  })),
  estimateLiveSimulationAction: vi.fn(async (confirmed: boolean) => ({
    providerId: "openai-development",
    modelId: "gpt-5.6-sol",
    usage: { inputTokens: 1000, outputTokens: 500, totalTokens: 1500, estimated: true },
    cost: {
      incrementalCostUsd: 0.007,
      classification: "configured-estimate",
      pricingVersion: "1.0.0",
      usage: { inputTokens: 1000, outputTokens: 500, totalTokens: 1500, provenance: "prompt-estimate", estimated: true, newProviderCall: true },
      explanation: "Estimated",
    },
    budget: { allowed: confirmed, estimatedCostUsd: 0.007, projectedSessionCostUsd: 0.007, warnings: [], blockingReasons: confirmed ? [] : ["Explicit confirmation required"], policyVersion: "simulation-budget-policy-v1" },
    disclaimer: "Estimate",
  })),
  runLiveSimulationAnalyticsAction: vi.fn(async () => ({
    success: false,
    message: "Live run failed closed.",
    estimate: undefined,
  })),
}));

describe("Revenue Simulator workspace", () => {
  const renderWorkspace = () =>
    render(
      <RevenueSimulatorWorkspace
        initialSession={createSimulationSession({
          scenario: defaultSimulationScenario,
        })}
      />,
    );

  it("renders the scenario, mode, event form, Time Machine, and review controls", () => {
    renderWorkspace();
    expect(screen.getByRole("heading", { name: "Revenue Simulator" })).toBeInTheDocument();
    expect(screen.getByLabelText("Scenario")).toHaveValue("coinbase-one-week");
    expect(screen.getByLabelText("Execution mode")).toHaveValue("deterministic");
    expect(screen.getByLabelText("Event type")).toHaveValue("champion-left");
    expect(screen.getByText("TIME MACHINE")).toBeInTheDocument();
    expect(screen.getByText("Senior AE scorecard")).toBeInTheDocument();
    expect(screen.getByText("Cost, latency & quality")).toBeInTheDocument();
    expect(screen.getByText("Pre-run estimate and budget gate")).toBeInTheDocument();
  });

  it("requires explicit confirmation before a live development call", async () => {
    renderWorkspace();
    const run = screen.getByRole("button", { name: "Run approved live Coinbase scenario" });
    expect(run).toBeDisabled();
    fireEvent.click(
      screen.getByLabelText(
        "I explicitly approve one readiness-gated, billable development call.",
      ),
    );
    await waitFor(() => expect(run).toBeEnabled());
    fireEvent.click(run);
    await waitFor(() => expect(screen.getByText("Live run failed closed.")).toBeInTheDocument());
  });

  it("changes the typed event form and queues an event", () => {
    renderWorkspace();
    fireEvent.change(screen.getByLabelText("Event type"), {
      target: { value: "product-usage-declined" },
    });
    fireEvent.change(screen.getByLabelText("Event-specific value"), {
      target: { value: "-18" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Add to queue" }));
    expect(screen.getAllByText("Product Usage Declined").length).toBeGreaterThan(1);
  });

  it("runs all events and renders before/after assertions", async () => {
    renderWorkspace();
    fireEvent.click(screen.getByRole("button", { name: "Run all events" }));
    await waitFor(() => expect(screen.getByText("BEFORE / AFTER")).toBeInTheDocument());
    expect(screen.getByText("Expected-behavior assertions")).toBeInTheDocument();
    expect(screen.getByLabelText("Time Machine step")).toHaveValue("4");
  });

  it("resets the completed simulation and preserves the baseline", async () => {
    renderWorkspace();
    fireEvent.click(screen.getByRole("button", { name: "Run next step" }));
    await waitFor(() => expect(screen.getByText("BEFORE / AFTER")).toBeInTheDocument());
    fireEvent.click(screen.getByRole("button", { name: "Reset" }));
    expect(screen.getByText("Known Coinbase baseline loaded")).toBeInTheDocument();
    expect(screen.getByLabelText("Time Machine step")).toHaveValue("baseline");
  });

  it("exports a scenario and persists through the server action", async () => {
    renderWorkspace();
    fireEvent.click(screen.getByRole("button", { name: "Export scenario JSON" }));
    expect(
      (screen.getByLabelText("Scenario import and export") as HTMLTextAreaElement).value,
    ).toContain('"scenarioId": "coinbase-one-week"');
    fireEvent.click(screen.getByRole("button", { name: "Save session" }));
    await waitFor(() => expect(screen.getByText("Saved simulation.")).toBeInTheDocument());
  });
});
