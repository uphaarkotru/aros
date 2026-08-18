import { createHash, randomUUID } from "node:crypto";
import { Pool, type PoolClient } from "pg";
import {
  escalationEligibility,
  rankManagerIntervention,
} from "@/cadence/domain";
const json = (value: unknown) => JSON.stringify(value ?? null),
  iso = (value: unknown) =>
    value instanceof Date ? value.toISOString() : value;
type CadenceParticipantInput = {
  membershipId?: string;
  externalStakeholderId?: string;
  participationType?: string;
  participantRole: string;
  required: boolean;
};
export class CadenceConflictError extends Error {
  code = "CONCURRENCY_CONFLICT" as const;
}
export class PostgresCadenceRepository {
  private pool: Pool;
  constructor(connectionString = process.env.DATABASE_URL) {
    if (!connectionString)
      throw new Error("DATABASE_URL is required for cadence persistence");
    this.pool = new Pool({
      connectionString,
      max: Number(process.env.DATABASE_POOL_MAX ?? 5),
    });
  }
  async close() {
    await this.pool.end();
  }
  private async tx<T>(work: (client: PoolClient) => Promise<T>) {
    const client = await this.pool.connect();
    try {
      await client.query("BEGIN");
      const result = await work(client);
      await client.query("COMMIT");
      return result;
    } catch (error) {
      await client.query("ROLLBACK");
      throw error;
    } finally {
      client.release();
    }
  }
  private async maybeCreateEscalation(
    c: PoolClient,
    organizationId: string,
    opportunityId: string,
    actorMembershipId: string,
  ): Promise<string | null> {
    const facts = (
      await c.query(
        `SELECT o.account_id,o.amount::float8 amount,COALESCE(max(EXTRACT(day FROM now()-b.first_observed_at)) FILTER(WHERE b.status<>'RESOLVED'),0)::int blocker_days,(SELECT count(*)::int FROM commitments cm WHERE cm.organization_id=o.organization_id AND cm.opportunity_id=o.id AND (cm.status='MISSED' OR (cm.status IN('OPEN','IN_PROGRESS','BLOCKED') AND cm.due_at<now()))) missed_commitments,EXISTS(SELECT 1 FROM manager_interventions i WHERE i.organization_id=o.organization_id AND i.opportunity_id=o.id AND i.status IN('ACTIONED','MONITORING','RESOLVED')) manager_actioned,EXISTS(SELECT 1 FROM cadence_sessions s JOIN cadence_templates t ON(t.organization_id=s.organization_id AND t.id=s.template_id) WHERE s.organization_id=o.organization_id AND s.opportunity_id=o.id AND t.code IN('CROSS_FUNCTIONAL_2X2','STRATEGIC_DEAL_REVIEW') AND s.status='COMPLETED') cross_functional_completed FROM opportunities o LEFT JOIN cadence_blockers b ON(b.organization_id=o.organization_id AND b.opportunity_id=o.id) WHERE o.organization_id=$1 AND o.id=$2 GROUP BY o.organization_id,o.id,o.account_id,o.amount`,
        [organizationId, opportunityId],
      )
    ).rows[0];
    if (!facts) return null;
    const result = escalationEligibility({
      amount: Number(facts.amount ?? 0),
      blockerDays: Number(facts.blocker_days ?? 0),
      missedCommitments: Number(facts.missed_commitments ?? 0),
      managerInterventionCompleted: Boolean(facts.manager_actioned),
      crossFunctionalReviewCompleted: Boolean(facts.cross_functional_completed),
      riskImproved: false,
    });
    if (!result.eligible) return null;
    const inserted = (
      await c.query(
        `INSERT INTO escalations(id,organization_id,account_id,opportunity_id,type,severity,from_level,to_level,reason,evidence,status,created_at) VALUES($1,$2,$3,$4,'UNRESOLVED_STRATEGIC_RISK','HIGH','CROSS_FUNCTIONAL','VP',$5,$6,'ELIGIBLE',now()) ON CONFLICT(organization_id,opportunity_id,to_level,type) WHERE opportunity_id IS NOT NULL AND status IN('ELIGIBLE','PENDING','ACKNOWLEDGED') DO NOTHING RETURNING id`,
        [
          `escalation-${createHash("sha256").update(`${organizationId}:${opportunityId}:VP`).digest("hex").slice(0, 24)}`,
          organizationId,
          facts.account_id,
          opportunityId,
          result.reasons.join(" · "),
          json(result.reasons),
        ],
      )
    ).rows[0];
    if (inserted) {
      const actor = (
        await c.query(
          `SELECT user_id FROM organization_memberships WHERE organization_id=$1 AND id=$2`,
          [organizationId, actorMembershipId],
        )
      ).rows[0];
      if (actor)
        await this.audit(
          c,
          organizationId,
          actor.user_id,
          "ESCALATION_CREATED",
          "escalation",
          inserted.id,
          { opportunityId, toLevel: "VP", reasons: result.reasons },
        );
    }
    return inserted?.id ?? null;
  }
  async refreshManagerInterventions(
    organizationId: string,
    managerMembershipId: string,
  ) {
    await this.pool.query(
      `INSERT INTO revenue_digital_twin_events(id,organization_id,revenue_digital_twin_id,actor_membership_id,event_type,payload,occurred_at,created_at) SELECT 'commitment-missed-'||md5(c.organization_id||':'||c.id||':'||c.due_at::text),c.organization_id,t.id,c.owner_membership_id,'COMMITMENT_MISSED',jsonb_build_object('commitmentId',c.id,'dueAt',c.due_at,'status',c.status),now(),now() FROM commitments c JOIN revenue_digital_twins t ON(t.organization_id=c.organization_id AND t.account_id=c.account_id) WHERE c.organization_id=$1 AND c.status IN('OPEN','IN_PROGRESS','BLOCKED') AND c.due_at<now() ON CONFLICT(id) DO NOTHING`,
      [organizationId],
    );
    const motions = (
      await this.pool.query(
        `SELECT DISTINCT o.id opportunity_id,o.account_id,o.amount::float8 amount,o.close_date,a.name account_name,o.name opportunity_name FROM organization_relationships rel JOIN revenue_team_assignments rt ON(rt.organization_id=rel.organization_id AND rt.membership_id=rel.source_membership_id) JOIN opportunities o ON(o.organization_id=rt.organization_id AND o.id=rt.opportunity_id) JOIN accounts a ON(a.organization_id=o.organization_id AND a.id=o.account_id) WHERE rel.organization_id=$1 AND rel.target_membership_id=$2 AND rel.relationship_type='REPORTS_TO' AND rel.effective_to IS NULL`,
        [organizationId, managerMembershipId],
      )
    ).rows;
    for (const motion of motions) {
      const facts = (
        await this.pool.query(
          `SELECT COALESCE(max(EXTRACT(day FROM now()-b.first_observed_at)) FILTER(WHERE b.status<>'RESOLVED'),0)::int blocker_days,count(DISTINCT c.id) FILTER(WHERE c.status IN('OPEN','IN_PROGRESS','BLOCKED') AND c.due_at<now())::int overdue_commitments,EXISTS(SELECT 1 FROM revenue_signals s WHERE s.organization_id=$1 AND s.opportunity_id=$2 AND (lower(s.type) LIKE '%executive%' OR lower(s.payload::text) LIKE '%executive%declin%')) executive_declining,EXISTS(SELECT 1 FROM revenue_signals s WHERE s.organization_id=$1 AND s.opportunity_id=$2 AND (lower(s.type) LIKE '%methodology%' OR lower(s.payload::text) LIKE '%methodology%gap%')) methodology_gap,(SELECT count(*)::int FROM leading_indicators li WHERE li.organization_id=$1 AND li.opportunity_id=$2 AND li.status IN('WATCH','AT_RISK','CRITICAL')) indicator_risk_count,(SELECT COALESCE(max(updated_at),to_timestamp(0)) FROM commitments WHERE organization_id=$1 AND opportunity_id=$2) commitment_changed,(SELECT COALESCE(max(updated_at),to_timestamp(0)) FROM cadence_blockers WHERE organization_id=$1 AND opportunity_id=$2) blocker_changed FROM cadence_blockers b FULL JOIN commitments c ON(c.organization_id=b.organization_id AND c.opportunity_id=b.opportunity_id) WHERE COALESCE(b.organization_id,c.organization_id)=$1 AND COALESCE(b.opportunity_id,c.opportunity_id)=$2`,
          [organizationId, motion.opportunity_id],
        )
      ).rows[0];
      const coverage = new Set(
        (
          await this.pool.query(
            `SELECT participation_type FROM revenue_team_assignments WHERE organization_id=$1 AND opportunity_id=$2`,
            [organizationId, motion.opportunity_id],
          )
        ).rows.map((row) => row.participation_type),
      );
      const security = await this.pool.query(
          `SELECT 1 FROM cadence_blockers WHERE organization_id=$1 AND opportunity_id=$2 AND status<>'RESOLVED' AND (type='SECURITY' OR lower(description) LIKE '%security%' OR lower(description) LIKE '%architecture%') LIMIT 1`,
          [organizationId, motion.opportunity_id],
        ),
        coverageGapCount =
          security.rowCount && !coverage.has("TECHNICAL_EXECUTIVE") ? 1 : 0,
        daysToClose = motion.close_date
          ? Math.ceil(
              (new Date(motion.close_date).getTime() - Date.now()) / 86_400_000,
            )
          : 365,
        result = rankManagerIntervention({
          amount: Number(motion.amount ?? 0),
          daysToClose,
          blockerDays: Number(facts.blocker_days ?? 0),
          overdueCommitments: Number(facts.overdue_commitments ?? 0),
          executiveEngagementDeclining: Boolean(facts.executive_declining),
          methodologyGap: Boolean(facts.methodology_gap),
          coverageGapCount,
          indicatorRiskCount: Number(facts.indicator_risk_count ?? 0),
          strategic: Number(motion.amount ?? 0) >= 10_000_000,
        });
      if (result.score < 35) continue;
      const current = (
          await this.pool.query(
            `SELECT status,resolved_at FROM manager_interventions WHERE organization_id=$1 AND manager_membership_id=$2 AND opportunity_id=$3`,
            [organizationId, managerMembershipId, motion.opportunity_id],
          )
        ).rows[0],
        latestEvidence = Math.max(
          new Date(facts.commitment_changed).getTime(),
          new Date(facts.blocker_changed).getTime(),
        );
      if (
        current?.status === "RESOLVED" &&
        current.resolved_at &&
        latestEvidence <= new Date(current.resolved_at).getTime()
      )
        continue;
      const type =
          Number(facts.overdue_commitments) > 0
            ? "COMMITMENT_SLIPPAGE"
            : Number(facts.blocker_days) > 0
              ? "TECHNICAL_BLOCKER"
              : coverageGapCount
                ? "REVENUE_TEAM_COVERAGE_GAP"
                : "DEAL_RISK",
        id = `intervention-${createHash("sha256").update(`${organizationId}:${managerMembershipId}:${motion.opportunity_id}`).digest("hex").slice(0, 24)}`;
      await this.pool.query(
        `INSERT INTO manager_interventions(id,organization_id,manager_membership_id,seller_membership_id,account_id,opportunity_id,type,status,priority_score,severity,summary,rationale,evidence,recommended_action,created_at,updated_at) SELECT $1,$2,$3,rel.source_membership_id,$4,$5,$6,'OPEN',$7,$8,$9,$10,$11,$12,now(),now() FROM organization_relationships rel WHERE rel.organization_id=$2 AND rel.target_membership_id=$3 AND rel.relationship_type='REPORTS_TO' AND rel.effective_to IS NULL AND EXISTS(SELECT 1 FROM revenue_team_assignments rt WHERE rt.organization_id=rel.organization_id AND rt.membership_id=rel.source_membership_id AND rt.opportunity_id=$5) ORDER BY rel.is_primary DESC LIMIT 1 ON CONFLICT(organization_id,manager_membership_id,opportunity_id) WHERE opportunity_id IS NOT NULL DO UPDATE SET type=excluded.type,priority_score=excluded.priority_score,severity=excluded.severity,summary=excluded.summary,rationale=excluded.rationale,evidence=excluded.evidence,recommended_action=excluded.recommended_action,status=CASE WHEN manager_interventions.status IN('RESOLVED','DISMISSED') THEN 'OPEN' ELSE manager_interventions.status END,updated_at=now()`,
        [
          id,
          organizationId,
          managerMembershipId,
          motion.account_id,
          motion.opportunity_id,
          type,
          result.score,
          result.score >= 85
            ? "CRITICAL"
            : result.score >= 65
              ? "HIGH"
              : "MEDIUM",
          `${motion.account_name} needs manager attention`,
          result.reasons.join(" · "),
          json(result.reasons),
          type === "COMMITMENT_SLIPPAGE"
            ? "Review slipped commitments and select the appropriate cross-functional cadence"
            : type === "TECHNICAL_BLOCKER"
              ? "Initiate technical intervention cadence"
              : "Review the recommended intervention",
        ],
      );
    }
    return motions.length;
  }
  async getRsmBrief(organizationId: string, managerMembershipId: string) {
    const interventions = (
      await this.pool.query(
        `SELECT i.*,o.name opportunity_name,o.amount::float8 amount,a.name account_name FROM manager_interventions i LEFT JOIN opportunities o ON(o.organization_id=i.organization_id AND o.id=i.opportunity_id) LEFT JOIN accounts a ON(a.organization_id=i.organization_id AND a.id=i.account_id) WHERE i.organization_id=$1 AND i.manager_membership_id=$2 AND i.status NOT IN('RESOLVED','DISMISSED') ORDER BY i.priority_score DESC,i.created_at`,
        [organizationId, managerMembershipId],
      )
    ).rows;
    const reports = (
      await this.pool.query(
        `SELECT m.id membership_id,u.id user_id,u.display_name,count(DISTINCT rt.opportunity_id)::int opportunity_count,count(DISTINCT c.id) FILTER(WHERE c.status IN('OPEN','IN_PROGRESS','BLOCKED') AND c.due_at<now())::int overdue_commitments FROM organization_relationships r JOIN organization_memberships m ON(m.organization_id=r.organization_id AND m.id=r.source_membership_id) JOIN users u ON u.id=m.user_id LEFT JOIN revenue_team_assignments rt ON(rt.organization_id=m.organization_id AND rt.membership_id=m.id) LEFT JOIN commitments c ON(c.organization_id=m.organization_id AND c.owner_membership_id=m.id) WHERE r.organization_id=$1 AND r.target_membership_id=$2 AND r.relationship_type='REPORTS_TO' AND r.effective_to IS NULL AND m.status='ACTIVE' GROUP BY m.id,u.id,u.display_name`,
        [organizationId, managerMembershipId],
      )
    ).rows;
    const commitments = (
      await this.pool.query(
        `SELECT c.*,u.display_name owner_name,a.name account_name,o.name opportunity_name FROM commitments c LEFT JOIN organization_memberships m ON(m.organization_id=c.organization_id AND m.id=c.owner_membership_id) LEFT JOIN users u ON u.id=m.user_id LEFT JOIN accounts a ON(a.organization_id=c.organization_id AND a.id=c.account_id) LEFT JOIN opportunities o ON(o.organization_id=c.organization_id AND o.id=c.opportunity_id) WHERE c.organization_id=$1 AND (c.owner_membership_id=ANY($2::text[]) OR EXISTS(SELECT 1 FROM manager_interventions i WHERE i.organization_id=c.organization_id AND i.opportunity_id=c.opportunity_id AND i.manager_membership_id=$3)) AND c.status NOT IN('COMPLETED','CANCELLED') ORDER BY c.due_at NULLS LAST`,
        [
          organizationId,
          reports.map((r) => r.membership_id),
          managerMembershipId,
        ],
      )
    ).rows;
    const decisions = (
      await this.pool.query(
        `SELECT * FROM action_decisions WHERE organization_id=$1 AND status='PENDING' AND type<>'CADENCE_RECOMMENDATION' AND opportunity_id IN(SELECT opportunity_id FROM manager_interventions WHERE organization_id=$1 AND manager_membership_id=$2) ORDER BY COALESCE((metadata->>'priorityScore')::numeric,0) DESC,updated_at DESC`,
        [organizationId, managerMembershipId],
      )
    ).rows;
    const coachingInsights = (
      await this.pool.query(
        `SELECT ci.id,ci.title,ci.insight,ci.suggested_action,ci.membership_id,u.display_name FROM coaching_insights ci JOIN organization_memberships m ON(m.organization_id=ci.organization_id AND m.id=ci.membership_id) JOIN users u ON u.id=m.user_id WHERE ci.organization_id=$1 AND ci.membership_id=ANY($2::text[]) ORDER BY ci.updated_at DESC`,
        [organizationId, reports.map((report) => report.membership_id)],
      )
    ).rows;
    return {
      interventions: interventions.map((row) => ({
        ...row,
        created_at: iso(row.created_at),
        updated_at: iso(row.updated_at),
      })),
      reports,
      commitments: commitments.map((row) => ({
        ...row,
        due_at: iso(row.due_at),
        created_at: iso(row.created_at),
        updated_at: iso(row.updated_at),
      })),
      decisions,
      coachingInsights,
    };
  }
  async getIntervention(
    organizationId: string,
    managerMembershipId: string,
    id: string,
  ) {
    const intervention = (
      await this.pool.query(
        `SELECT * FROM manager_interventions WHERE organization_id=$1 AND manager_membership_id=$2 AND id=$3`,
        [organizationId, managerMembershipId, id],
      )
    ).rows[0];
    if (!intervention) return null;
    const [team, cadences, commitments, blockers, escalations] =
      await Promise.all([
        this.pool.query(
          `SELECT r.participation_type,u.display_name,rd.name organization_role FROM revenue_team_assignments r JOIN organization_memberships m ON(m.organization_id=r.organization_id AND m.id=r.membership_id) JOIN users u ON u.id=m.user_id LEFT JOIN organization_role_definitions rd ON(rd.organization_id=r.organization_id AND rd.id=r.organization_role_definition_id) WHERE r.organization_id=$1 AND r.opportunity_id=$2`,
          [organizationId, intervention.opportunity_id],
        ),
        this.pool.query(
          `SELECT s.*,t.name template_name FROM cadence_sessions s JOIN cadence_templates t ON(t.organization_id=s.organization_id AND t.id=s.template_id) WHERE s.organization_id=$1 AND s.opportunity_id=$2 ORDER BY s.created_at DESC`,
          [organizationId, intervention.opportunity_id],
        ),
        this.pool.query(
          `SELECT * FROM commitments WHERE organization_id=$1 AND opportunity_id=$2 ORDER BY due_at`,
          [organizationId, intervention.opportunity_id],
        ),
        this.pool.query(
          `SELECT * FROM cadence_blockers WHERE organization_id=$1 AND opportunity_id=$2 AND status<>'RESOLVED'`,
          [organizationId, intervention.opportunity_id],
        ),
        this.pool.query(
          `SELECT * FROM escalations WHERE organization_id=$1 AND opportunity_id=$2 ORDER BY created_at DESC`,
          [organizationId, intervention.opportunity_id],
        ),
      ]);
    return {
      intervention,
      team: team.rows,
      cadences: cadences.rows,
      commitments: commitments.rows,
      blockers: blockers.rows,
      escalations: escalations.rows,
    };
  }
  async getExternalSafeCadence(organizationId: string, sessionId: string) {
    const session = (
      await this.pool.query(
        `SELECT s.id,s.scope,s.status,s.external_safe_summary,s.scheduled_at,s.completed_at FROM cadence_sessions s WHERE s.organization_id=$1 AND s.id=$2 AND s.scope IN('CUSTOMER','PROSPECT','PARTNER','EXECUTIVE')`,
        [organizationId, sessionId],
      )
    ).rows[0];
    if (!session) return null;
    const [agenda, decisions, commitments, outcomes] = await Promise.all([
      this.pool.query(
        `SELECT type,priority,title,rationale,recommended_discussion,recommended_decision,status FROM cadence_agenda_items WHERE organization_id=$1 AND cadence_session_id=$2 AND visibility='EXTERNAL_SHAREABLE' ORDER BY priority DESC`,
        [organizationId, sessionId],
      ),
      this.pool.query(
        `SELECT decision_type,decision,rationale,created_at FROM cadence_decisions WHERE organization_id=$1 AND cadence_session_id=$2 AND visibility='EXTERNAL_SHAREABLE'`,
        [organizationId, sessionId],
      ),
      this.pool.query(
        `SELECT description,due_at,status,expected_outcome FROM commitments WHERE organization_id=$1 AND cadence_session_id=$2 AND visibility='EXTERNAL_SHAREABLE'`,
        [organizationId, sessionId],
      ),
      this.pool.query(
        `SELECT outcome_type,description,impact FROM cadence_outcomes WHERE organization_id=$1 AND cadence_session_id=$2 AND visibility='EXTERNAL_SHAREABLE'`,
        [organizationId, sessionId],
      ),
    ]);
    return {
      ...session,
      agenda: agenda.rows,
      decisions: decisions.rows,
      commitments: commitments.rows,
      outcomes: outcomes.rows,
    };
  }
  private async canAccessCadence(
    c: Pool | PoolClient,
    organizationId: string,
    sessionId: string,
    membershipId: string,
  ) {
    return Boolean(
      (
        await c.query(
          `SELECT 1 FROM cadence_sessions s WHERE s.organization_id=$1 AND s.id=$2 AND (EXISTS(SELECT 1 FROM cadence_participants p WHERE p.organization_id=s.organization_id AND p.cadence_session_id=s.id AND p.membership_id=$3) OR EXISTS(SELECT 1 FROM cadence_participants p JOIN organization_relationships r ON(r.organization_id=p.organization_id AND r.source_membership_id=p.membership_id AND r.target_membership_id=$3 AND r.relationship_type='REPORTS_TO' AND r.effective_to IS NULL) WHERE p.organization_id=s.organization_id AND p.cadence_session_id=s.id))`,
          [organizationId, sessionId, membershipId],
        )
      ).rowCount,
    );
  }
  async getCadence(
    organizationId: string,
    sessionId: string,
    membershipId: string,
  ) {
    if (
      !(await this.canAccessCadence(
        this.pool,
        organizationId,
        sessionId,
        membershipId,
      ))
    )
      return null;
    const session = (
      await this.pool.query(
        `SELECT s.*,t.code template_code,t.name template_name FROM cadence_sessions s JOIN cadence_templates t ON(t.organization_id=s.organization_id AND t.id=s.template_id) WHERE s.organization_id=$1 AND s.id=$2`,
        [organizationId, sessionId],
      )
    ).rows[0];
    if (!session) return null;
    const [
      participants,
      agenda,
      decisions,
      commitments,
      blockers,
      outcomes,
      aiDecisions,
      carryForwardCommitments,
      signals,
    ] = await Promise.all([
      this.pool.query(
        `SELECT p.*,u.display_name,st.name external_name FROM cadence_participants p LEFT JOIN organization_memberships m ON(m.organization_id=p.organization_id AND m.id=p.membership_id) LEFT JOIN users u ON u.id=m.user_id LEFT JOIN revenue_stakeholders st ON(st.organization_id=p.organization_id AND st.id=p.external_stakeholder_id) WHERE p.organization_id=$1 AND p.cadence_session_id=$2`,
        [organizationId, sessionId],
      ),
      this.pool.query(
        `SELECT * FROM cadence_agenda_items WHERE organization_id=$1 AND cadence_session_id=$2 ORDER BY priority DESC`,
        [organizationId, sessionId],
      ),
      this.pool.query(
        `SELECT * FROM cadence_decisions WHERE organization_id=$1 AND cadence_session_id=$2 ORDER BY created_at`,
        [organizationId, sessionId],
      ),
      this.pool.query(
        `SELECT c.*,u.display_name owner_name,t.name source_cadence FROM commitments c LEFT JOIN organization_memberships m ON(m.organization_id=c.organization_id AND m.id=c.owner_membership_id) LEFT JOIN users u ON u.id=m.user_id LEFT JOIN cadence_sessions source ON(source.organization_id=c.organization_id AND source.id=c.cadence_session_id) LEFT JOIN cadence_templates t ON(t.organization_id=source.organization_id AND t.id=source.template_id) WHERE c.organization_id=$1 AND c.cadence_session_id=$2 ORDER BY c.due_at`,
        [organizationId, sessionId],
      ),
      this.pool.query(
        `SELECT * FROM cadence_blockers WHERE organization_id=$1 AND cadence_session_id=$2 ORDER BY first_observed_at`,
        [organizationId, sessionId],
      ),
      this.pool.query(
        `SELECT * FROM cadence_outcomes WHERE organization_id=$1 AND cadence_session_id=$2 ORDER BY created_at`,
        [organizationId, sessionId],
      ),
      this.pool.query(
        `SELECT id,type,recommendation,status,evidence,metadata,updated_at FROM action_decisions WHERE organization_id=$1 AND type<>'CADENCE_RECOMMENDATION' AND status IN('PENDING','APPROVED','EDITED','SNOOZED') AND (($2::text IS NOT NULL AND opportunity_id=$2) OR ($2::text IS NULL AND account_id=$3)) ORDER BY COALESCE((metadata->>'priorityScore')::numeric,0) DESC,updated_at DESC,id`,
        [organizationId, session.opportunity_id, session.account_id],
      ),
      this.pool.query(
        `SELECT c.id,c.description,c.due_at,c.status,c.expected_outcome,c.impact,c.version,u.display_name owner_name,t.name source_cadence FROM commitments c LEFT JOIN organization_memberships m ON(m.organization_id=c.organization_id AND m.id=c.owner_membership_id) LEFT JOIN users u ON u.id=m.user_id LEFT JOIN cadence_sessions source ON(source.organization_id=c.organization_id AND source.id=c.cadence_session_id) LEFT JOIN cadence_templates t ON(t.organization_id=source.organization_id AND t.id=source.template_id) WHERE c.organization_id=$1 AND c.cadence_session_id<>$2 AND c.status IN('OPEN','IN_PROGRESS','BLOCKED','MISSED') AND (($3::text IS NOT NULL AND c.opportunity_id=$3) OR ($3::text IS NULL AND c.account_id=$4)) AND (source.id IS NULL OR t.code NOT IN('MANAGER_1_ON_1','SE_MANAGER_1_ON_1') OR EXISTS(SELECT 1 FROM cadence_participants private_participant WHERE private_participant.organization_id=c.organization_id AND private_participant.cadence_session_id=source.id AND private_participant.membership_id=$5)) ORDER BY c.due_at NULLS LAST,c.created_at`,
        [
          organizationId,
          sessionId,
          session.opportunity_id,
          session.account_id,
          membershipId,
        ],
      ),
      this.pool.query(
        `SELECT id,type,severity,payload,observed_at FROM revenue_signals WHERE organization_id=$1 AND (($2::text IS NOT NULL AND opportunity_id=$2) OR account_id=$3) ORDER BY observed_at DESC LIMIT 5`,
        [organizationId, session.opportunity_id, session.account_id],
      ),
    ]);
    return {
      session,
      participants: participants.rows,
      agenda: agenda.rows,
      decisions: decisions.rows,
      commitments: commitments.rows,
      blockers: blockers.rows,
      outcomes: outcomes.rows,
      aiDecisions: aiDecisions.rows,
      carryForwardCommitments: carryForwardCommitments.rows,
      signals: signals.rows,
    };
  }
  async listCadences(organizationId: string, membershipId: string) {
    return (
      await this.pool.query(
        `SELECT s.id,s.status,s.scope,s.scheduled_at,s.completed_at,s.preparation_summary,t.code template_code,t.name template_name,o.name opportunity_name,a.name account_name,(SELECT count(*)::int FROM cadence_agenda_items ai WHERE ai.organization_id=s.organization_id AND ai.cadence_session_id=s.id) agenda_count,(SELECT count(*)::int FROM commitments c LEFT JOIN cadence_sessions source ON(source.organization_id=c.organization_id AND source.id=c.cadence_session_id) LEFT JOIN cadence_templates source_template ON(source_template.organization_id=source.organization_id AND source_template.id=source.template_id) WHERE c.organization_id=s.organization_id AND c.cadence_session_id<>s.id AND c.status IN('OPEN','IN_PROGRESS','BLOCKED','MISSED') AND (c.opportunity_id=s.opportunity_id OR (s.opportunity_id IS NULL AND c.account_id=s.account_id)) AND (source.id IS NULL OR source_template.code NOT IN('MANAGER_1_ON_1','SE_MANAGER_1_ON_1') OR EXISTS(SELECT 1 FROM cadence_participants private_participant WHERE private_participant.organization_id=c.organization_id AND private_participant.cadence_session_id=source.id AND private_participant.membership_id=$2))) carry_forward_count,(SELECT string_agg(COALESCE(u.display_name,st.name),', ' ORDER BY COALESCE(u.display_name,st.name)) FROM cadence_participants cp LEFT JOIN organization_memberships m ON(m.organization_id=cp.organization_id AND m.id=cp.membership_id) LEFT JOIN users u ON u.id=m.user_id LEFT JOIN revenue_stakeholders st ON(st.organization_id=cp.organization_id AND st.id=cp.external_stakeholder_id) WHERE cp.organization_id=s.organization_id AND cp.cadence_session_id=s.id) participant_names FROM cadence_sessions s JOIN cadence_templates t ON(t.organization_id=s.organization_id AND t.id=s.template_id) LEFT JOIN opportunities o ON(o.organization_id=s.organization_id AND o.id=s.opportunity_id) LEFT JOIN accounts a ON(a.organization_id=s.organization_id AND a.id=s.account_id) WHERE s.organization_id=$1 AND (EXISTS(SELECT 1 FROM cadence_participants p WHERE p.organization_id=s.organization_id AND p.cadence_session_id=s.id AND p.membership_id=$2) OR EXISTS(SELECT 1 FROM cadence_participants p JOIN organization_relationships r ON(r.organization_id=p.organization_id AND r.source_membership_id=p.membership_id AND r.target_membership_id=$2 AND r.relationship_type='REPORTS_TO' AND r.effective_to IS NULL) WHERE p.organization_id=s.organization_id AND p.cadence_session_id=s.id)) ORDER BY CASE s.status WHEN 'PREPARED' THEN 0 WHEN 'SCHEDULED' THEN 1 WHEN 'IN_PROGRESS' THEN 2 ELSE 3 END,s.scheduled_at NULLS LAST,s.created_at DESC`,
        [organizationId, membershipId],
      )
    ).rows;
  }
  private async resolveParticipants(
    c: PoolClient,
    input: {
      organizationId: string;
      opportunityId: string | null;
      templateCode: string;
      actorMembershipId?: string;
    },
  ): Promise<CadenceParticipantInput[]> {
    if (!input.opportunityId)
      return input.actorMembershipId
        ? [
            {
              membershipId: input.actorMembershipId,
              participantRole: "OWNER",
              required: true,
            },
          ]
        : [];
    const team = (
        await c.query(
          `SELECT membership_id,participation_type FROM revenue_team_assignments WHERE organization_id=$1 AND opportunity_id=$2 ORDER BY is_primary_owner DESC,created_at`,
          [input.organizationId, input.opportunityId],
        )
      ).rows,
      byType = new Map<
        string,
        { membership_id: string; participation_type: string }[]
      >();
    for (const row of team)
      byType.set(row.participation_type, [
        ...(byType.get(row.participation_type) ?? []),
        row,
      ]);
    const wanted =
        input.templateCode === "AE_SE_SYNC"
          ? ["PRIMARY_SELLER", "SALES_ENGINEERING"]
          : input.templateCode === "AE_SDR_SYNC"
            ? ["PRIMARY_SELLER", "PROSPECTING"]
            : input.templateCode === "AE_PARTNER_SYNC"
              ? ["PRIMARY_SELLER", "PARTNER"]
              : input.templateCode === "CROSS_FUNCTIONAL_2X2"
                ? ["PRIMARY_SELLER", "SALES_ENGINEERING"]
                : input.templateCode === "MANAGER_1_ON_1"
                  ? ["PRIMARY_SELLER"]
                  : input.templateCode === "SE_MANAGER_1_ON_1"
                    ? ["SALES_ENGINEERING"]
                    : team.map((row) => row.participation_type),
      selected = wanted.flatMap((type) => (byType.get(type) ?? []).slice(0, 1)),
      participants: CadenceParticipantInput[] = selected.map((row) => ({
        membershipId: row.membership_id,
        participationType: row.participation_type,
        participantRole: row.participation_type,
        required: true,
      }));
    if (
      input.actorMembershipId &&
      !participants.some(
        (item) => item.membershipId === input.actorMembershipId,
      )
    )
      participants.push({
        membershipId: input.actorMembershipId,
        participationType: undefined,
        participantRole: input.templateCode.includes("MANAGER")
          ? "MANAGER"
          : "CONVENER",
        required: true,
      });
    if (input.templateCode === "CROSS_FUNCTIONAL_2X2")
      for (const member of [...participants]) {
        if (!member.participationType) continue;
        const manager = (
          await c.query(
            `SELECT target_membership_id FROM organization_relationships WHERE organization_id=$1 AND source_membership_id=$2 AND relationship_type='REPORTS_TO' AND effective_to IS NULL ORDER BY is_primary DESC LIMIT 1`,
            [input.organizationId, member.membershipId],
          )
        ).rows[0];
        if (
          manager &&
          !participants.some(
            (item) => item.membershipId === manager.target_membership_id,
          )
        )
          participants.push({
            membershipId: manager.target_membership_id,
            participationType: undefined,
            participantRole:
              member.participationType === "SALES_ENGINEERING"
                ? "SE_MANAGER"
                : "SELLER_MANAGER",
            required: true,
          });
      }
    return participants;
  }
  private async prepareAgenda(
    c: PoolClient,
    input: {
      organizationId: string;
      opportunityId: string | null;
      templateCode: string;
      scope: string;
    },
  ) {
    const external = input.scope !== "INTERNAL",
      agenda: {
        type: string;
        priority: number;
        title: string;
        rationale: string;
        evidence?: unknown[];
        recommendedDiscussion?: string;
        recommendedDecision?: string;
        visibility: string;
      }[] = [];
    if (input.opportunityId) {
      const blockers = (
          await c.query(
            `SELECT type,severity,description,first_observed_at FROM cadence_blockers WHERE organization_id=$1 AND opportunity_id=$2 AND status<>'RESOLVED' ORDER BY CASE severity WHEN 'CRITICAL' THEN 0 WHEN 'HIGH' THEN 1 ELSE 2 END,first_observed_at LIMIT 3`,
            [input.organizationId, input.opportunityId],
          )
        ).rows,
        indicators = external
          ? []
          : (
              await c.query(
                `SELECT indicator_type,status,rationale,evidence FROM leading_indicators WHERE organization_id=$1 AND opportunity_id=$2 AND status IN('WATCH','AT_RISK','CRITICAL') ORDER BY CASE status WHEN 'CRITICAL' THEN 0 WHEN 'AT_RISK' THEN 1 ELSE 2 END,observed_at DESC LIMIT 5`,
                [input.organizationId, input.opportunityId],
              )
            ).rows,
        overdue = (
          await c.query(
            `SELECT description,due_at,status FROM commitments WHERE organization_id=$1 AND opportunity_id=$2 AND status IN('OPEN','IN_PROGRESS','BLOCKED') AND due_at<now() ORDER BY due_at LIMIT 3`,
            [input.organizationId, input.opportunityId],
          )
        ).rows;
      for (const blocker of blockers)
        agenda.push({
          type: "BLOCKER",
          priority: blocker.severity === "CRITICAL" ? 100 : 85,
          title: blocker.description,
          rationale: `${blocker.severity} blocker remains unresolved.`,
          evidence: [{ firstObservedAt: blocker.first_observed_at }],
          recommendedDiscussion:
            "Confirm owner, evidence required, and dated next checkpoint.",
          recommendedDecision:
            "Assign accountable owner and escalation condition.",
          visibility: "INTERNAL_ONLY",
        });
      for (const indicator of indicators)
        agenda.push({
          type: "LEADING_INDICATOR",
          priority:
            indicator.status === "CRITICAL"
              ? 98
              : indicator.status === "AT_RISK"
                ? 90
                : 82,
          title: indicator.rationale,
          rationale: `${indicator.indicator_type.replaceAll("_", " ")} is ${indicator.status.replaceAll("_", " ")}.`,
          evidence: indicator.evidence,
          recommendedDiscussion:
            "Confirm the evidence, owner, and next dated intervention.",
          recommendedDecision:
            "Agree the smallest action that can improve the indicator.",
          visibility: "INTERNAL_ONLY",
        });
      if (overdue.length)
        agenda.push({
          type: "COMMITMENT_SLIPPAGE",
          priority: 95,
          title: `${overdue.length} commitment${overdue.length === 1 ? " is" : "s are"} overdue`,
          rationale:
            "Unfinished commitments are blocking revenue-motion progress.",
          evidence: overdue,
          recommendedDiscussion:
            "Identify dependency, recovery date, and owner.",
          recommendedDecision: "Accept recovery plan or escalate.",
          visibility: "INTERNAL_ONLY",
        });
    }
    const focus: Record<string, [string, string]> = {
        MANAGER_1_ON_1: [
          "Execution and coaching follow-up",
          "Review changes, prior commitments, priority deals, coaching themes, and decisions needed.",
        ],
        SE_MANAGER_1_ON_1: [
          "Technical workload and risk",
          "Review technical commitments, resource conflicts, strategic opportunities, and coaching.",
        ],
        AE_SE_SYNC: [
          "Commercial and technical alignment",
          "Align blockers, stakeholders, milestones, evidence, and functional commitments.",
        ],
        AE_SDR_SYNC: [
          "Prospecting motion and handoff",
          "Review target engagement, missing personas, handoff quality, and next commitments.",
        ],
        AE_PARTNER_SYNC: [
          "Partner co-sell execution",
          "Review influence, introductions, marketplace dependencies, and joint commitments.",
        ],
        CROSS_FUNCTIONAL_2X2: [
          "Cross-functional intervention",
          "Resolve technical/commercial disagreement, resources, ownership, and escalation conditions.",
        ],
        STRATEGIC_DEAL_REVIEW: [
          "Strategic revenue-motion review",
          "Review deal health, coverage, blockers, commitments, stakeholders, and decisions.",
        ],
        SECURITY_REVIEW: [
          "Agree security review next steps",
          "Confirm open requirements, owners, deliverables, and next checkpoint.",
        ],
        CUSTOMER_NEXT_STEP: [
          "Agree mutual next steps",
          "Confirm milestones, owners, dates, decision criteria, and the next meeting.",
        ],
        MUTUAL_ACTION_PLAN_CHECKPOINT: [
          "Mutual Action Plan checkpoint",
          "Review shared milestones, commitments, risks, and next dates.",
        ],
      },
      entry = focus[input.templateCode] ?? [
        "Revenue-motion next step",
        "Review changes, evidence, decisions, commitments, and outcomes.",
      ];
    agenda.push({
      type: "TEMPLATE_FOCUS",
      priority: 80,
      title: entry[0],
      rationale: entry[1],
      recommendedDiscussion: entry[1],
      visibility: external ? "EXTERNAL_SHAREABLE" : "INTERNAL_ONLY",
    });
    return agenda;
  }
  async updateIntervention(input: {
    organizationId: string;
    interventionId: string;
    managerMembershipId: string;
    actorUserId: string;
    expectedVersion: number;
    status: string;
  }) {
    const transitions: Record<string, string[]> = {
      OPEN: ["ACKNOWLEDGED", "DISMISSED"],
      ACKNOWLEDGED: ["ACTIONED", "DISMISSED"],
      ACTIONED: ["MONITORING", "RESOLVED"],
      MONITORING: ["ACTIONED", "RESOLVED"],
      RESOLVED: [],
      DISMISSED: [],
    };
    return this.tx(async (c) => {
      const row = (
        await c.query(
          `SELECT * FROM manager_interventions WHERE organization_id=$1 AND id=$2 AND manager_membership_id=$3 FOR UPDATE`,
          [
            input.organizationId,
            input.interventionId,
            input.managerMembershipId,
          ],
        )
      ).rows[0];
      if (!row) throw new CadenceConflictError("Intervention not found.");
      if (row.version !== input.expectedVersion)
        throw new CadenceConflictError(
          "This intervention changed. Refresh and try again.",
        );
      if (!transitions[row.status]?.includes(input.status))
        throw new CadenceConflictError(
          `Cannot change intervention from ${row.status} to ${input.status}.`,
        );
      const updated = (
        await c.query(
          `UPDATE manager_interventions SET status=$4,resolved_at=CASE WHEN $4 IN('RESOLVED','DISMISSED') THEN now() ELSE NULL END,version=version+1,updated_at=now() WHERE organization_id=$1 AND id=$2 AND manager_membership_id=$3 RETURNING *`,
          [
            input.organizationId,
            input.interventionId,
            input.managerMembershipId,
            input.status,
          ],
        )
      ).rows[0];
      await c.query(
        `INSERT INTO revenue_digital_twin_events(id,organization_id,revenue_digital_twin_id,actor_membership_id,event_type,payload,occurred_at,created_at) SELECT $1,$2,id,$3,$4,$5,now(),now() FROM revenue_digital_twins WHERE organization_id=$2 AND account_id=$6`,
        [
          randomUUID(),
          input.organizationId,
          input.managerMembershipId,
          input.status === "RESOLVED"
            ? "MANAGER_INTERVENTION_RESOLVED"
            : "MANAGER_INTERVENTION_UPDATED",
          json({ interventionId: row.id, status: input.status }),
          row.account_id,
        ],
      );
      await this.audit(
        c,
        input.organizationId,
        input.actorUserId,
        input.status === "RESOLVED"
          ? "MANAGER_INTERVENTION_RESOLVED"
          : "MANAGER_INTERVENTION_UPDATED",
        "manager_intervention",
        row.id,
        { from: row.status, to: input.status },
      );
      if (row.opportunity_id)
        await this.maybeCreateEscalation(
          c,
          input.organizationId,
          row.opportunity_id,
          input.managerMembershipId,
        );
      return updated;
    });
  }
  async updateCommitment(input: {
    organizationId: string;
    commitmentId: string;
    actorMembershipId: string;
    actorUserId: string;
    expectedVersion: number;
    status: string;
    completionEvidence?: unknown;
  }) {
    return this.tx(async (c) => {
      const row = (
        await c.query(
          `SELECT c.* FROM commitments c WHERE c.organization_id=$1 AND c.id=$2 FOR UPDATE`,
          [input.organizationId, input.commitmentId],
        )
      ).rows[0];
      if (!row) throw new CadenceConflictError("Commitment not found.");
      const canEdit =
        row.owner_membership_id === input.actorMembershipId ||
        (row.cadence_session_id &&
          (await this.canAccessCadence(
            c,
            input.organizationId,
            row.cadence_session_id,
            input.actorMembershipId,
          )));
      if (!canEdit)
        throw new CadenceConflictError(
          "Commitment is outside your authorized scope.",
        );
      if (row.version !== input.expectedVersion)
        throw new CadenceConflictError(
          "This commitment changed. Refresh and try again.",
        );
      const completed = ["COMPLETED", "MISSED", "CANCELLED"].includes(
          input.status,
        ),
        updated = (
          await c.query(
            `UPDATE commitments SET status=$3,completion_evidence=$4,completed_at=CASE WHEN $3='COMPLETED' THEN now() ELSE completed_at END,version=version+1,updated_at=now() WHERE organization_id=$1 AND id=$2 RETURNING *`,
            [
              input.organizationId,
              input.commitmentId,
              input.status,
              json(input.completionEvidence),
            ],
          )
        ).rows[0],
        event =
          input.status === "COMPLETED"
            ? "COMMITMENT_COMPLETED"
            : input.status === "MISSED"
              ? "COMMITMENT_MISSED"
              : "COMMITMENT_UPDATED";
      await c.query(
        `INSERT INTO revenue_digital_twin_events(id,organization_id,revenue_digital_twin_id,actor_membership_id,event_type,payload,occurred_at,created_at) SELECT $1,$2,id,$3,$4,$5,now(),now() FROM revenue_digital_twins WHERE organization_id=$2 AND account_id=$6`,
        [
          randomUUID(),
          input.organizationId,
          input.actorMembershipId,
          event,
          json({
            commitmentId: row.id,
            status: input.status,
            terminal: completed,
          }),
          row.account_id,
        ],
      );
      await this.audit(
        c,
        input.organizationId,
        input.actorUserId,
        event,
        "commitment",
        row.id,
        { from: row.status, to: input.status },
      );
      return updated;
    });
  }
  async createCommitment(input: {
    organizationId: string;
    sessionId: string;
    actorMembershipId: string;
    actorUserId: string;
    ownerMembershipId: string;
    description: string;
    dueAt: string | null;
    expectedOutcome: string | null;
    visibility: string;
    impact: string;
    idempotencyKey: string;
  }) {
    return this.tx(async (c) => {
      if (
        !(await this.canAccessCadence(
          c,
          input.organizationId,
          input.sessionId,
          input.actorMembershipId,
        ))
      )
        throw new CadenceConflictError(
          "Cadence is outside your authorized scope.",
        );
      const session = (
        await c.query(
          `SELECT account_id,opportunity_id FROM cadence_sessions WHERE organization_id=$1 AND id=$2 FOR SHARE`,
          [input.organizationId, input.sessionId],
        )
      ).rows[0];
      if (!session) throw new CadenceConflictError("Cadence not found.");
      const owner = (
        await c.query(
          `SELECT 1 FROM organization_memberships m WHERE m.organization_id=$1 AND m.id=$2 AND m.status='ACTIVE' AND (EXISTS(SELECT 1 FROM cadence_participants p WHERE p.organization_id=m.organization_id AND p.cadence_session_id=$3 AND p.membership_id=m.id) OR EXISTS(SELECT 1 FROM revenue_team_assignments rt WHERE rt.organization_id=m.organization_id AND rt.membership_id=m.id AND (rt.opportunity_id=$4 OR ($4::text IS NULL AND rt.account_id=$5))))`,
          [
            input.organizationId,
            input.ownerMembershipId,
            input.sessionId,
            session.opportunity_id,
            session.account_id,
          ],
        )
      ).rowCount;
      if (!owner)
        throw new CadenceConflictError(
          "Select an active participant from this revenue motion.",
        );
      const id = `commitment-${createHash("sha256")
          .update(
            `${input.organizationId}:${input.sessionId}:${input.idempotencyKey}`,
          )
          .digest("hex")
          .slice(0, 24)}`,
        inserted = (
          await c.query(
            `INSERT INTO commitments(id,organization_id,cadence_session_id,account_id,opportunity_id,owner_membership_id,description,due_at,status,expected_outcome,visibility,impact,created_at,updated_at) VALUES($1,$2,$3,$4,$5,$6,$7,$8,'OPEN',$9,$10,$11,now(),now()) ON CONFLICT(id) DO NOTHING RETURNING *`,
            [
              id,
              input.organizationId,
              input.sessionId,
              session.account_id,
              session.opportunity_id,
              input.ownerMembershipId,
              input.description,
              input.dueAt,
              input.expectedOutcome,
              input.visibility,
              input.impact,
            ],
          )
        ).rows[0];
      if (!inserted)
        return (
          await c.query(
            `SELECT * FROM commitments WHERE organization_id=$1 AND id=$2`,
            [input.organizationId, id],
          )
        ).rows[0];
      await c.query(
        `INSERT INTO revenue_digital_twin_events(id,organization_id,revenue_digital_twin_id,actor_membership_id,event_type,payload,occurred_at,created_at) SELECT $1,$2,id,$3,'COMMITMENT_CREATED',$4,now(),now() FROM revenue_digital_twins WHERE organization_id=$2 AND account_id=$5`,
        [
          randomUUID(),
          input.organizationId,
          input.actorMembershipId,
          json({ commitmentId: id, cadenceSessionId: input.sessionId }),
          session.account_id,
        ],
      );
      await this.audit(
        c,
        input.organizationId,
        input.actorUserId,
        "COMMITMENT_CREATED",
        "commitment",
        id,
        { cadenceSessionId: input.sessionId, owner: input.ownerMembershipId },
      );
      return inserted;
    });
  }
  async createCadence(input: {
    idempotencyKey: string;
    organizationId: string;
    templateCode: string;
    scope: string;
    accountId: string | null;
    opportunityId: string | null;
    participants: CadenceParticipantInput[];
    agenda: {
      type: string;
      priority: number;
      title: string;
      rationale: string;
      evidence?: unknown[];
      recommendedDiscussion?: string;
      recommendedDecision?: string;
      visibility: string;
    }[];
    actorUserId: string;
    actorMembershipId?: string;
  }) {
    return this.tx(async (c) => {
      const existing = (
        await c.query(
          `SELECT id FROM cadence_sessions WHERE organization_id=$1 AND idempotency_key=$2`,
          [input.organizationId, input.idempotencyKey],
        )
      ).rows[0];
      if (existing) return { id: existing.id, replayed: true };
      const template = (
        await c.query(
          `SELECT id FROM cadence_templates WHERE organization_id=$1 AND code=$2 AND is_active`,
          [input.organizationId, input.templateCode],
        )
      ).rows[0];
      if (!template)
        throw new CadenceConflictError("Cadence template is unavailable.");
      if (input.opportunityId) {
        const motion = (
          await c.query(
            `SELECT account_id FROM opportunities WHERE organization_id=$1 AND id=$2`,
            [input.organizationId, input.opportunityId],
          )
        ).rows[0];
        if (
          !motion ||
          (input.accountId && motion.account_id !== input.accountId)
        )
          throw new CadenceConflictError(
            "Cadence account and opportunity do not identify the same revenue motion.",
          );
      }
      for (const participant of input.participants) {
        if (!participant.externalStakeholderId) continue;
        const stakeholder = (
          await c.query(
            `SELECT account_id FROM revenue_stakeholders WHERE organization_id=$1 AND id=$2`,
            [input.organizationId, participant.externalStakeholderId],
          )
        ).rows[0];
        if (!stakeholder || stakeholder.account_id !== input.accountId)
          throw new CadenceConflictError(
            "External participant does not belong to the cadence account.",
          );
      }
      const participants = input.participants.length
          ? input.participants
          : await this.resolveParticipants(c, input),
        agenda = input.agenda.length
          ? input.agenda
          : await this.prepareAgenda(c, input),
        id = randomUUID();
      await c.query(
        `INSERT INTO cadence_sessions(id,organization_id,template_id,status,scope,account_id,opportunity_id,preparation_summary,idempotency_key,created_at,updated_at) VALUES($1,$2,$3,'PREPARED',$4,$5,$6,$7,$8,now(),now())`,
        [
          id,
          input.organizationId,
          template.id,
          input.scope,
          input.accountId,
          input.opportunityId,
          "AROS prepared this cadence from current signals, commitments, coverage, and Twin context.",
          input.idempotencyKey,
        ],
      );
      for (const p of participants)
        await c.query(
          `INSERT INTO cadence_participants(id,organization_id,cadence_session_id,membership_id,external_stakeholder_id,participation_type,participant_role,required,created_at) VALUES($1,$2,$3,$4,$5,$6,$7,$8,now())`,
          [
            randomUUID(),
            input.organizationId,
            id,
            p.membershipId ?? null,
            p.externalStakeholderId ?? null,
            p.participationType ?? null,
            p.participantRole,
            p.required,
          ],
        );
      for (const a of agenda)
        await c.query(
          `INSERT INTO cadence_agenda_items(id,organization_id,cadence_session_id,type,priority,title,rationale,evidence,recommended_discussion,recommended_decision,status,visibility,created_at,updated_at) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,'PROPOSED',$11,now(),now())`,
          [
            randomUUID(),
            input.organizationId,
            id,
            a.type,
            a.priority,
            a.title,
            a.rationale,
            json(a.evidence),
            a.recommendedDiscussion ?? null,
            a.recommendedDecision ?? null,
            a.visibility,
          ],
        );
      await this.audit(
        c,
        input.organizationId,
        input.actorUserId,
        "CADENCE_CREATED",
        "cadence",
        id,
        { templateCode: input.templateCode },
      );
      return { id, replayed: false };
    });
  }
  async approveCadenceRecommendation(input: {
    organizationId: string;
    decisionId: string;
    actorUserId: string;
    actorMembershipId: string;
  }) {
    return this.tx(async (c) => {
      const decision = (
        await c.query(
          `SELECT * FROM action_decisions WHERE organization_id=$1 AND id=$2 FOR UPDATE`,
          [input.organizationId, input.decisionId],
        )
      ).rows[0];
      if (!decision) throw new CadenceConflictError("Decision not found.");
      if (decision.status === "APPROVED")
        return {
          cadenceId: decision.metadata?.executionCadenceId ?? null,
          replayed: true,
        };
      if (decision.status !== "PENDING")
        throw new CadenceConflictError("Decision is no longer pending.");
      const effect = decision.metadata?.effect;
      if (
        effect?.type !== "CREATE_CADENCE" ||
        typeof effect.templateCode !== "string" ||
        !Array.isArray(effect.participants) ||
        !Array.isArray(effect.agenda)
      )
        throw new CadenceConflictError(
          "Decision has no supported cadence effect.",
        );
      const template = (
        await c.query(
          `SELECT id FROM cadence_templates WHERE organization_id=$1 AND code=$2 AND is_active`,
          [input.organizationId, effect.templateCode],
        )
      ).rows[0];
      if (!template)
        throw new CadenceConflictError("Cadence template is unavailable.");
      const cadenceId = randomUUID();
      await c.query(
        `INSERT INTO cadence_sessions(id,organization_id,template_id,status,scope,account_id,opportunity_id,preparation_summary,idempotency_key,created_at,updated_at) VALUES($1,$2,$3,'PREPARED',$4,$5,$6,$7,$8,now(),now())`,
        [
          cadenceId,
          input.organizationId,
          template.id,
          effect.scope ?? "INTERNAL",
          decision.account_id,
          decision.opportunity_id,
          "Approved manager intervention. AROS prepared the agenda from current evidence.",
          `decision:${decision.id}`,
        ],
      );
      for (const p of effect.participants)
        await c.query(
          `INSERT INTO cadence_participants(id,organization_id,cadence_session_id,membership_id,external_stakeholder_id,participation_type,participant_role,required,created_at) VALUES($1,$2,$3,$4,$5,$6,$7,$8,now())`,
          [
            randomUUID(),
            input.organizationId,
            cadenceId,
            p.membershipId ?? null,
            p.externalStakeholderId ?? null,
            p.participationType ?? null,
            p.participantRole,
            p.required !== false,
          ],
        );
      for (const a of effect.agenda)
        await c.query(
          `INSERT INTO cadence_agenda_items(id,organization_id,cadence_session_id,type,priority,title,rationale,evidence,recommended_discussion,recommended_decision,status,visibility,created_at,updated_at) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,'PROPOSED',$11,now(),now())`,
          [
            randomUUID(),
            input.organizationId,
            cadenceId,
            a.type,
            a.priority,
            a.title,
            a.rationale,
            json(a.evidence),
            a.recommendedDiscussion ?? null,
            a.recommendedDecision ?? null,
            a.visibility ?? "INTERNAL_ONLY",
          ],
        );
      await c.query(
        `UPDATE action_decisions SET status='APPROVED',assigned_membership_id=$3,metadata=metadata||$4::jsonb,updated_at=now() WHERE organization_id=$1 AND id=$2`,
        [
          input.organizationId,
          decision.id,
          input.actorMembershipId,
          json({ executionCadenceId: cadenceId }),
        ],
      );
      await c.query(
        `INSERT INTO revenue_digital_twin_events(id,organization_id,revenue_digital_twin_id,actor_membership_id,event_type,payload,occurred_at,created_at) SELECT $1,$2,id,$3,'CADENCE_PREPARED',$4,now(),now() FROM revenue_digital_twins WHERE organization_id=$2 AND account_id=$5`,
        [
          randomUUID(),
          input.organizationId,
          input.actorMembershipId,
          json({
            cadenceSessionId: cadenceId,
            decisionId: decision.id,
            templateCode: effect.templateCode,
          }),
          decision.account_id,
        ],
      );
      await this.audit(
        c,
        input.organizationId,
        input.actorUserId,
        "REVENUE_TEAM_RECOMMENDATION_APPROVED",
        "decision",
        decision.id,
        { cadenceId, templateCode: effect.templateCode },
      );
      return { cadenceId, replayed: false };
    });
  }
  async completeCadence(input: {
    organizationId: string;
    sessionId: string;
    expectedVersion: number;
    actorUserId: string;
    actorMembershipId: string;
    internalSummary: string;
    externalSafeSummary: string;
    decisions: {
      type: string;
      decision: string;
      rationale?: string;
      visibility: string;
    }[];
    commitments: {
      idempotencyKey: string;
      ownerMembershipId?: string;
      externalStakeholderId?: string;
      description: string;
      dueAt?: string;
      expectedOutcome?: string;
      visibility: string;
      impact: string;
    }[];
    outcomes: { type: string; description: string; visibility: string }[];
  }) {
    return this.tx(async (c) => {
      const session = (
        await c.query(
          `SELECT * FROM cadence_sessions WHERE organization_id=$1 AND id=$2 FOR UPDATE`,
          [input.organizationId, input.sessionId],
        )
      ).rows[0];
      if (!session) throw new CadenceConflictError("Cadence not found.");
      if (
        !(await this.canAccessCadence(
          c,
          input.organizationId,
          input.sessionId,
          input.actorMembershipId,
        ))
      )
        throw new CadenceConflictError(
          "Cadence is outside your authorized scope.",
        );
      if (session.status === "COMPLETED")
        return { id: session.id, replayed: true };
      if (session.version !== input.expectedVersion)
        throw new CadenceConflictError(
          "This cadence changed. Refresh and try again.",
        );
      for (const d of input.decisions)
        await c.query(
          `INSERT INTO cadence_decisions(id,organization_id,cadence_session_id,decision_type,decision,rationale,decided_by_membership_id,visibility,created_at) VALUES($1,$2,$3,$4,$5,$6,$7,$8,now())`,
          [
            randomUUID(),
            input.organizationId,
            session.id,
            d.type,
            d.decision,
            d.rationale ?? null,
            input.actorMembershipId,
            d.visibility,
          ],
        );
      for (const item of input.commitments)
        await c.query(
          `INSERT INTO commitments(id,organization_id,cadence_session_id,account_id,opportunity_id,owner_membership_id,external_stakeholder_id,description,due_at,status,expected_outcome,visibility,impact,created_at,updated_at) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,'OPEN',$10,$11,$12,now(),now()) ON CONFLICT(id) DO NOTHING`,
          [
            item.idempotencyKey,
            input.organizationId,
            session.id,
            session.account_id,
            session.opportunity_id,
            item.ownerMembershipId ?? null,
            item.externalStakeholderId ?? null,
            item.description,
            item.dueAt ?? null,
            item.expectedOutcome ?? null,
            item.visibility,
            item.impact,
          ],
        );
      for (const outcome of input.outcomes)
        await c.query(
          `INSERT INTO cadence_outcomes(id,organization_id,cadence_session_id,outcome_type,description,visibility,created_at) VALUES($1,$2,$3,$4,$5,$6,now())`,
          [
            randomUUID(),
            input.organizationId,
            session.id,
            outcome.type,
            outcome.description,
            outcome.visibility,
          ],
        );
      await c.query(
        `UPDATE cadence_sessions SET status='COMPLETED',completed_at=now(),internal_summary=$3,external_safe_summary=$4,version=version+1,updated_at=now() WHERE organization_id=$1 AND id=$2`,
        [
          input.organizationId,
          session.id,
          input.internalSummary,
          input.externalSafeSummary,
        ],
      );
      const twin = (
        await c.query(
          `SELECT id FROM revenue_digital_twins WHERE organization_id=$1 AND account_id=$2`,
          [input.organizationId, session.account_id],
        )
      ).rows[0];
      if (twin) {
        for (const [eventType, payload] of [
          [
            "DECISION_RECORDED",
            { cadenceSessionId: session.id, count: input.decisions.length },
          ],
          [
            "COMMITMENT_CREATED",
            { cadenceSessionId: session.id, count: input.commitments.length },
          ],
          [
            "CADENCE_COMPLETED",
            {
              cadenceSessionId: session.id,
              decisions: input.decisions.length,
              commitments: input.commitments.length,
              outcomes: input.outcomes.length,
            },
          ],
        ] as const)
          await c.query(
            `INSERT INTO revenue_digital_twin_events(id,organization_id,revenue_digital_twin_id,actor_membership_id,event_type,payload,occurred_at,created_at) VALUES($1,$2,$3,$4,$5,$6,now(),now())`,
            [
              randomUUID(),
              input.organizationId,
              twin.id,
              input.actorMembershipId,
              eventType,
              json(payload),
            ],
          );
      }
      if (session.opportunity_id)
        await this.maybeCreateEscalation(
          c,
          input.organizationId,
          session.opportunity_id,
          input.actorMembershipId,
        );
      if (session.opportunity_id === "opp-coinbase-renewal") {
        const template = (
          await c.query(
            `SELECT code FROM cadence_templates WHERE organization_id=$1 AND id=$2`,
            [input.organizationId, session.template_id],
          )
        ).rows[0];
        const nextState =
          template?.code === "CROSS_FUNCTIONAL_2X2"
            ? "2X2_EXECUTED"
            : template?.code === "AE_SE_SYNC" ||
                template?.code === "SECURITY_REVIEW"
              ? "MANAGER_INTERVENTION_REQUIRED"
              : null;
        if (nextState)
          await c.query(
            `INSERT INTO demo_scenario_states(id,organization_id,scenario_key,state,version,updated_at)
             VALUES($1,$2,'coinbase-strategic-renewal',$3,1,now())
             ON CONFLICT(organization_id,scenario_key) DO UPDATE SET state=excluded.state,version=demo_scenario_states.version+1,updated_at=now()`,
            [
              `demo-state-${input.organizationId}-coinbase-strategic-renewal`,
              input.organizationId,
              nextState,
            ],
          );
      }
      await this.audit(
        c,
        input.organizationId,
        input.actorUserId,
        "CADENCE_COMPLETED",
        "cadence",
        session.id,
        { commitments: input.commitments.length },
      );
      return { id: session.id, replayed: false };
    });
  }
  private async audit(
    c: PoolClient,
    organizationId: string,
    actorUserId: string,
    event: string,
    resourceType: string,
    resourceId: string,
    payload: unknown,
  ) {
    const actor = (
      await c.query(
        `SELECT u.role,u.platform_role,m.admin_role FROM users u LEFT JOIN organization_memberships m ON(m.organization_id=$1 AND m.user_id=u.id) WHERE u.id=$2`,
        [organizationId, actorUserId],
      )
    ).rows[0];
    await c.query(
      `INSERT INTO security_audit_events(id,organization_id,actor_user_id,actor_role,actor_admin_role,actor_platform_role,event,resource_type,resource_id,timestamp,payload) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,now(),$10)`,
      [
        randomUUID(),
        organizationId,
        actorUserId,
        actor?.role ?? null,
        actor?.admin_role ?? null,
        actor?.platform_role ?? null,
        event,
        resourceType,
        resourceId,
        json(payload),
      ],
    );
  }
}
export const cadenceRepository = process.env.DATABASE_URL
  ? new PostgresCadenceRepository()
  : null;
