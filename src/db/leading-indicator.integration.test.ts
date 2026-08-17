import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { Pool } from "pg";
import { PostgresLeadingIndicatorRepository } from "./leading-indicator-repository";

const connectionString = process.env.TEST_DATABASE_URL;
describe.skipIf(!connectionString)("PostgreSQL leading indicators", () => {
  let pool: Pool;
  let a: PostgresLeadingIndicatorRepository;
  let b: PostgresLeadingIndicatorRepository;
  const organizationId = "org-cognivit-demo";
  const sarah = "membership-org-cognivit-demo-user-ae-sarah";

  beforeAll(() => {
    pool = new Pool({ connectionString });
    a = new PostgresLeadingIndicatorRepository(connectionString!);
    b = new PostgresLeadingIndicatorRepository(connectionString!);
  });
  afterAll(async () => {
    await Promise.all([a.close(), b.close(), pool.end()]);
  });

  it("returns Coinbase evidence only inside the viewer's tenant and jurisdiction", async () => {
    const indicators = await a.listForViewer({
      organizationId,
      membershipId: sarah,
      accountId: "acct-coinbase",
    });
    expect(indicators.map((item) => item.indicator_type)).toEqual(
      expect.arrayContaining([
        "EXECUTIVE_ENGAGEMENT",
        "SECURITY_REVIEW_PROGRESS",
        "CUSTOMER_COMMITMENT_HEALTH",
      ]),
    );
    expect(
      await a.listForViewer({
        organizationId: "org-globex",
        membershipId: sarah,
      }),
    ).toHaveLength(0);
  });

  it("upserts one indicator, preserves evidence, and writes Twin events and audit", async () => {
    const sourceKey = `test-indicator:${crypto.randomUUID()}`;
    const first = await a.upsertIndicator({
      organizationId,
      sourceKey,
      id: `test-indicator-${crypto.randomUUID()}`,
      accountId: "acct-coinbase",
      opportunityId: "opp-coinbase-renewal",
      indicatorType: "SECURITY_REVIEW_PROGRESS",
      status: "AT_RISK",
      score: 48,
      confidence: "HIGH",
      evidence: ["Approval milestone delayed"],
      rationale: "Security review is associated with increased renewal risk.",
      observedAt: "2026-08-20T16:00:00Z",
      actorUserId: "user-ae-sarah",
      actorMembershipId: sarah,
      actorRole: "AE",
    });
    const second = await b.upsertIndicator({
      organizationId,
      sourceKey,
      accountId: "acct-coinbase",
      opportunityId: "opp-coinbase-renewal",
      indicatorType: "SECURITY_REVIEW_PROGRESS",
      status: "HEALTHY",
      score: 82,
      confidence: "HIGH",
      evidence: ["Customer approval received"],
      rationale: "Security review resolved with customer evidence.",
      observedAt: "2026-08-21T16:00:00Z",
      actorUserId: "user-ae-sarah",
      actorMembershipId: sarah,
      actorRole: "AE",
    });
    expect(first.id).toBe(second.id);
    expect(second.version).toBe(first.version + 1);
    expect(second.status).toBe("HEALTHY");
    const counts = (
      await pool.query(
        `SELECT (SELECT count(*) FROM leading_indicators WHERE organization_id=$1 AND source_key=$2)::int indicators,(SELECT count(*) FROM revenue_digital_twin_events WHERE organization_id=$1 AND payload->>'indicatorId'=$3)::int twin_events,(SELECT count(*) FROM security_audit_events WHERE organization_id=$1 AND resource_id=$3 AND event LIKE 'LEADING_INDICATOR%')::int audits`,
        [organizationId, sourceKey, first.id],
      )
    ).rows[0];
    expect(counts).toEqual({ indicators: 1, twin_events: 2, audits: 2 });
    const timeline = await a.getIndicatorTimeline({
      organizationId,
      membershipId: sarah,
      accountId: "acct-coinbase",
    });
    expect(
      timeline.some((event) => event.payload?.indicatorId === first.id),
    ).toBe(true);
  });

  it("serializes duplicate signal processing into one durable row", async () => {
    const sourceKey = `test-idempotent-indicator:${crypto.randomUUID()}`;
    const input = {
      organizationId,
      sourceKey,
      accountId: "acct-coinbase",
      opportunityId: "opp-coinbase-renewal",
      indicatorType: "EXECUTIVE_ENGAGEMENT" as const,
      status: "AT_RISK" as const,
      score: 40,
      confidence: "MEDIUM" as const,
      evidence: ["Duplicate signal"],
      rationale: "Duplicate signal processing is idempotent.",
      observedAt: "2026-08-20T16:00:00Z",
    };
    await Promise.all([a.upsertIndicator(input), b.upsertIndicator(input)]);
    expect(
      Number(
        (
          await pool.query(
            `SELECT count(*) FROM leading_indicators WHERE organization_id=$1 AND source_key=$2`,
            [organizationId, sourceKey],
          )
        ).rows[0].count,
      ),
    ).toBe(1);
  });

  it("rejects cross-tenant indicator references at the database layer", async () => {
    await expect(
      pool.query(
        `INSERT INTO leading_indicators(id,organization_id,opportunity_id,indicator_type,status,confidence,rationale,observed_at) VALUES($1,'org-globex','opp-coinbase-renewal','BLOCKER_HEALTH','AT_RISK','HIGH','invalid',now())`,
        [`invalid-indicator-${crypto.randomUUID()}`],
      ),
    ).rejects.toMatchObject({ code: "23503" });
  });

  it("exposes internal coaching only to the scoped seller", async () => {
    const insights = await a.listCoachingInsights({
      organizationId,
      membershipId: sarah,
      accountId: "acct-coinbase",
    });
    expect(insights).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          title: "Enterprise renewal executive engagement",
        }),
      ]),
    );
    expect(
      await a.listCoachingInsights({
        organizationId: "org-globex",
        membershipId: sarah,
      }),
    ).toHaveLength(0);
  });
});
