import { randomUUID } from "node:crypto";
import { Pool, type PoolClient } from "pg";
import {
  assessForecast,
  rollUpForecast,
  type ForecastCategory,
} from "@/forecast/domain";

export class LeadershipConflictError extends Error {}

const scopeCte = `WITH RECURSIVE leadership_scope(membership_id) AS (
  SELECT $2::text
  UNION
  SELECT r.source_membership_id
  FROM organization_relationships r
  JOIN leadership_scope parent ON parent.membership_id=r.target_membership_id
  WHERE r.organization_id=$1 AND r.relationship_type='REPORTS_TO' AND r.effective_to IS NULL
), scoped_opportunities AS (
  SELECT DISTINCT o.id
  FROM opportunities o
  WHERE o.organization_id=$1 AND (
    o.owner_membership_id IN(SELECT membership_id FROM leadership_scope)
    OR EXISTS(SELECT 1 FROM revenue_team_assignments rt WHERE rt.organization_id=o.organization_id AND rt.opportunity_id=o.id AND rt.membership_id IN(SELECT membership_id FROM leadership_scope))
  )
)`;

export class PostgresLeadershipRepository {
  private pool: Pool;
  constructor(connectionString = process.env.DATABASE_URL) {
    if (!connectionString)
      throw new Error("DATABASE_URL is required for leadership persistence");
    this.pool = new Pool({
      connectionString,
      max: Number(process.env.DATABASE_POOL_MAX ?? 10),
    });
  }
  close() {
    return this.pool.end();
  }

  async assessAndPersist(input: {
    organizationId: string;
    opportunityId: string;
    actorUserId?: string;
    actorMembershipId?: string;
    actorRole?: string;
  }) {
    const client = await this.pool.connect();
    try {
      await client.query("BEGIN");
      await client.query(`SELECT pg_advisory_xact_lock(hashtext($1))`, [
        `${input.organizationId}:forecast:${input.opportunityId}`,
      ]);
      const opportunity = (
        await client.query(
          `SELECT o.*,a.name account_name,t.id twin_id,t.state FROM opportunities o JOIN accounts a ON(a.organization_id=o.organization_id AND a.id=o.account_id) LEFT JOIN revenue_digital_twins t ON(t.organization_id=o.organization_id AND t.account_id=o.account_id) WHERE o.organization_id=$1 AND o.id=$2 FOR UPDATE OF o`,
          [input.organizationId, input.opportunityId],
        )
      ).rows[0];
      if (!opportunity) throw new Error("Opportunity not found");
      const commitments = await client.query(
          `SELECT status,due_at FROM commitments WHERE organization_id=$1 AND opportunity_id=$2`,
          [input.organizationId, input.opportunityId],
        ),
        blockers = await client.query(
          `SELECT type,severity,first_observed_at,status FROM cadence_blockers WHERE organization_id=$1 AND opportunity_id=$2 AND status<>'RESOLVED'`,
          [input.organizationId, input.opportunityId],
        ),
        signals = await client.query(
          `SELECT type,severity,payload,observed_at FROM revenue_signals WHERE organization_id=$1 AND opportunity_id=$2 ORDER BY observed_at DESC`,
          [input.organizationId, input.opportunityId],
        ),
        cadences = await client.query(
          `SELECT t.code,s.status,s.completed_at FROM cadence_sessions s JOIN cadence_templates t ON(t.organization_id=s.organization_id AND t.id=s.template_id) WHERE s.organization_id=$1 AND s.opportunity_id=$2`,
          [input.organizationId, input.opportunityId],
        ),
        interventions = await client.query(
          `SELECT status FROM manager_interventions WHERE organization_id=$1 AND opportunity_id=$2 AND status NOT IN('RESOLVED','DISMISSED')`,
          [input.organizationId, input.opportunityId],
        ),
        coverage = await client.query(
          `SELECT DISTINCT participation_type FROM revenue_team_assignments WHERE organization_id=$1 AND opportunity_id=$2`,
          [input.organizationId, input.opportunityId],
        );
      const previous = (
          await client.query(
            `SELECT * FROM forecast_assessments WHERE organization_id=$1 AND opportunity_id=$2 ORDER BY created_at DESC,id DESC LIMIT 1`,
            [input.organizationId, input.opportunityId],
          )
        ).rows[0],
        twin = (opportunity.state ?? {}) as Record<string, unknown>,
        meddpicc = (twin.meddpicc ?? {}) as Record<string, unknown>,
        renewal = (twin.renewalProfile ?? {}) as Record<string, unknown>,
        productUsage = Array.isArray(twin.productUsage)
          ? (twin.productUsage as Array<Record<string, unknown>>)
          : [],
        stakeholderSignals = signals.rows.filter((row) =>
          /EXECUTIVE|STAKEHOLDER|ENGAGEMENT/i.test(row.type),
        ),
        openBlockers = blockers.rows,
        blockerDays = openBlockers.length
          ? Math.max(
              ...openBlockers.map((row) =>
                Math.max(
                  0,
                  Math.floor(
                    (Date.now() - new Date(row.first_observed_at).getTime()) /
                      86_400_000,
                  ),
                ),
              ),
            )
          : 0,
        missedCommitments = commitments.rows.filter(
          (row) =>
            row.status === "MISSED" ||
            (["OPEN", "IN_PROGRESS", "BLOCKED"].includes(row.status) &&
              row.due_at &&
              new Date(row.due_at) < new Date()),
        ).length,
        completedCommitments = commitments.rows.filter(
          (row) => row.status === "COMPLETED",
        ).length,
        covered = new Set(coverage.rows.map((row) => row.participation_type)),
        requiredCoverage = [
          "PRIMARY_SELLER",
          "SALES_ENGINEERING",
          "TECHNICAL_EXECUTIVE",
          "CUSTOMER_SUCCESS",
          "VALUE_ENGINEERING",
        ],
        missing: string[] = [];
      if (!meddpicc.completenessScore) missing.push("methodology completeness");
      if (!opportunity.close_date) missing.push("customer decision date");
      if (!stakeholderSignals.length)
        missing.push("recent executive engagement");
      const daysToClose = opportunity.close_date
          ? Math.ceil(
              (new Date(opportunity.close_date).getTime() - Date.now()) /
                86_400_000,
            )
          : null,
        result = assessForecast({
          sellerCategory: opportunity.seller_forecast_category,
          managerCategory: opportunity.manager_forecast_category,
          strongUsage: productUsage.some(
            (usage) =>
              Number(usage.adoptionRate ?? 0) >= 0.75 ||
              usage.usageTrend === "improving",
          ),
          customerIntentPositive:
            Number(renewal.renewalLikelihood ?? 0) >= 0.65,
          economicBuyerEngaged: JSON.stringify(twin)
            .toLowerCase()
            .includes("economic-buyer"),
          commercialProgress: signals.rows.some((row) =>
            /COMMERCIAL|PROCUREMENT_PROGRESS/i.test(row.type),
          ),
          methodologyCompleteness:
            typeof meddpicc.completenessScore === "number"
              ? meddpicc.completenessScore
              : null,
          securityOrProcurementBlocker: openBlockers.some((row) =>
            /SECURITY|PROCUREMENT|COMMERCIAL/i.test(row.type),
          ),
          blockerDays,
          missedCommitments,
          completedCommitments,
          executiveEngagementDeclining: stakeholderSignals.some((row) =>
            /DECLIN|DETERIOR|RISK/i.test(
              `${row.type} ${JSON.stringify(row.payload)}`,
            ),
          ),
          coverageGapCount: requiredCoverage.filter(
            (type) => !covered.has(type),
          ).length,
          activeManagerInterventions: interventions.rowCount ?? 0,
          crossFunctionalReviewCompleted: cadences.rows.some(
            (row) =>
              ["CROSS_FUNCTIONAL_2X2", "STRATEGIC_DEAL_REVIEW"].includes(
                row.code,
              ) && row.status === "COMPLETED",
          ),
          riskImproved: false,
          daysToClose,
          missingEvidence: missing,
          previousProbability: previous?.probability ?? null,
        }),
        evidenceSnapshot = {
          opportunity: {
            stage: opportunity.stage,
            amount: Number(opportunity.amount ?? 0),
            closeDate: opportunity.close_date,
          },
          commitmentCount: commitments.rowCount,
          blockerCount: blockers.rowCount,
          signalIds: signals.rows.map((row) => row.type),
          cadenceTypes: cadences.rows.map((row) => row.code),
          coverage: [...covered],
        },
        id = `forecast-${randomUUID()}`;
      await client.query(
        `INSERT INTO forecast_assessments(id,organization_id,opportunity_id,seller_category,manager_category,aros_category,probability,confidence,risk_score,upside_score,rationale,positive_evidence,negative_evidence,missing_evidence,change_drivers,evidence_snapshot,discrepancy_types,previous_assessment_id,created_at,updated_at) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,now(),now())`,
        [
          id,
          input.organizationId,
          input.opportunityId,
          opportunity.seller_forecast_category,
          opportunity.manager_forecast_category,
          result.arosCategory,
          result.probability,
          result.confidence,
          result.riskScore,
          result.upsideScore,
          result.rationale,
          JSON.stringify(result.positiveEvidence),
          JSON.stringify(result.negativeEvidence),
          JSON.stringify(result.missingEvidence),
          JSON.stringify(result.changeDrivers),
          JSON.stringify(evidenceSnapshot),
          JSON.stringify(result.discrepancyTypes),
          previous?.id ?? null,
        ],
      );
      if (opportunity.twin_id)
        await client.query(
          `INSERT INTO revenue_digital_twin_events(id,organization_id,revenue_digital_twin_id,actor_membership_id,event_type,payload,occurred_at) VALUES($1,$2,$3,$4,$5,$6,now())`,
          [
            `twin-event-${id}`,
            input.organizationId,
            opportunity.twin_id,
            input.actorMembershipId ?? null,
            previous
              ? "FORECAST_ASSESSMENT_CHANGED"
              : "FORECAST_ASSESSMENT_CREATED",
            JSON.stringify({
              assessmentId: id,
              probability: result.probability,
              previousProbability: previous?.probability ?? null,
              discrepancyTypes: result.discrepancyTypes,
            }),
          ],
        );
      if (input.actorUserId && input.actorMembershipId && input.actorRole)
        await this.insertAudit(client, {
          organizationId: input.organizationId,
          actorUserId: input.actorUserId,
          actorMembershipId: input.actorMembershipId,
          actorRole: input.actorRole,
          event: previous
            ? "FORECAST_ASSESSMENT_CHANGED"
            : "FORECAST_ASSESSMENT_CREATED",
          resourceType: "forecast_assessment",
          resourceId: id,
          payload: {
            opportunityId: input.opportunityId,
            probability: result.probability,
            previousProbability: previous?.probability ?? null,
            discrepancyTypes: result.discrepancyTypes,
          },
        });
      await client.query("COMMIT");
      return { id, ...result, evidenceSnapshot };
    } catch (error) {
      await client.query("ROLLBACK");
      throw error;
    } finally {
      client.release();
    }
  }

  async getLeadershipBrief(
    organizationId: string,
    leaderMembershipId: string,
    level: "VP" | "CRO",
  ) {
    const assessments = (
        await this.pool.query(
          `${scopeCte}, latest AS (SELECT DISTINCT ON(f.opportunity_id) f.* FROM forecast_assessments f WHERE f.organization_id=$1 AND f.opportunity_id IN(SELECT id FROM scoped_opportunities) ORDER BY f.opportunity_id,f.created_at DESC,f.id DESC) SELECT f.*,o.name opportunity_name,o.amount::float8 amount,o.stage,o.close_date,o.account_id,a.name account_name,prev.probability previous_probability FROM latest f JOIN opportunities o ON(o.organization_id=f.organization_id AND o.id=f.opportunity_id) JOIN accounts a ON(a.organization_id=o.organization_id AND a.id=o.account_id) LEFT JOIN forecast_assessments prev ON(prev.organization_id=f.organization_id AND prev.id=f.previous_assessment_id) ORDER BY f.risk_score DESC,o.amount DESC`,
          [organizationId, leaderMembershipId],
        )
      ).rows,
      interventions = (
        await this.pool.query(
          `${scopeCte} SELECT li.*,o.name opportunity_name,o.amount::float8 amount,a.name account_name FROM leadership_interventions li JOIN opportunities o ON(o.organization_id=li.organization_id AND o.id=li.opportunity_id) JOIN accounts a ON(a.organization_id=o.organization_id AND a.id=o.account_id) WHERE li.organization_id=$1 AND li.opportunity_id IN(SELECT id FROM scoped_opportunities) AND li.level=$3 AND li.status NOT IN('RESOLVED','DISMISSED') ORDER BY li.priority_score DESC`,
          [organizationId, leaderMembershipId, level],
        )
      ).rows,
      patterns = (
        await this.pool.query(
          `${scopeCte}, pattern_motions AS (SELECT b.type,b.opportunity_id,o.amount,min(b.first_observed_at) first_observed_at FROM cadence_blockers b JOIN opportunities o ON(o.organization_id=b.organization_id AND o.id=b.opportunity_id) WHERE b.organization_id=$1 AND b.opportunity_id IN(SELECT id FROM scoped_opportunities) AND b.status<>'RESOLVED' GROUP BY b.type,b.opportunity_id,o.amount) SELECT type,count(*)::int opportunity_count,COALESCE(sum(amount),0)::float8 affected_revenue,min(first_observed_at) first_observed_at FROM pattern_motions GROUP BY type ORDER BY affected_revenue DESC`,
          [organizationId, leaderMembershipId],
        )
      ).rows,
      operating = (
        await this.pool.query(
          `${scopeCte} SELECT
          (SELECT count(*)::int FROM commitments c WHERE c.organization_id=$1 AND c.opportunity_id IN(SELECT id FROM scoped_opportunities) AND c.status IN('OPEN','IN_PROGRESS','BLOCKED','MISSED') AND c.due_at<now()) overdue_commitments,
          (SELECT count(*)::int FROM cadence_blockers b WHERE b.organization_id=$1 AND b.opportunity_id IN(SELECT id FROM scoped_opportunities) AND b.status<>'RESOLVED') unresolved_blockers,
          (SELECT count(*)::int FROM manager_interventions mi WHERE mi.organization_id=$1 AND mi.opportunity_id IN(SELECT id FROM scoped_opportunities) AND mi.status NOT IN('RESOLVED','DISMISSED')) active_manager_interventions,
          (SELECT count(*)::int FROM escalations e WHERE e.organization_id=$1 AND e.opportunity_id IN(SELECT id FROM scoped_opportunities) AND e.to_level=$3 AND e.status IN('ELIGIBLE','PENDING','ACKNOWLEDGED')) escalation_backlog,
          (SELECT count(*)::int FROM cadence_sessions cs WHERE cs.organization_id=$1 AND cs.opportunity_id IN(SELECT id FROM scoped_opportunities) AND cs.status='COMPLETED' AND cs.completed_at>now()-interval '30 days') completed_cadences`,
          [organizationId, leaderMembershipId, level],
        )
      ).rows[0],
      managerHealth = (
        await this.pool.query(
          `${scopeCte} SELECT m.id membership_id,u.display_name,count(DISTINCT mi.id)::int interventions,count(DISTINCT mi.id) FILTER(WHERE mi.status IN('RESOLVED','MONITORING'))::int progressed,count(DISTINCT c.id) FILTER(WHERE c.status IN('OPEN','IN_PROGRESS','BLOCKED','MISSED') AND c.due_at<now())::int overdue_commitments FROM organization_memberships m JOIN users u ON u.id=m.user_id JOIN organization_relationships reports ON(reports.organization_id=m.organization_id AND reports.target_membership_id=m.id AND reports.relationship_type='REPORTS_TO' AND reports.effective_to IS NULL) LEFT JOIN manager_interventions mi ON(mi.organization_id=m.organization_id AND mi.manager_membership_id=m.id) LEFT JOIN commitments c ON(c.organization_id=m.organization_id AND c.owner_membership_id=reports.source_membership_id) WHERE m.organization_id=$1 AND m.id IN(SELECT membership_id FROM leadership_scope) GROUP BY m.id,u.display_name ORDER BY overdue_commitments DESC,interventions DESC`,
          [organizationId, leaderMembershipId],
        )
      ).rows;
    const rollup = rollUpForecast(
      assessments.map((item) => ({
        opportunityId: item.opportunity_id,
        amount: Number(item.amount ?? 0),
        sellerCategory: item.seller_category,
        managerCategory: item.manager_category,
        probability: item.probability,
        arosCategory: item.aros_category,
      })),
    );
    return {
      level,
      assessments,
      interventions,
      patterns,
      operating,
      managerHealth,
      rollup,
    };
  }

  async getIntervention(
    organizationId: string,
    interventionId: string,
    leaderMembershipId: string,
  ) {
    const row = (
      await this.pool.query(
        `${scopeCte} SELECT li.*,f.seller_category,f.manager_category,f.aros_category,f.probability,f.confidence,f.rationale forecast_rationale,f.positive_evidence,f.negative_evidence,f.missing_evidence,f.change_drivers,f.discrepancy_types,o.name opportunity_name,o.amount::float8 amount,o.stage,o.close_date,o.account_id,a.name account_name FROM leadership_interventions li JOIN forecast_assessments f ON(f.organization_id=li.organization_id AND f.id=li.assessment_id) JOIN opportunities o ON(o.organization_id=li.organization_id AND o.id=li.opportunity_id) JOIN accounts a ON(a.organization_id=o.organization_id AND a.id=o.account_id) WHERE li.organization_id=$1 AND li.id=$3 AND li.opportunity_id IN(SELECT id FROM scoped_opportunities)`,
        [organizationId, leaderMembershipId, interventionId],
      )
    ).rows[0];
    if (!row) return null;
    const [cadences, commitments, blockers, escalations, team] =
      await Promise.all([
        this.pool.query(
          `SELECT cs.id,t.name,cs.status,cs.completed_at,cs.preparation_summary FROM cadence_sessions cs JOIN cadence_templates t ON(t.organization_id=cs.organization_id AND t.id=cs.template_id) WHERE cs.organization_id=$1 AND cs.opportunity_id=$2 ORDER BY cs.created_at DESC`,
          [organizationId, row.opportunity_id],
        ),
        this.pool.query(
          `SELECT c.*,u.display_name owner_name FROM commitments c LEFT JOIN organization_memberships m ON(m.organization_id=c.organization_id AND m.id=c.owner_membership_id) LEFT JOIN users u ON u.id=m.user_id WHERE c.organization_id=$1 AND c.opportunity_id=$2 ORDER BY c.due_at`,
          [organizationId, row.opportunity_id],
        ),
        this.pool.query(
          `SELECT * FROM cadence_blockers WHERE organization_id=$1 AND opportunity_id=$2 ORDER BY first_observed_at`,
          [organizationId, row.opportunity_id],
        ),
        this.pool.query(
          `SELECT * FROM escalations WHERE organization_id=$1 AND opportunity_id=$2 ORDER BY created_at`,
          [organizationId, row.opportunity_id],
        ),
        this.pool.query(
          `SELECT u.display_name,rt.participation_type FROM revenue_team_assignments rt JOIN organization_memberships m ON(m.organization_id=rt.organization_id AND m.id=rt.membership_id) JOIN users u ON u.id=m.user_id WHERE rt.organization_id=$1 AND rt.opportunity_id=$2 ORDER BY rt.participation_type,u.display_name`,
          [organizationId, row.opportunity_id],
        ),
      ]);
    return {
      intervention: row,
      cadences: cadences.rows,
      commitments: commitments.rows,
      blockers: blockers.rows,
      escalations: escalations.rows,
      team: team.rows,
    };
  }

  async approveIntervention(input: {
    organizationId: string;
    interventionId: string;
    expectedLevel: "VP" | "CRO";
    actorUserId: string;
    actorMembershipId: string;
    actorRole: string;
  }) {
    const client = await this.pool.connect();
    try {
      await client.query("BEGIN");
      const row = (
        await client.query(
          `SELECT li.*,o.account_id,t.id twin_id FROM leadership_interventions li JOIN opportunities o ON(o.organization_id=li.organization_id AND o.id=li.opportunity_id) JOIN revenue_digital_twins t ON(t.organization_id=o.organization_id AND t.account_id=o.account_id) WHERE li.organization_id=$1 AND li.id=$2 FOR UPDATE OF li`,
          [input.organizationId, input.interventionId],
        )
      ).rows[0];
      if (!row || row.level !== input.expectedLevel)
        throw new Error("Leadership intervention not found");
      if (
        ["APPROVED", "ACTIONED", "MONITORING", "RESOLVED"].includes(row.status)
      ) {
        await client.query("COMMIT");
        return { replayed: true, intervention: row };
      }
      if (!["ELIGIBLE", "PENDING"].includes(row.status))
        throw new LeadershipConflictError(
          "Intervention is no longer actionable",
        );
      const updated = (
        await client.query(
          `UPDATE leadership_interventions SET status='APPROVED',approved_by_membership_id=$3,approved_at=now(),version=version+1,updated_at=now() WHERE organization_id=$1 AND id=$2 RETURNING *`,
          [input.organizationId, input.interventionId, input.actorMembershipId],
        )
      ).rows[0];
      await client.query(
        `UPDATE action_decisions SET status='APPROVED',updated_at=now() WHERE organization_id=$1 AND metadata->>'leadershipInterventionId'=$2`,
        [input.organizationId, input.interventionId],
      );
      await client.query(
        `UPDATE escalations SET status='ACKNOWLEDGED',acknowledged_at=now() WHERE organization_id=$1 AND id=$2 AND status IN('ELIGIBLE','PENDING')`,
        [input.organizationId, row.escalation_id],
      );
      await client.query(
        `INSERT INTO revenue_digital_twin_events(id,organization_id,revenue_digital_twin_id,actor_membership_id,event_type,payload,occurred_at) VALUES($1,$2,$3,$4,'LEADERSHIP_INTERVENTION_APPROVED',$5,now()) ON CONFLICT(id) DO NOTHING`,
        [
          `twin-event-leadership-approved-${input.interventionId}`,
          input.organizationId,
          row.twin_id,
          input.actorMembershipId,
          JSON.stringify({
            interventionId: input.interventionId,
            level: input.expectedLevel,
            recommendedAction: row.recommended_action,
          }),
        ],
      );
      await this.insertAudit(client, {
        ...input,
        event: "LEADERSHIP_INTERVENTION_APPROVED",
        resourceType: "leadership_intervention",
        resourceId: input.interventionId,
        payload: {
          level: input.expectedLevel,
          opportunityId: row.opportunity_id,
        },
      });
      await client.query("COMMIT");
      return { replayed: false, intervention: updated };
    } catch (error) {
      await client.query("ROLLBACK");
      throw error;
    } finally {
      client.release();
    }
  }

  async reviewForecast(input: {
    organizationId: string;
    assessmentId: string;
    leaderMembershipId: string;
    actorUserId: string;
    actorMembershipId: string;
    actorRole: string;
    action:
      | "ACCEPT_AROS"
      | "REQUEST_MANAGER_REVIEW"
      | "KEEP_CURRENT"
      | "CHANGE_MANAGER_FORECAST"
      | "ESCALATE";
    managerCategory?: ForecastCategory;
    rationale?: string;
    idempotencyKey: string;
  }) {
    const client = await this.pool.connect();
    try {
      await client.query("BEGIN");
      await client.query(`SELECT pg_advisory_xact_lock(hashtext($1))`, [
        `${input.organizationId}:forecast-review:${input.idempotencyKey}`,
      ]);
      const replay = (
        await client.query(
          `SELECT * FROM leadership_reviews WHERE organization_id=$1 AND idempotency_key=$2`,
          [input.organizationId, input.idempotencyKey],
        )
      ).rows[0];
      if (replay) {
        await client.query("COMMIT");
        return { replayed: true, review: replay };
      }
      const assessment = (
        await client.query(
          `${scopeCte} SELECT f.*,o.account_id,t.id twin_id FROM forecast_assessments f JOIN opportunities o ON(o.organization_id=f.organization_id AND o.id=f.opportunity_id) JOIN revenue_digital_twins t ON(t.organization_id=o.organization_id AND t.account_id=o.account_id) WHERE f.organization_id=$1 AND f.id=$3 AND f.opportunity_id IN(SELECT id FROM scoped_opportunities) FOR UPDATE OF f`,
          [input.organizationId, input.leaderMembershipId, input.assessmentId],
        )
      ).rows[0];
      if (!assessment) throw new Error("Forecast assessment not found");
      if (input.action === "CHANGE_MANAGER_FORECAST" && !input.managerCategory)
        throw new Error("Manager forecast category is required");
      if (input.action === "CHANGE_MANAGER_FORECAST")
        await client.query(
          `UPDATE opportunities SET manager_forecast_category=$3,forecast_updated_at=now(),updated_at=now() WHERE organization_id=$1 AND id=$2`,
          [
            input.organizationId,
            assessment.opportunity_id,
            input.managerCategory,
          ],
        );
      const id = `leadership-review-${randomUUID()}`,
        review = (
          await client.query(
            `INSERT INTO leadership_reviews(id,organization_id,assessment_id,opportunity_id,reviewer_membership_id,review_type,action,prior_seller_category,prior_manager_category,resulting_manager_category,rationale,idempotency_key,created_at) VALUES($1,$2,$3,$4,$5,'FORECAST_REVIEW',$6,$7,$8,$9,$10,$11,now()) RETURNING *`,
            [
              id,
              input.organizationId,
              input.assessmentId,
              assessment.opportunity_id,
              input.actorMembershipId,
              input.action,
              assessment.seller_category,
              assessment.manager_category,
              input.managerCategory ?? assessment.manager_category,
              input.rationale ?? null,
              input.idempotencyKey,
            ],
          )
        ).rows[0];
      await client.query(
        `INSERT INTO revenue_digital_twin_events(id,organization_id,revenue_digital_twin_id,actor_membership_id,event_type,payload,occurred_at) VALUES($1,$2,$3,$4,'FORECAST_REVIEWED',$5,now())`,
        [
          `twin-event-${id}`,
          input.organizationId,
          assessment.twin_id,
          input.actorMembershipId,
          JSON.stringify({
            assessmentId: input.assessmentId,
            action: input.action,
          }),
        ],
      );
      await this.insertAudit(client, {
        ...input,
        event: "FORECAST_REVIEWED",
        resourceType: "forecast_assessment",
        resourceId: input.assessmentId,
        payload: {
          action: input.action,
          managerCategory: input.managerCategory,
        },
      });
      await client.query("COMMIT");
      return { replayed: false, review };
    } catch (error) {
      await client.query("ROLLBACK");
      throw error;
    } finally {
      client.release();
    }
  }

  async canAccessAssessment(
    organizationId: string,
    assessmentId: string,
    leaderMembershipId: string,
  ) {
    return Boolean(
      (
        await this.pool.query(
          `${scopeCte} SELECT 1 FROM forecast_assessments f WHERE f.organization_id=$1 AND f.id=$3 AND f.opportunity_id IN(SELECT id FROM scoped_opportunities)`,
          [organizationId, leaderMembershipId, assessmentId],
        )
      ).rowCount,
    );
  }

  private async insertAudit(
    client: PoolClient,
    input: {
      organizationId: string;
      actorUserId: string;
      actorMembershipId: string;
      actorRole: string;
      event: string;
      resourceType: string;
      resourceId: string;
      payload: unknown;
    },
  ) {
    const adminRole = (
      await client.query(
        `SELECT admin_role FROM organization_memberships WHERE organization_id=$1 AND id=$2`,
        [input.organizationId, input.actorMembershipId],
      )
    ).rows[0]?.admin_role;
    await client.query(
      `INSERT INTO security_audit_events(id,organization_id,actor_user_id,actor_membership_id,actor_role,actor_admin_role,event,resource_type,resource_id,timestamp,payload) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,now(),$10)`,
      [
        randomUUID(),
        input.organizationId,
        input.actorUserId,
        input.actorMembershipId,
        input.actorRole,
        adminRole ?? "MEMBER",
        input.event,
        input.resourceType,
        input.resourceId,
        JSON.stringify(input.payload),
      ],
    );
  }
}

export const leadershipRepository = process.env.DATABASE_URL
  ? new PostgresLeadershipRepository()
  : null;
