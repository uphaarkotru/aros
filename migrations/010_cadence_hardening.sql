ALTER TABLE manager_interventions
  ADD CONSTRAINT manager_intervention_type_check CHECK(type IN(
    'DEAL_RISK','SELLER_COACHING','COMMITMENT_SLIPPAGE','EXECUTIVE_ESCALATION',
    'RESOURCE_DECISION','METHODOLOGY_GAP','TECHNICAL_BLOCKER','FORECAST_EXCEPTION',
    'PARTNER_INTERVENTION','CROSS_FUNCTIONAL_COORDINATION','REVENUE_TEAM_COVERAGE_GAP'
  ));

CREATE UNIQUE INDEX manager_intervention_motion_unique
  ON manager_interventions(organization_id,manager_membership_id,opportunity_id)
  WHERE opportunity_id IS NOT NULL;

CREATE UNIQUE INDEX cadence_internal_participant_unique
  ON cadence_participants(organization_id,cadence_session_id,membership_id,participant_role)
  WHERE membership_id IS NOT NULL;

CREATE UNIQUE INDEX cadence_external_participant_unique
  ON cadence_participants(organization_id,cadence_session_id,external_stakeholder_id,participant_role)
  WHERE external_stakeholder_id IS NOT NULL;

CREATE INDEX cadence_participant_access_idx
  ON cadence_participants(organization_id,membership_id,cadence_session_id)
  WHERE membership_id IS NOT NULL;

CREATE INDEX cadence_blocker_motion_idx
  ON cadence_blockers(organization_id,opportunity_id,status,first_observed_at);
