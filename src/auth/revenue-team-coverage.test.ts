import { describe, expect, it } from "vitest";
import { MemoryIdentityRepository } from "./repository";
import { createDemoIdentityStore } from "./seed";
import {
  getCoverageGaps,
  getRevenueTeamCoverage,
} from "./revenue-team-coverage";

describe("revenue team coverage", () => {
  it("reports normalized multi-function opportunity coverage and tenant isolation", () => {
    const repository = new MemoryIdentityRepository(createDemoIdentityStore()),
      coverage = getRevenueTeamCoverage(repository, {
        organizationId: "org-cognivit-demo",
        opportunityId: "opp-coinbase-renewal",
      });
    for (const type of [
      "PRIMARY_SELLER",
      "SALES_ENGINEERING",
      "PROSPECTING",
      "PARTNER",
      "TECHNICAL_EXECUTIVE",
      "EXECUTIVE_SPONSOR",
      "CUSTOMER_SUCCESS",
      "VALUE_ENGINEERING",
    ] as const)
      expect(coverage[type]).toBe(true);
    expect(
      getRevenueTeamCoverage(repository, {
        organizationId: "org-isolation-test",
        opportunityId: "opp-coinbase-renewal",
      }).PRIMARY_SELLER,
    ).toBe(false);
  });
  it("supports multiple contextual roles and deterministic gaps", () => {
    const store = createDemoIdentityStore(),
      base = store.revenueTeamAssignments.find(
        (item) => item.opportunityId === "opp-coinbase-renewal",
      )!;
    store.revenueTeamAssignments.push(
      {
        ...base,
        id: "technical-executive",
        membershipId: "membership-org-cognivit-demo-user-field-cto-david",
        participationType: "TECHNICAL_EXECUTIVE",
        isPrimaryOwner: false,
      },
      {
        ...base,
        id: "executive-sponsor",
        membershipId: "membership-org-cognivit-demo-user-field-cto-david",
        participationType: "EXECUTIVE_SPONSOR",
        isPrimaryOwner: false,
      },
    );
    store.revenueTeamAssignments=store.revenueTeamAssignments.filter(item=>item.opportunityId!=="opp-coinbase-renewal"||item.participationType!=="VALUE_ENGINEERING");
    const coverage = getRevenueTeamCoverage(
      new MemoryIdentityRepository(store),
      {
        organizationId: "org-cognivit-demo",
        opportunityId: "opp-coinbase-renewal",
      },
    );
    expect(coverage.TECHNICAL_EXECUTIVE).toBe(true);
    expect(coverage.EXECUTIVE_SPONSOR).toBe(true);
    expect(
      getCoverageGaps(coverage, ["TECHNICAL_EXECUTIVE", "VALUE_ENGINEERING"]),
    ).toEqual(["VALUE_ENGINEERING"]);
  });
});
