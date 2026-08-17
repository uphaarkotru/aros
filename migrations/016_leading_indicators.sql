-- Tenant-owned leading-indicator evidence layer. Indicators inform risk and forecast;
-- they do not replace either human forecast judgment or the existing risk engine.
CREATE TABLE leading_indicators(
  id text PRIMARY KEY,
  organization_id text NOT NULL REFERENCES organizations(id) ON DELETE RESTRICT,
  account_id text,
  opportunity_id text,
  membership_id text,
  indicator_type text NOT NULL,
  status text NOT NULL,
  score integer,
  confidence text NOT NULL DEFAULT 'MEDIUM',
  evidence jsonb NOT NULL DEFAULT '[]',
  rationale text NOT NULL,
  source_key text,
  observed_at timestamptz NOT NULL,
  resolved_at timestamptz,
  version integer NOT NULL DEFAULT 1,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(organization_id,id),
  UNIQUE(organization_id,source_key),
  FOREIGN KEY(organization_id,account_id) REFERENCES accounts(organization_id,id),
  FOREIGN KEY(organization_id,opportunity_id) REFERENCES opportunities(organization_id,id),
  FOREIGN KEY(organization_id,membership_id) REFERENCES organization_memberships(organization_id,id),
  CHECK(account_id IS NOT NULL OR opportunity_id IS NOT NULL OR membership_id IS NOT NULL),
  CHECK(status IN('HEALTHY','WATCH','AT_RISK','CRITICAL','UNKNOWN')),
  CHECK(confidence IN('LOW','MEDIUM','HIGH')),
  CHECK(score IS NULL OR score BETWEEN 0 AND 100),
  CHECK(indicator_type IN(
    'EXECUTIVE_ENGAGEMENT','BUYING_COMMITTEE_COVERAGE','ECONOMIC_BUYER_ACCESS',
    'CUSTOMER_MEETING_HEALTH','NEXT_STEP_QUALITY','MUTUAL_ACTION_PLAN_PROGRESS',
    'METHODOLOGY_COMPLETENESS','TECHNICAL_VALIDATION_PROGRESS','SECURITY_REVIEW_PROGRESS',
    'CUSTOMER_COMMITMENT_HEALTH','REVENUE_TEAM_COVERAGE','BLOCKER_HEALTH',
    'DECISION_PROCESS_VALIDATION'
  ))
);

CREATE TABLE coaching_insights(
  id text PRIMARY KEY,
  organization_id text NOT NULL REFERENCES organizations(id) ON DELETE RESTRICT,
  membership_id text NOT NULL,
  account_id text,
  opportunity_id text,
  source_indicator_id text NOT NULL,
  visibility text NOT NULL DEFAULT 'INTERNAL_ONLY',
  title text NOT NULL,
  insight text NOT NULL,
  suggested_action text NOT NULL,
  evidence jsonb NOT NULL DEFAULT '[]',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(organization_id,id),
  UNIQUE(organization_id,membership_id,source_indicator_id),
  FOREIGN KEY(organization_id,membership_id) REFERENCES organization_memberships(organization_id,id),
  FOREIGN KEY(organization_id,account_id) REFERENCES accounts(organization_id,id),
  FOREIGN KEY(organization_id,opportunity_id) REFERENCES opportunities(organization_id,id),
  FOREIGN KEY(organization_id,source_indicator_id) REFERENCES leading_indicators(organization_id,id),
  CHECK(visibility IN('INTERNAL_ONLY','SYSTEM_ONLY'))
);

CREATE INDEX leading_indicators_motion_idx ON leading_indicators(organization_id,opportunity_id,status,observed_at DESC);
CREATE INDEX leading_indicators_account_idx ON leading_indicators(organization_id,account_id,status,observed_at DESC);
CREATE INDEX leading_indicators_member_idx ON leading_indicators(organization_id,membership_id,status,observed_at DESC);
CREATE INDEX coaching_insights_member_idx ON coaching_insights(organization_id,membership_id,updated_at DESC);
