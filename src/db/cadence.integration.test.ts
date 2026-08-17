import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { Pool } from "pg";
import { PostgresCadenceRepository } from "./cadence-repository";

const connectionString = process.env.TEST_DATABASE_URL;
describe.skipIf(!connectionString)("PostgreSQL unified revenue cadence", () => {
  let pool: Pool, a: PostgresCadenceRepository, b: PostgresCadenceRepository;
  const organizationId = "org-cognivit-demo",
    manager = "membership-org-cognivit-demo-user-rsm-mark",
    seller = "membership-org-cognivit-demo-user-ae-sarah";
  beforeAll(() => {
    pool = new Pool({ connectionString });
    a = new PostgresCadenceRepository(connectionString!);
    b = new PostgresCadenceRepository(connectionString!);
  });
  afterAll(async () => {
    await Promise.all([a.close(), b.close(), pool.end()]);
  });

  it("derives RSM scope only from configured REPORTS_TO relationships", async () => {
    await a.refreshManagerInterventions(organizationId, manager);
    const brief = await a.getRsmBrief(organizationId, manager);
    expect(brief.reports.map((item) => item.membership_id)).toContain(seller);
    expect(brief.reports.map((item) => item.membership_id)).not.toContain(
      "membership-org-cognivit-demo-user-se-raj",
    );
    expect(brief.interventions[0]).toMatchObject({
      id: "intervention-coinbase-security",
      opportunity_id: "opp-coinbase-renewal",
    });
    expect(
      (await a.getRsmBrief("org-globex", manager)).interventions,
    ).toHaveLength(0);
    expect(brief.interventions[0].rationale).toMatch(
      /revenue exposure|commitment/i,
    );
    expect(
      Number(
        (
          await pool.query(
            `SELECT count(*) FROM revenue_digital_twin_events WHERE organization_id=$1 AND event_type='COMMITMENT_MISSED' AND payload->>'commitmentId'='commitment-coinbase-security-response'`,
            [organizationId],
          )
        ).rows[0].count,
      ),
    ).toBeGreaterThan(0);
  });

  it("serves AI-prepared upcoming cadence meetings across demo roles", async () => {
    const [sarah, mark, raj, anita, alex, priya] = await Promise.all([
      a.listCadences(organizationId, seller),
      a.listCadences(organizationId, manager),
      a.listCadences(
        organizationId,
        "membership-org-cognivit-demo-user-se-raj",
      ),
      a.listCadences(
        organizationId,
        "membership-org-cognivit-demo-user-se-manager-anita",
      ),
      a.listCadences(
        organizationId,
        "membership-org-cognivit-demo-user-sdr-alex",
      ),
      a.listCadences(
        organizationId,
        "membership-org-cognivit-demo-user-partner-priya",
      ),
    ]);
    const codes = (items: { template_code: string }[]) =>
      new Set(items.map((item) => item.template_code));
    for (const expected of [
      "MANAGER_1_ON_1",
      "AE_SE_SYNC",
      "AE_SDR_SYNC",
      "AE_PARTNER_SYNC",
      "CROSS_FUNCTIONAL_2X2",
      "SECURITY_REVIEW",
    ])
      expect(codes(sarah).has(expected)).toBe(true);
    expect(codes(mark).has("MANAGER_1_ON_1")).toBe(true);
    expect(codes(mark).has("AE_SDR_SYNC")).toBe(true);
    expect(codes(sarah).has("SE_MANAGER_1_ON_1")).toBe(false);
    expect(codes(raj).has("AE_SE_SYNC")).toBe(true);
    expect(codes(anita).has("SE_MANAGER_1_ON_1")).toBe(true);
    expect(codes(anita).has("AE_SE_SYNC")).toBe(true);
    expect(codes(alex).has("AE_SDR_SYNC")).toBe(true);
    expect(codes(priya).has("AE_PARTNER_SYNC")).toBe(true);

    expect(
      await a.getCadence(organizationId, "cadence-coinbase-ae-sdr", manager),
    ).not.toBeNull();
    expect(
      await a.getCadence(
        organizationId,
        "cadence-coinbase-ae-sdr",
        "membership-org-cognivit-demo-user-value-jason",
      ),
    ).toBeNull();

    const prepared = await a.getCadence(
      organizationId,
      "cadence-coinbase-ae-se-next",
      seller,
    );
    expect(prepared?.session.status).toBe("PREPARED");
    expect(prepared?.session.scheduled_at).toBeTruthy();
    expect(prepared?.agenda.length).toBeGreaterThan(0);
    expect(prepared?.signals.length).toBeGreaterThan(0);
    expect(prepared?.carryForwardCommitments.length).toBeGreaterThan(0);
    expect(
      await a.getCadence(organizationId, "cadence-anita-raj-next", seller),
    ).toBeNull();
    expect(
      await a.getCadence(
        organizationId,
        "cadence-anita-raj-next",
        "membership-org-cognivit-demo-user-se-raj",
      ),
    ).not.toBeNull();
    const privateCommitmentId = `private-se-1x1-${crypto.randomUUID()}`;
    await pool.query(
      `INSERT INTO commitments(id,organization_id,cadence_session_id,account_id,opportunity_id,owner_membership_id,description,status,visibility,impact,created_at,updated_at) VALUES($1,$2,'cadence-anita-raj-next','acct-coinbase','opp-coinbase-renewal','membership-org-cognivit-demo-user-se-raj','Private SE coaching follow-up','OPEN','INTERNAL_ONLY','MEDIUM',now(),now())`,
      [privateCommitmentId, organizationId],
    );
    const sellerCadence = await a.getCadence(
      organizationId,
      "cadence-coinbase-ae-se-next",
      seller,
    );
    expect(
      sellerCadence?.carryForwardCommitments.some(
        (item) => item.id === privateCommitmentId,
      ),
    ).toBe(false);
    await pool.query(`DELETE FROM commitments WHERE id=$1`, [
      privateCommitmentId,
    ]);
  });

  it("seeds a visible AI-prepared cadence for every demo revenue role", async () => {
    const memberships = [
        "membership-org-cognivit-demo-user-cro-michael",
        "membership-org-cognivit-demo-user-vp-jennifer",
        manager,
        "membership-org-cognivit-demo-user-rsm-other",
        seller,
        "membership-org-cognivit-demo-user-ae-daniel",
        "membership-org-cognivit-demo-user-ae-priya",
        "membership-org-cognivit-demo-user-sdr-alex",
        "membership-org-cognivit-demo-user-sdr-manager-david",
        "membership-org-cognivit-demo-user-se-manager-anita",
        "membership-org-cognivit-demo-user-se-raj",
        "membership-org-cognivit-demo-user-partner-priya",
        "membership-org-cognivit-demo-user-field-cto-david",
        "membership-org-cognivit-demo-user-cs-maria",
        "membership-org-cognivit-demo-user-value-jason",
        "membership-org-cognivit-demo-user-product-nina",
        "membership-org-cognivit-demo-user-services-elena",
        "membership-org-cognivit-demo-user-revops-owen",
        "membership-org-cognivit-demo-user-commercial-claire",
        "membership-org-cognivit-demo-user-marketing-maya",
      ],
      visible = await Promise.all(
        memberships.map((membershipId) =>
          a.listCadences(organizationId, membershipId),
        ),
      );
    for (const cadences of visible) {
      expect(cadences.some((cadence) => cadence.status !== "COMPLETED")).toBe(
        true,
      );
      expect(cadences.some((cadence) => cadence.agenda_count > 0)).toBe(true);
    }
  });

  it("allows revenue context without granting an unrelated tenant or member cadence access", async () => {
    const reviewDecisionId = `decision-cadence-context-${crypto.randomUUID()}`;
    await pool.query(
      `INSERT INTO action_decisions(id,organization_id,account_id,opportunity_id,type,recommendation,status,metadata,idempotency_key,created_at,updated_at) VALUES($1,$2,'acct-coinbase','opp-coinbase-renewal','renewal-risk','Review the security decision','PENDING','{"title":"Security review stalled","priorityScore":92}',$1,now(),now())`,
      [reviewDecisionId, organizationId],
    );
    expect(
      await a.getCadence(
        organizationId,
        "cadence-coinbase-ae-se",
        "membership-org-cognivit-demo-user-se-raj",
      ),
    ).not.toBeNull();
    expect(
      await a.getCadence(
        organizationId,
        "cadence-coinbase-ae-se",
        "membership-globex-technologies",
      ),
    ).toBeNull();
    const twoByTwo = await a.getCadence(
      organizationId,
      "cadence-coinbase-2x2",
      seller,
    );
    expect(twoByTwo?.session.template_code).toBe("CROSS_FUNCTIONAL_2X2");
    expect(twoByTwo?.aiDecisions.map((item) => item.id)).toContain(
      reviewDecisionId,
    );
    expect(
      twoByTwo?.aiDecisions.some(
        (item) => item.type === "CADENCE_RECOMMENDATION",
      ),
    ).toBe(false);
    await pool.query(`DELETE FROM action_decisions WHERE id=$1`, [
      reviewDecisionId,
    ]);
  });

  it("assembles AE-SDR and 2x2 participants plus evidence-based agendas without caller-supplied people", async () => {
    const aeSdr = await a.createCadence({
        idempotencyKey: `auto-ae-sdr-${crypto.randomUUID()}`,
        organizationId,
        templateCode: "AE_SDR_SYNC",
        scope: "INTERNAL",
        accountId: "acct-coinbase",
        opportunityId: "opp-coinbase-renewal",
        participants: [],
        agenda: [],
        actorUserId: "user-ae-sarah",
        actorMembershipId: seller,
      }),
      aeSdrData = await a.getCadence(organizationId, aeSdr.id, seller);
    expect(
      new Set(aeSdrData?.participants.map((item) => item.participation_type)),
    ).toEqual(new Set(["PRIMARY_SELLER", "PROSPECTING"]));
    expect(
      aeSdrData?.agenda.some((item) => item.type === "COMMITMENT_SLIPPAGE"),
    ).toBe(true);
    const twoByTwo = await a.createCadence({
        idempotencyKey: `auto-2x2-${crypto.randomUUID()}`,
        organizationId,
        templateCode: "CROSS_FUNCTIONAL_2X2",
        scope: "INTERNAL",
        accountId: "acct-coinbase",
        opportunityId: "opp-coinbase-renewal",
        participants: [],
        agenda: [],
        actorUserId: "user-rsm-mark",
        actorMembershipId: manager,
      }),
      data = await a.getCadence(organizationId, twoByTwo.id, manager),
      members = new Set(data?.participants.map((item) => item.membership_id));
    for (const expected of [
      seller,
      "membership-org-cognivit-demo-user-se-raj",
      manager,
      "membership-org-cognivit-demo-user-se-manager-anita",
    ])
      expect(members.has(expected)).toBe(true);
  });

  it("returns an external-safe representation without internal reasoning", async () => {
    const safe = await a.getExternalSafeCadence(
      organizationId,
      "cadence-coinbase-security",
    );
    expect(safe?.external_safe_summary).toMatch(/agreed/i);
    const serialized = JSON.stringify(safe);
    expect(serialized).not.toMatch(
      /forecast concern|seller coaching|escalation strategy|pricing floor/i,
    );
    expect(
      safe?.agenda.every((item: { title: string }) => item.title.length > 0),
    ).toBe(true);
    expect(
      await a.getExternalSafeCadence("org-globex", "cadence-coinbase-security"),
    ).toBeNull();
  });

  it("completes a cadence once across independent instances and persists structured outputs, Twin events, and audit", async () => {
    const key = `cadence-test-${crypto.randomUUID()}`;
    const created = await a.createCadence({
      idempotencyKey: key,
      organizationId,
      templateCode: "AE_SE_SYNC",
      scope: "INTERNAL",
      accountId: "acct-coinbase",
      opportunityId: "opp-coinbase-renewal",
      participants: [
        {
          membershipId: seller,
          participationType: "PRIMARY_SELLER",
          participantRole: "SELLER",
          required: true,
        },
        {
          membershipId: "membership-org-cognivit-demo-user-se-raj",
          participationType: "SALES_ENGINEERING",
          participantRole: "TECHNICAL_PARTNER",
          required: true,
        },
      ],
      agenda: [
        {
          type: "TECHNICAL_BLOCKER",
          priority: 100,
          title: "Resolve security response",
          rationale: "The commitment is overdue.",
          visibility: "INTERNAL_ONLY",
        },
      ],
      actorUserId: "user-rsm-mark",
    });
    const input = {
      organizationId,
      sessionId: created.id,
      expectedVersion: 1,
      actorUserId: "user-rsm-mark",
      actorMembershipId: manager,
      internalSummary: "Internal forecast risk remains confidential.",
      externalSafeSummary: "",
      decisions: [
        {
          type: "OWNER_ASSIGNED",
          decision: "Raj owns the response.",
          visibility: "INTERNAL_ONLY",
        },
      ],
      commitments: [
        {
          idempotencyKey: `commit-${key}`,
          ownerMembershipId: "membership-org-cognivit-demo-user-se-raj",
          description: "Deliver response",
          expectedOutcome: "Unblock review",
          visibility: "INTERNAL_ONLY",
          impact: "HIGH",
        },
      ],
      outcomes: [
        {
          type: "OWNER_ASSIGNED",
          description: "Technical owner confirmed",
          visibility: "INTERNAL_ONLY",
        },
      ],
    };
    const results = await Promise.all([
      a.completeCadence(input),
      b.completeCadence(input),
    ]);
    expect(results.filter((item) => !item.replayed)).toHaveLength(1);
    const fresh = new Pool({ connectionString });
    const [session, commitments, events, audits] = await Promise.all([
      fresh.query(
        `SELECT status,version FROM cadence_sessions WHERE organization_id=$1 AND id=$2`,
        [organizationId, created.id],
      ),
      fresh.query(
        `SELECT count(*)::int count FROM commitments WHERE organization_id=$1 AND cadence_session_id=$2`,
        [organizationId, created.id],
      ),
      fresh.query(
        `SELECT event_type FROM revenue_digital_twin_events WHERE organization_id=$1 AND payload->>'cadenceSessionId'=$2`,
        [organizationId, created.id],
      ),
      fresh.query(
        `SELECT count(*)::int count FROM security_audit_events WHERE organization_id=$1 AND event='CADENCE_COMPLETED' AND resource_id=$2`,
        [organizationId, created.id],
      ),
    ]);
    await fresh.end();
    expect(session.rows[0]).toMatchObject({ status: "COMPLETED", version: 2 });
    expect(commitments.rows[0].count).toBe(1);
    expect(new Set(events.rows.map((row) => row.event_type))).toEqual(
      new Set(["DECISION_RECORDED", "COMMITMENT_CREATED", "CADENCE_COMPLETED"]),
    );
    expect(audits.rows[0].count).toBe(1);
  });

  it("executes an approved 2x2 recommendation atomically and idempotently", async () => {
    const decisionId = `decision-test-${crypto.randomUUID()}`;
    const effect = {
      type: "CREATE_CADENCE",
      templateCode: "CROSS_FUNCTIONAL_2X2",
      scope: "INTERNAL",
      participants: [
        { membershipId: seller, participantRole: "SELLER", required: true },
        { membershipId: manager, participantRole: "MANAGER", required: true },
      ],
      agenda: [
        {
          type: "INTERVENTION",
          priority: 90,
          title: "Resolve risk",
          rationale: "Manager attention is required.",
          visibility: "INTERNAL_ONLY",
        },
      ],
    };
    await pool.query(
      `INSERT INTO action_decisions(id,organization_id,account_id,opportunity_id,type,recommendation,status,metadata,idempotency_key,created_at,updated_at) VALUES($1,$2,'acct-coinbase','opp-coinbase-renewal','CADENCE_RECOMMENDATION','Approve 2x2','PENDING',$3,$1,now(),now())`,
      [decisionId, organizationId, JSON.stringify({ effect })],
    );
    const results = await Promise.all([
      a.approveCadenceRecommendation({
        organizationId,
        decisionId,
        actorUserId: "user-rsm-mark",
        actorMembershipId: manager,
      }),
      b.approveCadenceRecommendation({
        organizationId,
        decisionId,
        actorUserId: "user-rsm-mark",
        actorMembershipId: manager,
      }),
    ]);
    expect(results.filter((item) => !item.replayed)).toHaveLength(1);
    expect(results[0].cadenceId ?? results[1].cadenceId).toBeTruthy();
    const state = await pool.query(
      `SELECT d.status,d.metadata->>'executionCadenceId' cadence_id,(SELECT count(*)::int FROM cadence_sessions s WHERE s.organization_id=d.organization_id AND s.idempotency_key='decision:'||d.id) session_count,(SELECT count(*)::int FROM security_audit_events a WHERE a.organization_id=d.organization_id AND a.event='REVENUE_TEAM_RECOMMENDATION_APPROVED' AND a.resource_id=d.id) audit_count FROM action_decisions d WHERE d.organization_id=$1 AND d.id=$2`,
      [organizationId, decisionId],
    );
    expect(state.rows[0]).toMatchObject({
      status: "APPROVED",
      session_count: 1,
      audit_count: 1,
    });
  });

  it("enforces tenant-safe cadence foreign keys in PostgreSQL", async () => {
    const id = crypto.randomUUID();
    await expect(
      pool.query(
        `INSERT INTO cadence_sessions(id,organization_id,template_id,status,scope,opportunity_id,created_at,updated_at) VALUES($1,'org-cognivit-demo','cadence-template-ae-se-sync','PREPARED','INTERNAL','opp-acct-globex',now(),now())`,
        [id],
      ),
    ).rejects.toMatchObject({ code: "23503" });
    await expect(
      pool.query(
        `INSERT INTO commitments(id,organization_id,owner_membership_id,description,status,visibility,created_at,updated_at) VALUES($1,'org-acme','membership-globex-technologies','invalid','OPEN','INTERNAL_ONLY',now(),now())`,
        [crypto.randomUUID()],
      ),
    ).rejects.toMatchObject({ code: "23503" });
    await expect(
      pool.query(
        `INSERT INTO manager_interventions(id,organization_id,manager_membership_id,type,status,priority_score,severity,summary,rationale,created_at,updated_at) VALUES($1,'org-acme','membership-globex-technologies','DEAL_RISK','OPEN',80,'HIGH','invalid','invalid',now(),now())`,
        [crypto.randomUUID()],
      ),
    ).rejects.toMatchObject({ code: "23503" });
  });

  it("enforces intervention lifecycle, optimistic concurrency, Twin memory, and atomic audit", async () => {
    const before = (
      await pool.query(
        `SELECT version FROM manager_interventions WHERE organization_id=$1 AND id='intervention-coinbase-security'`,
        [organizationId],
      )
    ).rows[0];
    const acknowledged = await a.updateIntervention({
      organizationId,
      interventionId: "intervention-coinbase-security",
      managerMembershipId: manager,
      actorUserId: "user-rsm-mark",
      expectedVersion: before.version,
      status: "ACKNOWLEDGED",
    });
    expect(acknowledged.status).toBe("ACKNOWLEDGED");
    await expect(
      b.updateIntervention({
        organizationId,
        interventionId: "intervention-coinbase-security",
        managerMembershipId: manager,
        actorUserId: "user-rsm-mark",
        expectedVersion: before.version,
        status: "DISMISSED",
      }),
    ).rejects.toMatchObject({ code: "CONCURRENCY_CONFLICT" });
    const persisted = await pool.query(
      `SELECT (SELECT count(*)::int FROM security_audit_events WHERE organization_id=$1 AND resource_id='intervention-coinbase-security' AND event='MANAGER_INTERVENTION_UPDATED') audit,(SELECT count(*)::int FROM revenue_digital_twin_events WHERE organization_id=$1 AND payload->>'interventionId'='intervention-coinbase-security') twin`,
      [organizationId],
    );
    expect(persisted.rows[0].audit).toBeGreaterThan(0);
    expect(persisted.rows[0].twin).toBeGreaterThan(0);
    await pool.query(
      `UPDATE manager_interventions SET status='OPEN',version=1,resolved_at=NULL WHERE organization_id=$1 AND id='intervention-coinbase-security'`,
      [organizationId],
    );
  });

  it("rejects cadence completion by an unrelated membership", async () => {
    const created = await a.createCadence({
      idempotencyKey: `unauthorized-${crypto.randomUUID()}`,
      organizationId,
      templateCode: "AE_SE_SYNC",
      scope: "INTERNAL",
      accountId: "acct-coinbase",
      opportunityId: "opp-coinbase-renewal",
      participants: [
        { membershipId: seller, participantRole: "SELLER", required: true },
      ],
      agenda: [],
      actorUserId: "user-rsm-mark",
    });
    await expect(
      a.completeCadence({
        organizationId,
        sessionId: created.id,
        expectedVersion: 1,
        actorUserId: "user-globex-owner",
        actorMembershipId: "membership-globex-technologies",
        internalSummary: "",
        externalSafeSummary: "",
        decisions: [],
        commitments: [],
        outcomes: [],
      }),
    ).rejects.toThrow(/authorized scope/);
    expect(
      (
        await pool.query(
          `SELECT status FROM cadence_sessions WHERE organization_id=$1 AND id=$2`,
          [organizationId, created.id],
        )
      ).rows[0].status,
    ).toBe("PREPARED");
  });

  it("derives VP escalation eligibility from persisted operating history", async () => {
    await pool.query(
      `DELETE FROM escalations WHERE organization_id=$1 AND opportunity_id='opp-coinbase-renewal' AND to_level='VP'`,
      [organizationId],
    );
    const session = (
      await pool.query(
        `SELECT version FROM cadence_sessions WHERE organization_id=$1 AND id='cadence-coinbase-2x2'`,
        [organizationId],
      )
    ).rows[0];
    await a.completeCadence({
      organizationId,
      sessionId: "cadence-coinbase-2x2",
      expectedVersion: session.version,
      actorUserId: "user-rsm-mark",
      actorMembershipId: manager,
      internalSummary: "Managers assigned technical and commercial owners.",
      externalSafeSummary: "",
      decisions: [],
      commitments: [],
      outcomes: [
        {
          type: "OWNERS_ASSIGNED",
          description: "Functional owners confirmed",
          visibility: "INTERNAL_ONLY",
        },
      ],
    });
    const intervention = (
      await pool.query(
        `SELECT version,status FROM manager_interventions WHERE organization_id=$1 AND id='intervention-coinbase-security'`,
        [organizationId],
      )
    ).rows[0];
    const acknowledged =
      intervention.status === "OPEN"
        ? await a.updateIntervention({
            organizationId,
            interventionId: "intervention-coinbase-security",
            managerMembershipId: manager,
            actorUserId: "user-rsm-mark",
            expectedVersion: intervention.version,
            status: "ACKNOWLEDGED",
          })
        : intervention;
    await a.updateIntervention({
      organizationId,
      interventionId: "intervention-coinbase-security",
      managerMembershipId: manager,
      actorUserId: "user-rsm-mark",
      expectedVersion: acknowledged.version,
      status: "ACTIONED",
    });
    expect(
      Number(
        (
          await pool.query(
            `SELECT count(*) FROM escalations WHERE organization_id=$1 AND opportunity_id='opp-coinbase-renewal' AND to_level='VP' AND status='ELIGIBLE'`,
            [organizationId],
          )
        ).rows[0].count,
      ),
    ).toBe(1);
    await pool.query(
      `DELETE FROM escalations WHERE organization_id=$1 AND opportunity_id='opp-coinbase-renewal' AND to_level='VP'`,
      [organizationId],
    );
    await pool.query(
      `INSERT INTO escalations(id,organization_id,account_id,opportunity_id,cadence_session_id,type,severity,from_level,to_level,reason,evidence,status,created_at) VALUES('escalation-coinbase-vp-eligible',$1,'acct-coinbase','opp-coinbase-renewal','cadence-coinbase-2x2','UNRESOLVED_STRATEGIC_RISK','HIGH','CROSS_FUNCTIONAL','VP','Security blocker remains unresolved after seller, manager, and cross-functional intervention','[]','ELIGIBLE',now())`,
      [organizationId],
    );
    await pool.query(
      `UPDATE cadence_sessions SET status='PREPARED',version=1,completed_at=NULL WHERE organization_id=$1 AND id='cadence-coinbase-2x2'`,
      [organizationId],
    );
    await pool.query(
      `UPDATE manager_interventions SET status='OPEN',version=1,resolved_at=NULL WHERE organization_id=$1 AND id='intervention-coinbase-security'`,
      [organizationId],
    );
  });

  it("persists commitment state changes with concurrency protection, Twin event, and audit", async () => {
    const row = (
      await pool.query(
        `SELECT version FROM commitments WHERE organization_id=$1 AND id='commitment-coinbase-security-response'`,
        [organizationId],
      )
    ).rows[0];
    const updated = await a.updateCommitment({
      organizationId,
      commitmentId: "commitment-coinbase-security-response",
      actorMembershipId: "membership-org-cognivit-demo-user-se-raj",
      actorUserId: "user-se-raj",
      expectedVersion: row.version,
      status: "MISSED",
      completionEvidence: { reason: "Customer dependency" },
    });
    expect(updated.status).toBe("MISSED");
    await expect(
      b.updateCommitment({
        organizationId,
        commitmentId: "commitment-coinbase-security-response",
        actorMembershipId: "membership-org-cognivit-demo-user-se-raj",
        actorUserId: "user-se-raj",
        expectedVersion: row.version,
        status: "COMPLETED",
      }),
    ).rejects.toMatchObject({ code: "CONCURRENCY_CONFLICT" });
    await pool.query(
      `UPDATE commitments SET status='OPEN',version=1,completion_evidence=NULL,completed_at=NULL WHERE organization_id=$1 AND id='commitment-coinbase-security-response'`,
      [organizationId],
    );
  });

  it("captures a cadence action before completion and lets participants update it", async () => {
    const key = `captured-action-${crypto.randomUUID()}`,
      created = await a.createCommitment({
        organizationId,
        sessionId: "cadence-coinbase-ae-se-next",
        actorMembershipId: seller,
        actorUserId: "user-ae-sarah",
        ownerMembershipId: "membership-org-cognivit-demo-user-se-raj",
        description: "Send the revised security architecture response",
        dueAt: "2026-08-20T18:00:00.000Z",
        expectedOutcome: "Customer security review resumes",
        visibility: "INTERNAL_ONLY",
        impact: "HIGH",
        idempotencyKey: key,
      });
    const replay = await b.createCommitment({
      organizationId,
      sessionId: "cadence-coinbase-ae-se-next",
      actorMembershipId: seller,
      actorUserId: "user-ae-sarah",
      ownerMembershipId: "membership-org-cognivit-demo-user-se-raj",
      description: "Send the revised security architecture response",
      dueAt: "2026-08-20T18:00:00.000Z",
      expectedOutcome: "Customer security review resumes",
      visibility: "INTERNAL_ONLY",
      impact: "HIGH",
      idempotencyKey: key,
    });
    expect(replay.id).toBe(created.id);
    const updated = await a.updateCommitment({
      organizationId,
      commitmentId: created.id,
      actorMembershipId: "membership-org-cognivit-demo-user-se-raj",
      actorUserId: "user-se-raj",
      expectedVersion: created.version,
      status: "IN_PROGRESS",
      completionEvidence: { update: "Draft is in customer review." },
    });
    expect(updated.status).toBe("IN_PROGRESS");
    const persisted = await pool.query(
      `SELECT (SELECT count(*)::int FROM commitments WHERE id=$1) commitment_count,(SELECT count(*)::int FROM security_audit_events WHERE resource_id=$1 AND event='COMMITMENT_CREATED') audit_count,(SELECT count(*)::int FROM revenue_digital_twin_events WHERE payload->>'commitmentId'=$1 AND event_type='COMMITMENT_CREATED') twin_count`,
      [created.id],
    );
    expect(persisted.rows[0]).toEqual({
      commitment_count: 1,
      audit_count: 1,
      twin_count: 1,
    });
    await pool.query(`DELETE FROM commitments WHERE id=$1`, [created.id]);
  });

  it("persists slipped commitment, intervention, 1:1 memory, and VP eligibility across a new connection", async () => {
    const independent = new Pool({ connectionString });
    const result = await independent.query(
      `SELECT (SELECT count(*) FROM commitments WHERE id='commitment-coinbase-security-response' AND status='OPEN' AND due_at<now())::int slipped,(SELECT count(*) FROM manager_interventions WHERE id='intervention-coinbase-security')::int intervention,(SELECT count(*) FROM cadence_agenda_items WHERE id='agenda-coinbase-1x1-follow-up')::int memory,(SELECT count(*) FROM escalations WHERE organization_id='org-cognivit-demo' AND opportunity_id='opp-coinbase-renewal' AND to_level='VP' AND status='ELIGIBLE')::int escalation`,
    );
    await independent.end();
    expect(result.rows[0]).toEqual({
      slipped: 1,
      intervention: 1,
      memory: 1,
      escalation: 1,
    });
  });
});
