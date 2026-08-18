CREATE TABLE IF NOT EXISTS demo_scenario_states (
  id TEXT PRIMARY KEY,
  organization_id TEXT NOT NULL,
  scenario_key TEXT NOT NULL,
  state TEXT NOT NULL CHECK (state IN ('HEALTHY_STATE','RISK_DETECTED','MANAGER_INTERVENTION_REQUIRED','2X2_EXECUTED','FORECAST_RISK_UPDATED','EXECUTIVE_INTERVENTION_REQUIRED')),
  version INTEGER NOT NULL DEFAULT 1 CHECK (version > 0),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (organization_id, scenario_key),
  UNIQUE (organization_id, id),
  FOREIGN KEY (organization_id) REFERENCES organizations(id)
);
CREATE INDEX IF NOT EXISTS demo_scenario_states_org_idx ON demo_scenario_states(organization_id, scenario_key);
