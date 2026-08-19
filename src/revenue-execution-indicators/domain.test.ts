import { describe, expect, it } from "vitest";
import {
  aggregateRevenueExecutionIndicators,
  deriveRevenueExecutionIndicators,
  summarizeRevenueExecutionHealth,
} from "./domain";

describe("canonical revenue execution indicators", () => {
  it("derives five explainable indicators from persisted evidence", () => {
    const result = deriveRevenueExecutionIndicators({
      organizationId: "org",
      accountId: "acct",
      sources: [
        {
          id: "exec",
          indicatorType: "EXECUTIVE_ENGAGEMENT",
          score: 42,
          status: "AT_RISK",
          rationale: "Executive touchpoint is stale.",
          evidence: ["No CTO interaction in 45 days"],
          observedAt: "2026-08-20",
        },
        {
          id: "buyer",
          indicatorType: "ECONOMIC_BUYER_ACCESS",
          score: 51,
          status: "WATCH",
          rationale: "Buyer authority is unvalidated.",
          evidence: ["Economic buyer not confirmed"],
          observedAt: "2026-08-20",
        },
        {
          id: "commit",
          indicatorType: "CUSTOMER_COMMITMENT_HEALTH",
          score: 38,
          status: "AT_RISK",
          rationale: "Customer commitments are overdue.",
          evidence: ["Two commitments overdue"],
          observedAt: "2026-08-20",
        },
      ],
    });
    expect(result).toHaveLength(5);
    expect(
      result.find(
        (item) => item.indicatorType === "EXECUTIVE_ECONOMIC_BUYER_ENGAGEMENT",
      )?.status,
    ).toBe("AT_RISK");
    expect(
      result.find(
        (item) => item.indicatorType === "NEXT_STEP_COMMITMENT_DISCIPLINE",
      )?.evidence[0]?.text,
    ).toContain("overdue");
    expect(
      result.find(
        (item) => item.indicatorType === "OPPORTUNITY_ACCOUNT_PROGRESSION",
      )?.status,
    ).toBe("UNKNOWN");
  });

  it("rolls opportunity indicators into account and territory scopes", () => {
    const opportunity = (score: number) =>
      deriveRevenueExecutionIndicators({
        organizationId: "org",
        accountId: "acct",
        opportunityId: `opp-${score}`,
        sources: [
          {
            id: `exec-${score}`,
            indicatorType: "EXECUTIVE_ENGAGEMENT",
            score,
            status: score < 40 ? "CRITICAL" : "AT_RISK",
            rationale: `Executive score ${score}.`,
            evidence: [`Evidence ${score}`],
            observedAt: "2026-08-20",
          },
        ],
      });
    const account = aggregateRevenueExecutionIndicators({
      organizationId: "org",
      accountId: "acct",
      scopeLabel: "opportunity",
      children: [
        { id: "opp-20", indicators: opportunity(20) },
        { id: "opp-60", indicators: opportunity(60) },
      ],
    });
    const territory = aggregateRevenueExecutionIndicators({
      organizationId: "org",
      scopeLabel: "account",
      children: [
        { id: "acct", indicators: account },
        {
          id: "acct-healthy",
          indicators: aggregateRevenueExecutionIndicators({
            organizationId: "org",
            accountId: "acct-healthy",
            scopeLabel: "opportunity",
            children: [{ id: "opp-80", indicators: opportunity(80) }],
          }),
        },
      ],
    });
    expect(
      account.find(
        (item) => item.indicatorType === "EXECUTIVE_ECONOMIC_BUYER_ENGAGEMENT",
      )?.score,
    ).toBe(40);
    expect(
      territory.find(
        (item) => item.indicatorType === "EXECUTIVE_ECONOMIC_BUYER_ENGAGEMENT",
      )?.score,
    ).toBe(60);
  });

  it("derives account health from the canonical five", () => {
    const indicators = deriveRevenueExecutionIndicators({
      organizationId: "org",
      accountId: "acct",
      sources: [
        {
          id: "engagement",
          indicatorType: "CUSTOMER_MEETING_HEALTH",
          score: 80,
          status: "HEALTHY",
          rationale: "Recent customer meeting.",
          evidence: [],
          observedAt: "2026-08-20",
        },
        {
          id: "executive",
          indicatorType: "EXECUTIVE_ENGAGEMENT",
          score: 40,
          status: "AT_RISK",
          rationale: "Executive touchpoint is stale.",
          evidence: [],
          observedAt: "2026-08-20",
        },
      ],
    });
    expect(summarizeRevenueExecutionHealth(indicators)).toEqual({
      score: 60,
      status: "WATCH",
    });
  });
});
