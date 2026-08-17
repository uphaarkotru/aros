import { randomUUID } from "node:crypto";
import { Pool, type PoolClient } from "pg";
import type {
  IndicatorConfidence,
  IndicatorStatus,
  IndicatorType,
} from "@/leading-indicators/domain";
import { coachingForIndicator } from "@/leading-indicators/domain";

export type LeadingIndicatorRecord = {
  id: string;
  organization_id: string;
  account_id: string | null;
  opportunity_id: string | null;
  membership_id: string | null;
  indicator_type: IndicatorType;
  status: IndicatorStatus;
  score: number | null;
  confidence: IndicatorConfidence;
  evidence: string[];
  rationale: string;
  source_key: string | null;
  observed_at: string;
  resolved_at: string | null;
  version: number;
  created_at: string;
  updated_at: string;
};

type ViewerInput = {
  organizationId: string;
  membershipId: string;
  accountId?: string;
  opportunityId?: string;
};

const scopeCte = `WITH RECURSIVE indicator_scope(membership_id) AS (
  SELECT $2::text
  UNION
  SELECT r.source_membership_id
  FROM organization_relationships r
  JOIN indicator_scope parent ON parent.membership_id=r.target_membership_id
  WHERE r.organization_id=$1 AND r.relationship_type='REPORTS_TO' AND r.effective_to IS NULL
), allowed_opportunities AS (
  SELECT DISTINCT o.id,o.account_id
  FROM opportunities o
  WHERE o.organization_id=$1 AND (
    o.owner_membership_id IN(SELECT membership_id FROM indicator_scope)
    OR EXISTS(SELECT 1 FROM revenue_team_assignments rt WHERE rt.organization_id=o.organization_id AND rt.opportunity_id=o.id AND rt.membership_id IN(SELECT membership_id FROM indicator_scope))
  )
), allowed_accounts AS (
  SELECT account_id FROM allowed_opportunities
  UNION
  SELECT DISTINCT rt.account_id FROM revenue_team_assignments rt WHERE rt.organization_id=$1 AND rt.account_id IS NOT NULL AND rt.membership_id IN(SELECT membership_id FROM indicator_scope)
)`;

export class LeadingIndicatorConflictError extends Error {
  code = "CONCURRENCY_CONFLICT" as const;
}

export class PostgresLeadingIndicatorRepository {
  private pool: Pool;
  constructor(connectionString = process.env.DATABASE_URL) {
    if (!connectionString)
      throw new Error("DATABASE_URL is required for leading indicators");
    this.pool = new Pool({
      connectionString,
      max: Number(process.env.DATABASE_POOL_MAX ?? 5),
    });
  }

  async close() {
    await this.pool.end();
  }

  async upsertIndicator(input: {
    organizationId: string;
    id?: string;
    sourceKey: string;
    accountId?: string;
    opportunityId?: string;
    membershipId?: string;
    indicatorType: IndicatorType;
    status: IndicatorStatus;
    score?: number | null;
    confidence?: IndicatorConfidence;
    evidence: string[];
    rationale: string;
    observedAt: string;
    actorUserId?: string;
    actorMembershipId?: string;
    actorRole?: string;
  }) {
    const client = await this.pool.connect();
    try {
      await client.query("BEGIN");
      await client.query(`SELECT pg_advisory_xact_lock(hashtext($1))`, [
        `${input.organizationId}:leading-indicator:${input.sourceKey}`,
      ]);
      const existing = (
        await client.query(
          `SELECT * FROM leading_indicators WHERE organization_id=$1 AND source_key=$2 FOR UPDATE`,
          [input.organizationId, input.sourceKey],
        )
      ).rows[0] as LeadingIndicatorRecord | undefined;
      const id = existing?.id ?? input.id ?? `indicator-${randomUUID()}`;
      const row = (
        await client.query(
          `INSERT INTO leading_indicators(id,organization_id,account_id,opportunity_id,membership_id,indicator_type,status,score,confidence,evidence,rationale,source_key,observed_at,resolved_at,created_at,updated_at)
           VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,now(),now())
           ON CONFLICT(organization_id,source_key) DO UPDATE SET account_id=excluded.account_id,opportunity_id=excluded.opportunity_id,membership_id=excluded.membership_id,indicator_type=excluded.indicator_type,status=excluded.status,score=excluded.score,confidence=excluded.confidence,evidence=excluded.evidence,rationale=excluded.rationale,observed_at=excluded.observed_at,resolved_at=CASE WHEN excluded.status='HEALTHY' THEN NULL WHEN leading_indicators.status='HEALTHY' THEN NULL ELSE excluded.resolved_at END,version=leading_indicators.version+1,updated_at=now()
           RETURNING *`,
          [
            id,
            input.organizationId,
            input.accountId ?? null,
            input.opportunityId ?? null,
            input.membershipId ?? null,
            input.indicatorType,
            input.status,
            input.score ?? null,
            input.confidence ?? "MEDIUM",
            JSON.stringify(input.evidence),
            input.rationale,
            input.sourceKey,
            input.observedAt,
            input.status === "HEALTHY"
              ? null
              : input.status === "CRITICAL"
                ? input.observedAt
                : null,
          ],
        )
      ).rows[0] as LeadingIndicatorRecord;
      const accountId =
        row.account_id ??
        (
          await client.query(
            `SELECT account_id FROM opportunities WHERE organization_id=$1 AND id=$2`,
            [input.organizationId, row.opportunity_id],
          )
        ).rows[0]?.account_id;
      const twin = accountId
        ? (
            await client.query(
              `SELECT id FROM revenue_digital_twins WHERE organization_id=$1 AND account_id=$2`,
              [input.organizationId, accountId],
            )
          ).rows[0]
        : null;
      if (twin) {
        const eventType =
          row.status === "HEALTHY"
            ? "LEADING_INDICATOR_RESOLVED"
            : existing
              ? "LEADING_INDICATOR_CHANGED"
              : "LEADING_INDICATOR_CREATED";
        await client.query(
          `INSERT INTO revenue_digital_twin_events(id,organization_id,revenue_digital_twin_id,actor_membership_id,event_type,payload,occurred_at) VALUES($1,$2,$3,$4,$5,$6,$7)`,
          [
            `twin-event-${randomUUID()}`,
            input.organizationId,
            twin.id,
            input.actorMembershipId ?? null,
            eventType,
            JSON.stringify({
              indicatorId: row.id,
              indicatorType: row.indicator_type,
              status: row.status,
              evidence: input.evidence,
            }),
            input.observedAt,
          ],
        );
      }
      const coachingMembershipId =
        row.membership_id ??
        (
          await client.query(
            `SELECT owner_membership_id FROM opportunities WHERE organization_id=$1 AND id=$2`,
            [input.organizationId, row.opportunity_id],
          )
        ).rows[0]?.owner_membership_id;
      if (
        coachingMembershipId &&
        ["WATCH", "AT_RISK", "CRITICAL"].includes(row.status)
      ) {
        const coaching = coachingForIndicator({
          indicatorType: row.indicator_type,
          status: row.status,
          evidence: input.evidence,
        });
        await client.query(
          `INSERT INTO coaching_insights(id,organization_id,membership_id,account_id,opportunity_id,source_indicator_id,title,insight,suggested_action,evidence) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10) ON CONFLICT(organization_id,membership_id,source_indicator_id) DO UPDATE SET title=excluded.title,insight=excluded.insight,suggested_action=excluded.suggested_action,evidence=excluded.evidence,updated_at=now()`,
          [
            `coaching-${row.id}`,
            input.organizationId,
            coachingMembershipId,
            row.account_id ?? accountId ?? null,
            row.opportunity_id,
            row.id,
            coaching.title,
            coaching.insight,
            coaching.suggestedAction,
            JSON.stringify(input.evidence),
          ],
        );
        if (input.actorUserId && input.actorMembershipId && input.actorRole)
          await this.insertAudit(client, {
            organizationId: input.organizationId,
            actorUserId: input.actorUserId,
            actorMembershipId: input.actorMembershipId,
            actorRole: input.actorRole,
            event: "COACHING_INSIGHT_CREATED",
            resourceId: `coaching-${row.id}`,
            payload: {
              indicatorId: row.id,
              membershipId: coachingMembershipId,
            },
          });
      }
      if (input.actorUserId && input.actorMembershipId && input.actorRole)
        await this.insertAudit(client, {
          organizationId: input.organizationId,
          actorUserId: input.actorUserId,
          actorMembershipId: input.actorMembershipId,
          actorRole: input.actorRole,
          event:
            row.status === "HEALTHY"
              ? "LEADING_INDICATOR_RESOLVED"
              : existing
                ? "LEADING_INDICATOR_UPDATED"
                : "LEADING_INDICATOR_CREATED",
          resourceId: row.id,
          payload: {
            indicatorType: row.indicator_type,
            status: row.status,
            evidence: input.evidence,
          },
        });
      await client.query("COMMIT");
      return row;
    } catch (error) {
      await client.query("ROLLBACK");
      throw error;
    } finally {
      client.release();
    }
  }

  async listForViewer(input: ViewerInput) {
    const { rows } = await this.pool.query(
      `${scopeCte} SELECT li.* FROM leading_indicators li WHERE li.organization_id=$1 AND (
        li.membership_id IN(SELECT membership_id FROM indicator_scope)
        OR li.opportunity_id IN(SELECT id FROM allowed_opportunities)
        OR li.account_id IN(SELECT account_id FROM allowed_accounts)
      ) AND ($3::text IS NULL OR li.account_id=$3) AND ($4::text IS NULL OR li.opportunity_id=$4) ORDER BY CASE li.status WHEN 'CRITICAL' THEN 0 WHEN 'AT_RISK' THEN 1 WHEN 'WATCH' THEN 2 WHEN 'UNKNOWN' THEN 3 ELSE 4 END,li.observed_at DESC,li.id`,
      [
        input.organizationId,
        input.membershipId,
        input.accountId ?? null,
        input.opportunityId ?? null,
      ],
    );
    return rows as LeadingIndicatorRecord[];
  }

  async listCoachingInsights(input: ViewerInput) {
    const { rows } = await this.pool.query(
      `${scopeCte} SELECT ci.*,u.display_name FROM coaching_insights ci JOIN leading_indicators source ON(source.organization_id=ci.organization_id AND source.id=ci.source_indicator_id) JOIN users u ON u.id=(SELECT user_id FROM organization_memberships WHERE organization_id=ci.organization_id AND id=ci.membership_id) WHERE ci.organization_id=$1 AND source.status IN('WATCH','AT_RISK','CRITICAL') AND (ci.membership_id IN(SELECT membership_id FROM indicator_scope) OR ci.opportunity_id IN(SELECT id FROM allowed_opportunities) OR ci.account_id IN(SELECT account_id FROM allowed_accounts)) AND ($3::text IS NULL OR ci.account_id=$3) AND ($4::text IS NULL OR ci.opportunity_id=$4) ORDER BY ci.updated_at DESC`,
      [
        input.organizationId,
        input.membershipId,
        input.accountId ?? null,
        input.opportunityId ?? null,
      ],
    );
    return rows;
  }

  async getIndicatorTimeline(input: ViewerInput) {
    const indicators = await this.listForViewer(input);
    if (!indicators.length) return [];
    const { rows } = await this.pool.query(
      `SELECT event_type,payload,occurred_at FROM revenue_digital_twin_events WHERE organization_id=$1 AND payload->>'indicatorId'=ANY($2::text[]) ORDER BY occurred_at DESC`,
      [input.organizationId, indicators.map((item) => item.id)],
    );
    return rows;
  }

  async seedCoachingInsight(input: {
    organizationId: string;
    id: string;
    membershipId: string;
    accountId?: string;
    opportunityId?: string;
    indicatorId: string;
    title: string;
    insight: string;
    suggestedAction: string;
    evidence: string[];
  }) {
    await this.pool.query(
      `INSERT INTO coaching_insights(id,organization_id,membership_id,account_id,opportunity_id,source_indicator_id,title,insight,suggested_action,evidence) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10) ON CONFLICT(organization_id,id) DO UPDATE SET title=excluded.title,insight=excluded.insight,suggested_action=excluded.suggested_action,evidence=excluded.evidence,updated_at=now()`,
      [
        input.id,
        input.organizationId,
        input.membershipId,
        input.accountId ?? null,
        input.opportunityId ?? null,
        input.indicatorId,
        input.title,
        input.insight,
        input.suggestedAction,
        JSON.stringify(input.evidence),
      ],
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
      `INSERT INTO security_audit_events(id,organization_id,actor_user_id,actor_membership_id,actor_role,actor_admin_role,event,resource_type,resource_id,timestamp,payload) VALUES($1,$2,$3,$4,$5,$6,$7,'leading_indicator',$8,now(),$9)`,
      [
        randomUUID(),
        input.organizationId,
        input.actorUserId,
        input.actorMembershipId,
        input.actorRole,
        adminRole ?? "MEMBER",
        input.event,
        input.resourceId,
        JSON.stringify(input.payload),
      ],
    );
  }
}

export const leadingIndicatorRepository = process.env.DATABASE_URL
  ? new PostgresLeadingIndicatorRepository()
  : null;
