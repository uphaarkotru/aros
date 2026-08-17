import { describe, expect, it } from "vitest";
import type { ActionDecisionRecord } from "@/db/revenue-repository";
import { actionToGovernedDecision } from "./action-adapter";

describe("actionToGovernedDecision", () => {
  it("uses the authoritative database ID for sparse cadence recommendations", () => {
    const action: ActionDecisionRecord = {
      id: "decision-coinbase-2x2",
      organizationId: "org-cognivit-demo",
      accountId: "acct-coinbase",
      opportunityId: "opp-coinbase-renewal",
      assignedMembershipId: null,
      createdByMembershipId: null,
      type: "CADENCE_RECOMMENDATION",
      recommendation: "Approve cross-functional 2x2",
      status: "PENDING",
      evidence: ["$22.4M exposure", "security commitment overdue"],
      metadata: { effect: { type: "CREATE_CADENCE" } },
      createdAt: "2026-08-14T00:00:00.000Z",
      updatedAt: "2026-08-14T00:00:00.000Z",
    };

    const decision = actionToGovernedDecision(action, "Coinbase");

    expect(decision.id).toBe("decision-coinbase-2x2");
    expect(decision.candidateId).toBe("decision-coinbase-2x2");
    expect(decision.accountName).toBe("Coinbase");
    expect(decision.priority).toBe("high");
    expect(decision.evidence).toHaveLength(2);
    expect(decision.approvalPolicy.approvalRequired).toBe(true);
  });

  it("does not allow metadata to override the persistent action ID", () => {
    const action = {
      id: "database-id",
      organizationId: "org-cognivit-demo",
      accountId: "acct-coinbase",
      opportunityId: null,
      assignedMembershipId: null,
      createdByMembershipId: null,
      type: "renewal-risk",
      recommendation: "Review renewal",
      status: "PENDING",
      evidence: [],
      metadata: { id: "stale-metadata-id", candidateId: "candidate-id" },
      createdAt: "2026-08-14T00:00:00.000Z",
      updatedAt: "2026-08-14T00:00:00.000Z",
    } satisfies ActionDecisionRecord;

    expect(actionToGovernedDecision(action, "Coinbase").id).toBe("database-id");
  });
});
