import { query } from "./client";

export type OperatingTimelineKind =
  | "SIGNAL"
  | "INSIGHT"
  | "DECISION"
  | "ACTION"
  | "CADENCE"
  | "COMMITMENT"
  | "OUTCOME"
  | "MEMORY";
export interface OperatingTimelineEvent {
  id: string;
  kind: OperatingTimelineKind;
  occurredAt: string;
  title: string;
  summary: string;
  status?: string | null;
  ownerName?: string | null;
}

export async function getAccountOperatingTimeline(
  organizationId: string,
  accountId: string,
): Promise<OperatingTimelineEvent[]> {
  const [
    signals,
    indicators,
    decisions,
    cadences,
    commitments,
    outcomes,
    memory,
  ] = await Promise.all([
    query(
      `SELECT id,observed_at AS "occurredAt",type,source,payload FROM revenue_signals WHERE organization_id=$1 AND account_id=$2`,
      [organizationId, accountId],
    ),
    query(
      `SELECT id,observed_at AS "occurredAt",indicator_type,status,rationale,evidence FROM leading_indicators WHERE organization_id=$1 AND account_id=$2`,
      [organizationId, accountId],
    ),
    query(
      `SELECT id,updated_at AS "occurredAt",type,recommendation,status FROM action_decisions WHERE organization_id=$1 AND account_id=$2`,
      [organizationId, accountId],
    ),
    query(
      `SELECT s.id,COALESCE(s.completed_at,s.scheduled_at,s.created_at) AS "occurredAt",t.name,s.status,s.preparation_summary FROM cadence_sessions s JOIN cadence_templates t ON(t.organization_id=s.organization_id AND t.id=s.template_id) WHERE s.organization_id=$1 AND s.account_id=$2`,
      [organizationId, accountId],
    ),
    query(
      `SELECT c.id,c.updated_at AS "occurredAt",c.description,c.status,c.expected_outcome,u.display_name AS "ownerName" FROM commitments c LEFT JOIN organization_memberships m ON(m.organization_id=c.organization_id AND m.id=c.owner_membership_id) LEFT JOIN users u ON(u.id=m.user_id) WHERE c.organization_id=$1 AND c.account_id=$2`,
      [organizationId, accountId],
    ),
    query(
      `SELECT o.id,o.created_at AS "occurredAt",o.outcome_type,o.description,o.impact FROM cadence_outcomes o JOIN cadence_sessions s ON(s.organization_id=o.organization_id AND s.id=o.cadence_session_id) WHERE o.organization_id=$1 AND s.account_id=$2`,
      [organizationId, accountId],
    ),
    query(
      `SELECT e.id,e.occurred_at AS "occurredAt",e.event_type,e.payload FROM revenue_digital_twin_events e JOIN revenue_digital_twins t ON(t.organization_id=e.organization_id AND t.id=e.revenue_digital_twin_id) WHERE e.organization_id=$1 AND t.account_id=$2`,
      [organizationId, accountId],
    ),
  ]);
  return [
    ...signals.rows.map((row) => ({
      id: row.id,
      kind: "SIGNAL" as const,
      occurredAt: row.occurredAt,
      title: String(row.type).replaceAll("_", " "),
      summary: `${row.source}: ${typeof row.payload?.description === "string" ? row.payload.description : "New revenue signal detected."}`,
    })),
    ...indicators.rows.map((row) => ({
      id: row.id,
      kind: "INSIGHT" as const,
      occurredAt: row.occurredAt,
      title: `${String(row.indicator_type).replaceAll("_", " ")} · ${row.status}`,
      summary: row.rationale,
      status: row.status,
    })),
    ...decisions.rows.map((row) => ({
      id: row.id,
      kind: "DECISION" as const,
      occurredAt: row.occurredAt,
      title: String(row.type).replaceAll("_", " "),
      summary: row.recommendation,
      status: row.status,
    })),
    ...cadences.rows.map((row) => ({
      id: row.id,
      kind: "CADENCE" as const,
      occurredAt: row.occurredAt,
      title: row.name,
      summary:
        row.preparation_summary ??
        "Cadence prepared from current operating context.",
      status: row.status,
    })),
    ...commitments.rows.map((row) => ({
      id: row.id,
      kind: "COMMITMENT" as const,
      occurredAt: row.occurredAt,
      title: row.description,
      summary: row.expected_outcome ?? "Commitment created.",
      status: row.status,
      ownerName: row.ownerName,
    })),
    ...outcomes.rows.map((row) => ({
      id: row.id,
      kind: "OUTCOME" as const,
      occurredAt: row.occurredAt,
      title: String(row.outcome_type).replaceAll("_", " "),
      summary: row.description,
      status: row.impact,
    })),
    ...memory.rows.map((row) => ({
      id: row.id,
      kind: "MEMORY" as const,
      occurredAt: row.occurredAt,
      title: String(row.event_type).replaceAll("_", " "),
      summary:
        typeof row.payload?.description === "string"
          ? row.payload.description
          : "Revenue Digital Twin updated.",
    })),
  ].sort(
    (a, b) =>
      new Date(b.occurredAt).getTime() - new Date(a.occurredAt).getTime(),
  );
}

export async function getOperatingPerformance(
  organizationId: string,
  membershipIds: string[],
) {
  const [cadences, commitments, interventions] = await Promise.all([
    query(
      `SELECT count(*)::int AS total,count(*) FILTER(WHERE status='COMPLETED')::int AS completed FROM cadence_sessions WHERE organization_id=$1 AND ($2::text[] IS NULL OR EXISTS(SELECT 1 FROM cadence_participants p WHERE p.organization_id=cadence_sessions.organization_id AND p.cadence_session_id=cadence_sessions.id AND p.membership_id=ANY($2::text[])))`,
      [organizationId, membershipIds.length ? membershipIds : null],
    ),
    query(
      `SELECT count(*)::int AS total,count(*) FILTER(WHERE status='COMPLETED')::int AS completed,count(*) FILTER(WHERE status IN('OPEN','IN_PROGRESS','BLOCKED','MISSED') AND due_at<now())::int AS overdue FROM commitments WHERE organization_id=$1 AND ($2::text[] IS NULL OR owner_membership_id=ANY($2::text[]))`,
      [organizationId, membershipIds.length ? membershipIds : null],
    ),
    query(
      `SELECT count(*)::int AS total,count(*) FILTER(WHERE status IN('ACTIONED','MONITORING','RESOLVED'))::int AS progressed FROM manager_interventions WHERE organization_id=$1 AND ($2::text[] IS NULL OR manager_membership_id=ANY($2::text[]))`,
      [organizationId, membershipIds.length ? membershipIds : null],
    ),
  ]);
  return {
    cadence: cadences.rows[0],
    commitments: commitments.rows[0],
    interventions: interventions.rows[0],
  };
}

export type OperatingPerformanceMember = {
  membershipId: string;
  displayName: string;
  roleCode: string | null;
  cadence: { total: number; completed: number };
  commitments: { total: number; completed: number; overdue: number };
  interventions: { total: number; progressed: number };
};

/** Per-owner operating metrics used by the performance drill-down. */
export async function getOperatingPerformanceByMembership(
  organizationId: string,
  membershipIds: string[],
): Promise<OperatingPerformanceMember[]> {
  if (!membershipIds.length) return [];
  const { rows } = await query(
    `SELECT m.id AS membership_id,u.display_name,
      role.role_code,
      (SELECT count(*)::int FROM cadence_sessions s WHERE s.organization_id=$1 AND EXISTS(SELECT 1 FROM cadence_participants p WHERE p.organization_id=s.organization_id AND p.cadence_session_id=s.id AND p.membership_id=m.id)) AS cadence_total,
      (SELECT count(*) FILTER(WHERE s.status='COMPLETED')::int FROM cadence_sessions s WHERE s.organization_id=$1 AND EXISTS(SELECT 1 FROM cadence_participants p WHERE p.organization_id=s.organization_id AND p.cadence_session_id=s.id AND p.membership_id=m.id)) AS cadence_completed,
      (SELECT count(*)::int FROM commitments c WHERE c.organization_id=$1 AND c.owner_membership_id=m.id) AS commitment_total,
      (SELECT count(*) FILTER(WHERE c.status='COMPLETED')::int FROM commitments c WHERE c.organization_id=$1 AND c.owner_membership_id=m.id) AS commitment_completed,
      (SELECT count(*) FILTER(WHERE c.status IN('OPEN','IN_PROGRESS','BLOCKED','MISSED') AND c.due_at<now())::int FROM commitments c WHERE c.organization_id=$1 AND c.owner_membership_id=m.id) AS commitment_overdue,
      (SELECT count(*)::int FROM manager_interventions i WHERE i.organization_id=$1 AND i.seller_membership_id=m.id) AS intervention_total,
      (SELECT count(*) FILTER(WHERE i.status IN('ACTIONED','MONITORING','RESOLVED'))::int FROM manager_interventions i WHERE i.organization_id=$1 AND i.seller_membership_id=m.id) AS intervention_progressed
    FROM organization_memberships m
    JOIN users u ON u.id=m.user_id
    LEFT JOIN LATERAL(
      SELECT COALESCE(t.code,r.code) AS role_code
      FROM membership_role_assignments a
      JOIN organization_role_definitions r ON r.organization_id=a.organization_id AND r.id=a.organization_role_definition_id
      LEFT JOIN system_role_templates t ON t.id=r.system_template_id
      WHERE a.organization_id=m.organization_id AND a.membership_id=m.id AND a.is_primary AND a.effective_to IS NULL
      LIMIT 1
    ) role ON true
    WHERE m.organization_id=$1 AND m.id=ANY($2::text[]) AND m.status='ACTIVE'
    ORDER BY u.display_name`,
    [organizationId, membershipIds],
  );
  return rows.map((row) => ({
    membershipId: String(row.membership_id),
    displayName: String(row.display_name),
    roleCode: row.role_code ? String(row.role_code) : null,
    cadence: {
      total: Number(row.cadence_total ?? 0),
      completed: Number(row.cadence_completed ?? 0),
    },
    commitments: {
      total: Number(row.commitment_total ?? 0),
      completed: Number(row.commitment_completed ?? 0),
      overdue: Number(row.commitment_overdue ?? 0),
    },
    interventions: {
      total: Number(row.intervention_total ?? 0),
      progressed: Number(row.intervention_progressed ?? 0),
    },
  }));
}
