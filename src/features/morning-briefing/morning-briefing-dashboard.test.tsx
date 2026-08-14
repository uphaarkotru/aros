import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";
import { MorningBriefingDashboard as PersistedDashboard } from "./morning-briefing-dashboard";
import {governedDecisions} from "./data";
const MorningBriefingDashboard=()=> <PersistedDashboard initialDecisions={governedDecisions}/>;

async function openCoinbase() {
  await userEvent.click(screen.getByRole("button", { name: /view details for coinbase renewal risk/i }));
  return screen.getByRole("dialog", { name: /coinbase renewal risk increased/i });
}

describe("MorningBriefingDashboard", () => {
  it("renders the five metric cards", () => {
    render(<MorningBriefingDashboard />);
    const metrics = screen.getByRole("region", { name: /morning metrics/i });
    expect(within(metrics).getAllByRole("article")).toHaveLength(5);
    expect(within(metrics).getByText("Signals Processed")).toBeVisible();
  });

  it("renders three intelligence items", () => {
    render(<MorningBriefingDashboard />);
    expect(screen.getAllByRole("button", { name: /view details for/i })).toHaveLength(3);
  });

  it("opens an insight detail panel when selected", async () => {
    render(<MorningBriefingDashboard />);
    const dialog = await openCoinbase();
    expect(within(dialog).getByText("$22.4M ARR at risk")).toBeVisible();
    expect(within(dialog).getByText(/95% · Evidence/)).toBeVisible();
  });

  it("approves an insight", async () => {
    render(<MorningBriefingDashboard />);
    const dialog = await openCoinbase();
    await userEvent.click(within(dialog).getByRole("button", { name: "Approve" }));
    expect(within(dialog).getByText("Ready For Execution")).toBeVisible();
  });

  it("edits and saves an insight recommendation", async () => {
    render(<MorningBriefingDashboard />);
    const dialog = await openCoinbase();
    await userEvent.click(within(dialog).getByRole("button", { name: "Edit recommendation" }));
    const field = within(dialog).getByLabelText("Edit recommendation");
    await userEvent.clear(field);
    await userEvent.type(field, "Schedule an executive alignment tomorrow.");
    await userEvent.click(within(dialog).getByRole("button", { name: "Save recommendation" }));
    expect(within(dialog).getByText("Schedule an executive alignment tomorrow.")).toBeVisible();
  });

  it("dismisses an insight", async () => {
    render(<MorningBriefingDashboard />);
    const dialog = await openCoinbase();
    await userEvent.click(within(dialog).getByRole("button", { name: "Dismiss" }));
    expect(within(dialog).getByText("Dismissed")).toBeVisible();
  });

  it("snoozes an insight", async () => {
    render(<MorningBriefingDashboard />);
    const dialog = await openCoinbase();
    await userEvent.click(within(dialog).getByRole("button", { name: "Snooze" }));
    expect(within(dialog).getByText("Snoozed")).toBeVisible();
  });

  it("opens the decision queue with eight decisions", async () => {
    render(<MorningBriefingDashboard />);
    await userEvent.click(screen.getByRole("button", { name: /review decision queue/i }));
    const dialog = screen.getByRole("dialog", { name: "Decision queue" });
    expect(within(dialog).getAllByRole("article")).toHaveLength(8);
  });

  it("closes a dialog with Escape", async () => {
    render(<MorningBriefingDashboard />);
    await openCoinbase();
    await userEvent.keyboard("{Escape}");
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("supports keyboard access for key actions", async () => {
    const user = userEvent.setup();
    render(<MorningBriefingDashboard />);
    const insight = screen.getByRole("button", { name: /view details for coinbase/i });
    insight.focus();
    await user.keyboard("{Enter}");
    const dialog = screen.getByRole("dialog");
    const approve = within(dialog).getByRole("button", { name: "Approve" });
    approve.focus();
    await user.keyboard(" ");
    expect(within(dialog).getByText("Ready For Execution")).toBeVisible();
  });

  it("shows dynamic queue metrics from governed decisions", async () => {
    render(<MorningBriefingDashboard />);
    expect(screen.getByText("8")).toBeVisible();
    expect(screen.getByText(/high impact · .* influenced/i)).toBeVisible();
  });

  it("simulates execution after approval", async () => {
    render(<MorningBriefingDashboard />);
    const dialog = await openCoinbase();
    await userEvent.click(within(dialog).getByRole("button", { name: "Approve" }));
    await userEvent.click(within(dialog).getByRole("button", { name: "Simulate execution" }));
    expect(within(dialog).getByText("Executed")).toBeVisible();
    expect(screen.getByText("Execution simulated and audited.")).toBeVisible();
  });
});
