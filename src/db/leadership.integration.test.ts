import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { Pool } from "pg";
import { PostgresLeadershipRepository } from "./leadership-repository";

const connectionString = process.env.TEST_DATABASE_URL;
describe.skipIf(!connectionString)("PostgreSQL leadership intelligence", () => {
  let pool: Pool,
    a: PostgresLeadershipRepository,
    b: PostgresLeadershipRepository;
  const organizationId = "org-cognivit-demo",
    vp = "membership-org-cognivit-demo-user-vp-jennifer",
    cro = "membership-org-cognivit-demo-user-cro-michael";
  beforeAll(async () => {
    pool = new Pool({ connectionString });
    a = new PostgresLeadershipRepository(connectionString!);
    b = new PostgresLeadershipRepository(connectionString!);
    const seededAssessments = [
      "forecast-coinbase-initial",
      "forecast-coinbase-current",
      "forecast-paypal-current",
      "forecast-nvidia-current",
      "forecast-franklin-current",
      "forecast-snowflake-current",
    ];
    await pool.query(
      `DELETE FROM security_audit_events WHERE organization_id=$1 AND resource_type='forecast_assessment' AND resource_id <> ALL($2::text[])`,
      [organizationId, seededAssessments],
    );
    await pool.query(
      `DELETE FROM revenue_digital_twin_events WHERE organization_id=$1 AND event_type IN('FORECAST_ASSESSMENT_CREATED','FORECAST_ASSESSMENT_CHANGED') AND payload->>'assessmentId' <> ALL($2::text[])`,
      [organizationId, seededAssessments],
    );
    await pool.query(
      `DELETE FROM forecast_assessments WHERE organization_id=$1 AND id <> ALL($2::text[])`,
      [organizationId, seededAssessments],
    );
  });
  afterAll(async () => {
    await Promise.all([a.close(), b.close(), pool.end()]);
  });

  it("rolls VP scope from the configured reporting graph without double counting", async () => {
    const brief = await a.getLeadershipBrief(organizationId, vp, "VP"),
      ids = new Set(brief.assessments.map((item) => item.opportunity_id));
    expect(ids).toEqual(
      new Set(["opp-coinbase-renewal", "opp-pp", "opp-nv", "opp-ft", "opp-sf"]),
    );
    expect(brief.rollup.opportunityCount).toBe(ids.size);
    expect(
      brief.assessments.find(
        (item) => item.opportunity_id === "opp-coinbase-renewal",
      ),
    ).toMatchObject({
      seller_category: "COMMIT",
      manager_category: "COMMIT",
      aros_category: "HIGH_RISK",
      probability: 67,
      previous_probability: 82,
    });
    expect(brief.interventions.map((item) => item.id)).toContain(
      "leadership-intervention-coinbase-vp",
    );
  });

  it("gives CRO a tenant-scoped systemic blocker view", async () => {
    const brief = await a.getLeadershipBrief(organizationId, cro, "CRO");
    expect(
      brief.patterns.reduce(
        (sum, pattern) => sum + pattern.opportunity_count,
        0,
      ),
    ).toBeGreaterThanOrEqual(3);
    expect(brief.patterns.map((pattern) => pattern.type)).toEqual(
      expect.arrayContaining(["SECURITY", "PROCUREMENT"]),
    );
    expect(
      (await a.getLeadershipBrief("org-globex", cro, "CRO")).assessments,
    ).toHaveLength(0);
  });

  it("persists deterministic assessment evidence and Twin history without overwriting humans", async () => {
    const before = Number(
        (
          await pool.query(
            `SELECT count(*) FROM forecast_assessments WHERE organization_id=$1 AND opportunity_id='opp-coinbase-renewal'`,
            [organizationId],
          )
        ).rows[0].count,
      ),
      result = await a.assessAndPersist({
        organizationId,
        opportunityId: "opp-coinbase-renewal",
        actorUserId: "user-vp-jennifer",
        actorMembershipId: vp,
        actorRole: "VP_SALES",
      });
    expect(result.arosCategory).toBe("HIGH_RISK");
    expect(result.negativeEvidence.join(" ")).toMatch(/security|commitment/i);
    expect(
      Number(
        (
          await pool.query(
            `SELECT count(*) FROM forecast_assessments WHERE organization_id=$1 AND opportunity_id='opp-coinbase-renewal'`,
            [organizationId],
          )
        ).rows[0].count,
      ),
    ).toBe(before + 1);
    expect(
      Number(
        (
          await pool.query(
            `SELECT count(*) FROM revenue_digital_twin_events WHERE organization_id=$1 AND payload->>'assessmentId'=$2`,
            [organizationId, result.id],
          )
        ).rows[0].count,
      ),
    ).toBe(1);
    expect(
      (
        await pool.query(
          `SELECT seller_forecast_category,manager_forecast_category FROM opportunities WHERE organization_id=$1 AND id='opp-coinbase-renewal'`,
          [organizationId],
        )
      ).rows[0],
    ).toEqual({
      seller_forecast_category: "COMMIT",
      manager_forecast_category: "COMMIT",
    });
  });

  it("approves one leadership intervention exactly once across instances", async () => {
    const id = `leadership-test-${crypto.randomUUID()}`,
      type = `TEST_EXECUTIVE_${crypto.randomUUID()}`;
    await pool.query(
      `INSERT INTO leadership_interventions(id,organization_id,opportunity_id,assessment_id,level,type,status,priority_score,summary,rationale,recommended_action,idempotency_key,created_at,updated_at) VALUES($1,$2,'opp-coinbase-renewal','forecast-coinbase-current','VP',$3,'ELIGIBLE',90,'Test intervention','Lower-level action exhausted','Approve test engagement',$1,now(),now())`,
      [id, organizationId, type],
    );
    const input = {
        organizationId,
        interventionId: id,
        expectedLevel: "VP" as const,
        actorUserId: "user-vp-jennifer",
        actorMembershipId: vp,
        actorRole: "VP_SALES",
      },
      results = await Promise.all([
        a.approveIntervention(input),
        b.approveIntervention(input),
      ]);
    expect(results.filter((result) => !result.replayed)).toHaveLength(1);
    expect(results.filter((result) => result.replayed)).toHaveLength(1);
    const fresh = new PostgresLeadershipRepository(connectionString!);
    expect(
      (
        await pool.query(
          `SELECT status FROM leadership_interventions WHERE organization_id=$1 AND id=$2`,
          [organizationId, id],
        )
      ).rows[0].status,
    ).toBe("APPROVED");
    expect(
      Number(
        (
          await pool.query(
            `SELECT count(*) FROM revenue_digital_twin_events WHERE organization_id=$1 AND event_type='LEADERSHIP_INTERVENTION_APPROVED' AND payload->>'interventionId'=$2`,
            [organizationId, id],
          )
        ).rows[0].count,
      ),
    ).toBe(1);
    await fresh.close();
  });

  it("records an idempotent human review while keeping official forecast", async () => {
    const key = `forecast-review-${crypto.randomUUID()}`,
      input = {
        organizationId,
        assessmentId: "forecast-coinbase-current",
        leaderMembershipId: vp,
        actorUserId: "user-vp-jennifer",
        actorMembershipId: vp,
        actorRole: "VP_SALES",
        action: "KEEP_CURRENT" as const,
        idempotencyKey: key,
      },
      results = await Promise.all([
        a.reviewForecast(input),
        b.reviewForecast(input),
      ]);
    expect(results.filter((result) => !result.replayed)).toHaveLength(1);
    expect(results.filter((result) => result.replayed)).toHaveLength(1);
    expect(
      (
        await pool.query(
          `SELECT manager_forecast_category FROM opportunities WHERE organization_id=$1 AND id='opp-coinbase-renewal'`,
          [organizationId],
        )
      ).rows[0].manager_forecast_category,
    ).toBe("COMMIT");
  });

  it("rejects database-level cross-tenant forecast and intervention references", async () => {
    await expect(
      pool.query(
        `INSERT INTO forecast_assessments(id,organization_id,opportunity_id,aros_category,probability,confidence,risk_score,rationale,created_at,updated_at) VALUES($1,'org-globex','opp-coinbase-renewal','AT_RISK',60,'MEDIUM',40,'invalid',now(),now())`,
        [`invalid-forecast-${crypto.randomUUID()}`],
      ),
    ).rejects.toMatchObject({ code: "23503" });
    await expect(
      pool.query(
        `INSERT INTO leadership_interventions(id,organization_id,opportunity_id,assessment_id,level,type,status,priority_score,summary,rationale,recommended_action,created_at,updated_at) VALUES($1,'org-globex','opp-coinbase-renewal','forecast-coinbase-current','VP','INVALID','ELIGIBLE',50,'invalid','invalid','invalid',now(),now())`,
        [`invalid-leadership-${crypto.randomUUID()}`],
      ),
    ).rejects.toMatchObject({ code: "23503" });
  });
});
