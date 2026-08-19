import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";
import { MorningBriefingDashboard as PersistedDashboard } from "./morning-briefing-dashboard";
import { governedDecisions } from "./data";
import { deriveRevenueExecutionIndicators } from "@/revenue-execution-indicators/domain";
const MorningBriefingDashboard = () => (
  <PersistedDashboard initialDecisions={governedDecisions} />
);

async function openCoinbase() {
  await userEvent.click(
    screen.getByRole("button", {
      name: /view details for coinbase renewal risk/i,
    }),
  );
  return screen.getByRole("dialog", {
    name: /coinbase renewal risk increased/i,
  });
}

describe("MorningBriefingDashboard", () => {
  it("merges leading indicators into five clickable execution-health highlights", () => {
    const executionIndicators = deriveRevenueExecutionIndicators({
      organizationId: "org-cognivit-demo",
      sources: [
        {
          id: "executive",
          indicatorType: "EXECUTIVE_ENGAGEMENT",
          score: 42,
          status: "AT_RISK",
          rationale: "Executive engagement is stale.",
          evidence: ["No executive interaction in 45 days"],
          observedAt: "2026-08-18T16:00:00.000Z",
        },
      ],
    });
    render(
      <PersistedDashboard
        initialDecisions={governedDecisions}
        executionIndicators={executionIndicators}
      />,
    );
    const section = screen.getByRole("region", {
      name: "My revenue execution health",
    });
    expect(within(section).getAllByRole("link")).toHaveLength(5);
    expect(
      within(section).getByRole("link", {
        name: "Open Executive access details",
      }),
    ).toHaveAttribute(
      "href",
      "/today/revenue-execution/EXECUTIVE_ECONOMIC_BUYER_ENGAGEMENT",
    );
    expect(
      within(section).getByText("No executive interaction in 45 days"),
    ).toBeVisible();
    expect(
      screen.queryByRole("heading", { name: "Leading indicator evidence" }),
    ).toBeNull();
  });

  it("ranks the persisted security review risk ahead of the 2x2 approval", () => {
    const decisions = [
      {
        ...governedDecisions[0],
        id: "2x2",
        priorityScore: 80,
        title: "Approve 2x2",
      },
      {
        ...governedDecisions[1],
        id: "security",
        priorityScore: 92,
        title: "Security review stalled",
      },
    ];
    render(<PersistedDashboard initialDecisions={decisions} />);
    const cards = screen.getAllByRole("button", { name: /view details for/i });
    expect(cards[0]).toHaveAccessibleName(/Security review stalled/i);
  });
  it("shows the AE's assigned account jurisdiction", () => {
    render(
      <PersistedDashboard
        initialDecisions={governedDecisions}
        assignedAccounts={[
          {
            id: "acct-coinbase",
            name: "Coinbase",
            segment: "Enterprise",
            status: "ACTIVE",
          },
          {
            id: "acct-franklin",
            name: "Franklin Templeton",
            segment: "Enterprise",
            status: "ACTIVE",
          },
        ]}
      />,
    );
    const accounts = screen.getByRole("region", { name: "My accounts" });
    expect(
      within(accounts).getByRole("link", { name: /Coinbase/i }),
    ).toHaveAttribute("href", "/accounts/acct-coinbase");
    expect(
      within(accounts).getByRole("link", { name: /Franklin Templeton/i }),
    ).toHaveAttribute("href", "/accounts/acct-franklin");
  });

  it("shows the AE's manager 1:1 and unified cadence preparation", () => {
    render(
      <PersistedDashboard
        initialDecisions={governedDecisions}
        cadences={[
          {
            id: "cadence-sarah-mark",
            status: "PREPARED",
            scope: "INTERNAL",
            scheduledAt: "2026-08-18T16:00:00.000Z",
            templateCode: "MANAGER_1_ON_1",
            templateName: "Manager 1:1",
            opportunityName: null,
            accountName: null,
            participantNames: "Mark Davis, Sarah Chen",
            preparationSummary:
              "Review Coinbase intervention follow-up and prior commitments.",
            agendaCount: 4,
            carryForwardCount: 2,
          },
        ]}
      />,
    );
    const section = screen.getByRole("region", {
      name: "My upcoming cadences",
    });
    expect(within(section).getByText("Manager 1:1")).toBeVisible();
    expect(within(section).getByText(/Mark Davis, Sarah Chen/)).toBeVisible();
    expect(within(section).getByText(/4 agenda items/)).toBeVisible();
    expect(
      within(section).getByRole("link", { name: /Manager 1:1/i }),
    ).toHaveAttribute("href", "/cadences/cadence-sarah-mark");
    expect(screen.getByRole("link", { name: "Cadences" })).toHaveAttribute(
      "href",
      "/cadences",
    );
    const intelligence = screen.getByRole("region", {
        name: "AI Intelligence Feed",
      }),
      cadence = screen.getByRole("region", { name: "My upcoming cadences" });
    expect(
      intelligence.compareDocumentPosition(cadence) &
        Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy();
  });

  it("prioritizes intelligence over activity metrics", () => {
    render(<MorningBriefingDashboard />);
    expect(
      screen.queryByRole("region", { name: /morning metrics/i }),
    ).toBeNull();
    expect(
      screen.getByRole("region", { name: "AI Intelligence Feed" }),
    ).toBeVisible();
  });

  it("renders three intelligence items", () => {
    render(<MorningBriefingDashboard />);
    expect(
      screen.getAllByRole("button", { name: /view details for/i }),
    ).toHaveLength(3);
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
    await userEvent.click(
      within(dialog).getByRole("button", { name: "Approve" }),
    );
    expect(within(dialog).getByText("Ready For Execution")).toBeVisible();
  });

  it("edits and saves an insight recommendation", async () => {
    render(<MorningBriefingDashboard />);
    const dialog = await openCoinbase();
    await userEvent.click(
      within(dialog).getByRole("button", { name: "Edit recommendation" }),
    );
    const field = within(dialog).getByLabelText("Edit recommendation");
    await userEvent.clear(field);
    await userEvent.type(field, "Schedule an executive alignment tomorrow.");
    await userEvent.click(
      within(dialog).getByRole("button", { name: "Save recommendation" }),
    );
    expect(
      within(dialog).getByText("Schedule an executive alignment tomorrow."),
    ).toBeVisible();
  });

  it("dismisses an insight", async () => {
    render(<MorningBriefingDashboard />);
    const dialog = await openCoinbase();
    await userEvent.click(
      within(dialog).getByRole("button", { name: "Dismiss" }),
    );
    expect(within(dialog).getByText("Dismissed")).toBeVisible();
  });

  it("snoozes an insight", async () => {
    render(<MorningBriefingDashboard />);
    const dialog = await openCoinbase();
    await userEvent.click(
      within(dialog).getByRole("button", { name: "Snooze" }),
    );
    expect(within(dialog).getByText("Snoozed")).toBeVisible();
  });

  it("opens the decision queue with eight decisions", async () => {
    render(<MorningBriefingDashboard />);
    await userEvent.click(
      screen.getByRole("button", { name: /review decision queue/i }),
    );
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
    const insight = screen.getByRole("button", {
      name: /view details for coinbase/i,
    });
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
    await userEvent.click(
      within(dialog).getByRole("button", { name: "Approve" }),
    );
    await userEvent.click(
      within(dialog).getByRole("button", { name: "Simulate execution" }),
    );
    expect(within(dialog).getByText("Executed")).toBeVisible();
    expect(screen.getByText("Execution simulated and audited.")).toBeVisible();
  });
});
