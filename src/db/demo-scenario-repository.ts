import { randomUUID } from "node:crypto";
import { query, transaction } from "./client";

export const COINBASE_SCENARIO = "coinbase-strategic-renewal" as const;
export const COINBASE_STATES = [
  "HEALTHY_STATE",
  "RISK_DETECTED",
  "MANAGER_INTERVENTION_REQUIRED",
  "2X2_EXECUTED",
  "FORECAST_RISK_UPDATED",
  "EXECUTIVE_INTERVENTION_REQUIRED",
] as const;
export type CoinbaseScenarioState = (typeof COINBASE_STATES)[number];

const ORG = "org-cognivit-demo";

export class DemoScenarioRepository {
  async getState(organizationId: string, scenarioKey = COINBASE_SCENARIO) {
    const result = await query<{
      state: CoinbaseScenarioState;
      version: number;
      updatedAt: string;
    }>(
      `SELECT state,version,updated_at AS "updatedAt" FROM demo_scenario_states WHERE organization_id=$1 AND scenario_key=$2`,
      [organizationId, scenarioKey],
    );
    return result.rows[0] ?? null;
  }

  async transition(
    organizationId: string,
    state: CoinbaseScenarioState,
    expectedVersion?: number,
  ) {
    return transaction(async (client) => {
      await client.query("SELECT pg_advisory_xact_lock(hashtext($1))", [
        `demo:${organizationId}:${COINBASE_SCENARIO}`,
      ]);
      const current = (
        await client.query<{ version: number }>(
          `SELECT version FROM demo_scenario_states WHERE organization_id=$1 AND scenario_key=$2 FOR UPDATE`,
          [organizationId, COINBASE_SCENARIO],
        )
      ).rows[0];
      if (
        expectedVersion !== undefined &&
        current &&
        Number(current.version) !== expectedVersion
      ) {
        const error = new Error(
          "Demo scenario changed. Refresh and try again.",
        );
        error.name = "CONCURRENCY_CONFLICT";
        throw error;
      }
      const result = await client.query(
        `INSERT INTO demo_scenario_states(id,organization_id,scenario_key,state,version,updated_at)
         VALUES($1,$2,$3,$4,1,now())
         ON CONFLICT(organization_id,scenario_key) DO UPDATE SET state=excluded.state,version=demo_scenario_states.version+1,updated_at=now()
         RETURNING state,version,updated_at AS "updatedAt"`,
        [
          `demo-state-${organizationId}-${COINBASE_SCENARIO}`,
          organizationId,
          COINBASE_SCENARIO,
          state,
        ],
      );
      const twin = (await client.query<{ id: string }>(
        `SELECT id FROM revenue_digital_twins WHERE organization_id=$1 AND account_id='acct-coinbase' LIMIT 1`,
        [organizationId],
      )).rows[0];
      if (twin)
        await client.query(
          `INSERT INTO revenue_digital_twin_events(id,organization_id,revenue_digital_twin_id,event_type,payload,occurred_at,created_at) VALUES($1,$2,$3,'DEMO_SCENARIO_STATE_CHANGED',$4,now(),now()) ON CONFLICT(id) DO NOTHING`,
          [
            `twin-event-demo-state-${organizationId}-${result.rows[0].version}`,
            organizationId,
            twin.id,
            JSON.stringify({ scenarioKey: COINBASE_SCENARIO, state, version: result.rows[0].version }),
          ],
        );
      return result.rows[0];
    });
  }

  /** Reset only the deterministic demo motion; never a general database reset. */
  async resetCoinbase(actor: {
    organizationId: string;
    userId: string;
    membershipId: string;
  }) {
    if (actor.organizationId !== ORG)
      throw new Error("Demo reset is limited to the Cognivit demo tenant");
    return transaction(async (client) => {
      await client.query("SELECT pg_advisory_xact_lock(hashtext($1))", [
        `demo:${ORG}:${COINBASE_SCENARIO}`,
      ]);
      const now = new Date();
      await client.query(
        `DELETE FROM cadence_sessions WHERE organization_id=$1 AND id LIKE 'demo-coinbase-%'`,
        [ORG],
      );
      await client.query(
        `DELETE FROM commitments WHERE organization_id=$1 AND id LIKE 'demo-coinbase-%'`,
        [ORG],
      );
      await client.query(
        `DELETE FROM revenue_digital_twin_events WHERE organization_id=$1 AND id LIKE 'demo-coinbase-flow-%'`,
        [ORG],
      );
      await client.query(
        `UPDATE leading_indicators SET status=CASE indicator_type
          WHEN 'EXECUTIVE_ENGAGEMENT' THEN 'AT_RISK'
          WHEN 'SECURITY_REVIEW_PROGRESS' THEN 'CRITICAL'
          WHEN 'CUSTOMER_COMMITMENT_HEALTH' THEN 'AT_RISK'
          WHEN 'ECONOMIC_BUYER_ACCESS' THEN 'WATCH'
          WHEN 'BUYING_COMMITTEE_COVERAGE' THEN 'WATCH'
          WHEN 'DECISION_PROCESS_VALIDATION' THEN 'UNKNOWN'
          ELSE status END,
          resolved_at=NULL,updated_at=$2,version=version+1
         WHERE organization_id=$1 AND opportunity_id='opp-coinbase-renewal'`,
        [ORG, now],
      );
      await client.query(
        `UPDATE commitments SET status='OPEN',completed_at=NULL,updated_at=$2 WHERE organization_id=$1 AND id IN ('commitment-coinbase-security-response','commitment-coinbase-exec-plan','commitment-coinbase-customer-feedback','commitment-coinbase-partner-introduction')`,
        [ORG, now],
      );
      await client.query(
        `UPDATE manager_interventions SET status='OPEN',resolved_at=NULL,updated_at=$2 WHERE organization_id=$1 AND id='intervention-coinbase-security'`,
        [ORG, now],
      );
      await client.query(
        `UPDATE leadership_interventions SET status='ELIGIBLE',approved_by_membership_id=NULL,approved_at=NULL,resolved_at=NULL,updated_at=$2 WHERE organization_id=$1 AND id='leadership-intervention-coinbase-vp'`,
        [ORG, now],
      );
      await client.query(
        `UPDATE action_decisions SET status='PENDING',updated_at=$2 WHERE organization_id=$1 AND id='decision-leadership-coinbase-vp'`,
        [ORG, now],
      );
      await client.query(
        `UPDATE forecast_assessments SET aros_category='HIGH_RISK',probability=67,confidence='HIGH',risk_score=61,updated_at=$2 WHERE organization_id=$1 AND id='forecast-coinbase-current'`,
        [ORG, now],
      );
      await client.query(
        `INSERT INTO demo_scenario_states(id,organization_id,scenario_key,state,version,updated_at)
         VALUES($1,$2,$3,'RISK_DETECTED',1,$4)
         ON CONFLICT(organization_id,scenario_key) DO UPDATE SET state='RISK_DETECTED',version=demo_scenario_states.version+1,updated_at=excluded.updated_at`,
        [`demo-state-${ORG}-${COINBASE_SCENARIO}`, ORG, COINBASE_SCENARIO, now],
      );
      await client.query(
        `INSERT INTO security_audit_events(id,organization_id,actor_user_id,actor_membership_id,event,resource_type,resource_id,timestamp,payload)
         VALUES($1,$2,$3,$4,'DEMO_SCENARIO_RESET','demo_scenario',$5,$6,$7)`,
        [
          `audit-demo-reset-${randomUUID()}`,
          ORG,
          actor.userId,
          actor.membershipId,
          COINBASE_SCENARIO,
          now,
          JSON.stringify({ state: "RISK_DETECTED" }),
        ],
      );
      return {
        scenarioKey: COINBASE_SCENARIO,
        state: "RISK_DETECTED" as const,
      };
    });
  }
}

export const demoScenarioRepository = new DemoScenarioRepository();
