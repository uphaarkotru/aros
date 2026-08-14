-- Durable tenant-owned revenue persistence. PostgreSQL 15+.
ALTER TYPE organization_status ADD VALUE IF NOT EXISTS 'PROVISIONING';
ALTER TYPE organization_status ADD VALUE IF NOT EXISTS 'SUSPENDED';
ALTER TYPE organization_status ADD VALUE IF NOT EXISTS 'ARCHIVED';
ALTER TYPE user_status ADD VALUE IF NOT EXISTS 'SUSPENDED';
ALTER TYPE user_status ADD VALUE IF NOT EXISTS 'DEACTIVATED';
ALTER TYPE revenue_role ADD VALUE IF NOT EXISTS 'SALES_ENGINEER';
ALTER TYPE revenue_role ADD VALUE IF NOT EXISTS 'SALES_ENGINEER_MANAGER';

CREATE TABLE accounts (
  id text PRIMARY KEY,
  organization_id text NOT NULL REFERENCES organizations(id) ON DELETE RESTRICT,
  external_id text,
  name text NOT NULL,
  domain text,
  segment text,
  status text NOT NULL DEFAULT 'ACTIVE',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (organization_id,id),
  UNIQUE (organization_id,external_id)
);

CREATE TABLE opportunities (
  id text PRIMARY KEY,
  organization_id text NOT NULL REFERENCES organizations(id) ON DELETE RESTRICT,
  account_id text NOT NULL,
  external_id text,
  name text NOT NULL,
  stage text,
  amount numeric(18,2),
  currency char(3),
  close_date date,
  status text NOT NULL DEFAULT 'OPEN',
  owner_membership_id text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (organization_id,id),
  UNIQUE (organization_id,external_id),
  FOREIGN KEY (organization_id,account_id) REFERENCES accounts(organization_id,id),
  FOREIGN KEY (organization_id,owner_membership_id) REFERENCES organization_memberships(organization_id,id)
);

CREATE TABLE revenue_digital_twins (
  id text PRIMARY KEY,
  organization_id text NOT NULL REFERENCES organizations(id) ON DELETE RESTRICT,
  account_id text NOT NULL,
  health_state text,
  risk_state text,
  lifecycle_state text,
  state jsonb NOT NULL DEFAULT '{}',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (organization_id,id),
  UNIQUE (organization_id,account_id),
  FOREIGN KEY (organization_id,account_id) REFERENCES accounts(organization_id,id)
);

CREATE TABLE revenue_digital_twin_events (
  id text PRIMARY KEY,
  organization_id text NOT NULL REFERENCES organizations(id) ON DELETE RESTRICT,
  revenue_digital_twin_id text NOT NULL,
  actor_membership_id text,
  event_type text NOT NULL,
  payload jsonb NOT NULL DEFAULT '{}',
  occurred_at timestamptz NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (organization_id,id),
  FOREIGN KEY (organization_id,revenue_digital_twin_id) REFERENCES revenue_digital_twins(organization_id,id),
  FOREIGN KEY (organization_id,actor_membership_id) REFERENCES organization_memberships(organization_id,id)
);

CREATE TABLE revenue_signals (
  id text PRIMARY KEY,
  organization_id text NOT NULL REFERENCES organizations(id) ON DELETE RESTRICT,
  account_id text,
  opportunity_id text,
  type text NOT NULL,
  source text NOT NULL,
  severity text,
  confidence numeric(5,4) CHECK (confidence IS NULL OR confidence BETWEEN 0 AND 1),
  payload jsonb NOT NULL DEFAULT '{}',
  observed_at timestamptz NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (organization_id,id),
  FOREIGN KEY (organization_id,account_id) REFERENCES accounts(organization_id,id),
  FOREIGN KEY (organization_id,opportunity_id) REFERENCES opportunities(organization_id,id),
  CHECK (account_id IS NOT NULL OR opportunity_id IS NOT NULL)
);

CREATE TABLE action_decisions (
  id text PRIMARY KEY,
  organization_id text NOT NULL REFERENCES organizations(id) ON DELETE RESTRICT,
  account_id text,
  opportunity_id text,
  assigned_membership_id text,
  created_by_membership_id text,
  type text NOT NULL,
  recommendation text NOT NULL,
  status text NOT NULL DEFAULT 'PENDING',
  evidence jsonb NOT NULL DEFAULT '[]',
  metadata jsonb NOT NULL DEFAULT '{}',
  idempotency_key text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (organization_id,id),
  UNIQUE (organization_id,idempotency_key),
  FOREIGN KEY (organization_id,account_id) REFERENCES accounts(organization_id,id),
  FOREIGN KEY (organization_id,opportunity_id) REFERENCES opportunities(organization_id,id),
  FOREIGN KEY (organization_id,assigned_membership_id) REFERENCES organization_memberships(organization_id,id),
  FOREIGN KEY (organization_id,created_by_membership_id) REFERENCES organization_memberships(organization_id,id),
  CHECK (account_id IS NOT NULL OR opportunity_id IS NOT NULL)
);

ALTER TABLE revenue_team_assignments
  ADD COLUMN IF NOT EXISTS updated_at timestamptz NOT NULL DEFAULT now(),
  ADD CONSTRAINT revenue_teams_tenant_account_fk FOREIGN KEY (organization_id,account_id) REFERENCES accounts(organization_id,id),
  ADD CONSTRAINT revenue_teams_tenant_opportunity_fk FOREIGN KEY (organization_id,opportunity_id) REFERENCES opportunities(organization_id,id);

ALTER TABLE security_audit_events ADD COLUMN IF NOT EXISTS actor_membership_id text;
ALTER TABLE security_audit_events ADD CONSTRAINT audit_tenant_actor_membership_fk
  FOREIGN KEY (organization_id,actor_membership_id) REFERENCES organization_memberships(organization_id,id);

CREATE INDEX accounts_org_updated_idx ON accounts(organization_id,updated_at DESC);
CREATE INDEX opportunities_org_account_idx ON opportunities(organization_id,account_id,updated_at DESC);
CREATE INDEX signals_account_time_idx ON revenue_signals(organization_id,account_id,observed_at DESC);
CREATE INDEX signals_opportunity_time_idx ON revenue_signals(organization_id,opportunity_id,observed_at DESC);
CREATE INDEX twin_events_time_idx ON revenue_digital_twin_events(organization_id,revenue_digital_twin_id,occurred_at DESC);
CREATE INDEX decisions_account_status_idx ON action_decisions(organization_id,account_id,status,updated_at DESC);
CREATE INDEX decisions_assignee_status_idx ON action_decisions(organization_id,assigned_membership_id,status,updated_at DESC);
CREATE INDEX revenue_team_membership_idx ON revenue_team_assignments(organization_id,membership_id,created_at DESC);
