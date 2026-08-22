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

export type TeamSellingSignalKey =
  | "SE"
  | "PARTNER"
  | "SDR"
  | "TWO_BY_TWO"
  | "FCTO"
  | "VALUE_ENGINEERING"
  | "CUSTOMER_SIGNAL";

export type TeamSellingSignal = {
  key: TeamSellingSignalKey;
  label: string;
  score: number;
  detail: string;
  coachingSuggestion: string;
};

export type TeamSellingScore = {
  score: number;
  status: "HEALTHY" | "WATCH" | "AT_RISK" | "CRITICAL";
  signals: TeamSellingSignal[];
  coachingSuggestions: string[];
};

export function averageTeamSellingScores(
  scores: TeamSellingScore[],
): TeamSellingScore | null {
  if (!scores.length) return null;
  const signals = scores[0].signals.map((signal, index) => {
    const score = Math.round(
      scores.reduce(
        (total, item) => total + (item.signals[index]?.score ?? 0),
        0,
      ) / scores.length,
    );
    return {
      ...signal,
      score,
      detail: `Average across ${scores.length} AE${scores.length === 1 ? "" : "s"}.`,
    };
  });
  const score = Math.round(
    scores.reduce((total, item) => total + item.score, 0) / scores.length,
  );
  return {
    score,
    status: teamSellingStatus(score),
    signals,
    coachingSuggestions: [
      ...new Set(scores.flatMap((item) => item.coachingSuggestions)),
    ].slice(0, 3),
  };
}

type TeamSellingSession = {
  membershipId: string;
  templateCode: string;
  scope: string;
  occurredAt: string;
  status: string;
  participantRoles: string[];
  hasSignal: boolean;
};

const teamSellingDefinitions: Array<{
  key: TeamSellingSignalKey;
  label: string;
  suggestion: string;
  matches: (session: TeamSellingSession) => boolean;
}> = [
  {
    key: "SE",
    label: "SE cadence",
    suggestion:
      "Schedule a recurring AE–SE sync before the next technical or security signal.",
    matches: (session) =>
      session.templateCode === "AE_SE_SYNC" ||
      session.participantRoles.some((role) =>
        ["SALES_ENGINEER", "SALES_ENGINEER_MANAGER"].includes(role),
      ),
  },
  {
    key: "PARTNER",
    label: "Partner Sales cadence",
    suggestion:
      "Bring Partner Sales into the next account plan and customer milestone.",
    matches: (session) =>
      session.templateCode === "AE_PARTNER_SYNC" ||
      session.participantRoles.includes("PARTNER_SALES"),
  },
  {
    key: "SDR",
    label: "SDR cadence",
    suggestion:
      "Set a weekly AE–SDR account-mapping checkpoint for stakeholder coverage.",
    matches: (session) =>
      session.templateCode === "AE_SDR_SYNC" ||
      session.participantRoles.includes("SDR"),
  },
  {
    key: "TWO_BY_TWO",
    label: "2x2 meeting",
    suggestion:
      "Prepare the next 2x2 with named customer outcomes and internal owners.",
    matches: (session) => session.templateCode === "CROSS_FUNCTIONAL_2X2",
  },
  {
    key: "FCTO",
    label: "FCTO involvement",
    suggestion:
      "Invite the Field CTO when executive, architecture, or strategic value needs validation.",
    matches: (session) => session.participantRoles.includes("FIELD_CTO"),
  },
  {
    key: "VALUE_ENGINEERING",
    label: "Value Engineering",
    suggestion:
      "Pull Value Engineering into the next quantified business-value or ROI milestone.",
    matches: (session) =>
      session.participantRoles.includes("VALUE_ENGINEERING"),
  },
  {
    key: "CUSTOMER_SIGNAL",
    label: "Customer signal coverage",
    suggestion:
      "Attach the right internal stakeholder to the next customer meeting tied to the active signal.",
    matches: (session) =>
      session.scope === "CUSTOMER" &&
      session.hasSignal &&
      session.participantRoles.some((role) => role !== "AE"),
  },
];

const teamSellingStatus = (score: number): TeamSellingScore["status"] =>
  score >= 80
    ? "HEALTHY"
    : score >= 60
      ? "WATCH"
      : score >= 40
        ? "AT_RISK"
        : "CRITICAL";

const teamSellingSignalScore = (sessions: TeamSellingSession[]) => {
  const valid = sessions.filter((session) => session.status !== "CANCELLED");
  if (!valid.length)
    return { score: 0, detail: "No cadence evidence in the last 90 days." };
  const now = Date.now();
  const recent = valid.filter(
    (session) => now - new Date(session.occurredAt).getTime() <= 45 * 86400000,
  ).length;
  if (recent >= 2)
    return {
      score: 100,
      detail: `${recent} recent cadences in the last 45 days.`,
    };
  if (recent === 1)
    return { score: 80, detail: "One recent cadence in the last 45 days." };
  return { score: 50, detail: "Cadence evidence is older than 45 days." };
};

export function calculateTeamSellingScore(
  membershipId: string,
  sessions: TeamSellingSession[],
): TeamSellingScore {
  const signals = teamSellingDefinitions.map((definition) => {
    const evidence = sessions.filter(
      (session) =>
        session.membershipId === membershipId && definition.matches(session),
    );
    const result = teamSellingSignalScore(evidence);
    return {
      key: definition.key,
      label: definition.label,
      score: result.score,
      detail: result.detail,
      coachingSuggestion: definition.suggestion,
    };
  });
  const score = Math.round(
    signals.reduce((total, signal) => total + signal.score, 0) / signals.length,
  );
  return {
    score,
    status: teamSellingStatus(score),
    signals,
    coachingSuggestions: signals
      .filter((signal) => signal.score < 80)
      .sort((a, b) => a.score - b.score)
      .slice(0, 3)
      .map((signal) => signal.coachingSuggestion),
  };
}

/** Cross-functional cadence and customer-signal coverage for each AE. */
export async function getTeamSellingScores(
  organizationId: string,
  membershipIds: string[],
): Promise<Record<string, TeamSellingScore>> {
  if (!membershipIds.length) return {};
  const { rows } = await query(
    `SELECT target.membership_id,
      t.code AS template_code,s.scope,s.status,
      COALESCE(s.completed_at,s.scheduled_at,s.created_at)::text AS occurred_at,
      EXISTS(
        SELECT 1 FROM leading_indicators li
        WHERE li.organization_id=s.organization_id
          AND ((s.opportunity_id IS NOT NULL AND li.opportunity_id=s.opportunity_id)
            OR (s.account_id IS NOT NULL AND li.account_id=s.account_id))
          AND li.observed_at >= now()-interval '90 days'
      ) AS has_signal,
      array_remove(array_agg(DISTINCT COALESCE(st.code,rd.code)),NULL) AS participant_roles
     FROM cadence_sessions s
     JOIN cadence_templates t ON t.organization_id=s.organization_id AND t.id=s.template_id
     JOIN cadence_participants target ON target.organization_id=s.organization_id AND target.cadence_session_id=s.id
     JOIN cadence_participants participant ON participant.organization_id=s.organization_id AND participant.cadence_session_id=s.id
     LEFT JOIN organization_memberships pm ON pm.organization_id=participant.organization_id AND pm.id=participant.membership_id
     LEFT JOIN membership_role_assignments a ON a.organization_id=pm.organization_id AND a.membership_id=pm.id AND a.is_primary AND a.effective_to IS NULL
     LEFT JOIN organization_role_definitions rd ON rd.organization_id=a.organization_id AND rd.id=a.organization_role_definition_id
     LEFT JOIN system_role_templates st ON st.id=rd.system_template_id
     WHERE s.organization_id=$1 AND target.membership_id=ANY($2::text[])
       AND COALESCE(s.completed_at,s.scheduled_at,s.created_at) >= now()-interval '90 days'
     GROUP BY target.membership_id,t.code,s.scope,s.status,s.id,s.completed_at,s.scheduled_at,s.created_at,s.organization_id,s.account_id,s.opportunity_id`,
    [organizationId, membershipIds],
  );
  const sessionsByMembership = new Map<string, TeamSellingSession[]>();
  for (const row of rows) {
    const session: TeamSellingSession = {
      membershipId: String(row.membership_id),
      templateCode: String(row.template_code),
      scope: String(row.scope),
      occurredAt: String(row.occurred_at),
      status: String(row.status),
      participantRoles: (row.participant_roles ?? []).map(String),
      hasSignal: Boolean(row.has_signal),
    };
    const existing = sessionsByMembership.get(session.membershipId) ?? [];
    existing.push(session);
    sessionsByMembership.set(session.membershipId, existing);
  }
  return Object.fromEntries(
    membershipIds.map((membershipId) => [
      membershipId,
      calculateTeamSellingScore(
        membershipId,
        sessionsByMembership.get(membershipId) ?? [],
      ),
    ]),
  );
}
