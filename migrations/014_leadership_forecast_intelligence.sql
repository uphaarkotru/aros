ALTER TABLE opportunities
  ADD COLUMN seller_forecast_category text,
  ADD COLUMN manager_forecast_category text,
  ADD COLUMN forecast_updated_at timestamptz,
  ADD CONSTRAINT opportunity_seller_forecast_check CHECK(seller_forecast_category IS NULL OR seller_forecast_category IN('PIPELINE','UPSIDE','BEST_CASE','COMMIT','CLOSED')),
  ADD CONSTRAINT opportunity_manager_forecast_check CHECK(manager_forecast_category IS NULL OR manager_forecast_category IN('PIPELINE','UPSIDE','BEST_CASE','COMMIT','CLOSED'));

CREATE TABLE forecast_assessments(
  id text PRIMARY KEY,
  organization_id text NOT NULL REFERENCES organizations(id),
  opportunity_id text NOT NULL,
  seller_category text,
  manager_category text,
  aros_category text NOT NULL,
  probability integer NOT NULL,
  confidence text NOT NULL,
  risk_score integer NOT NULL,
  upside_score integer NOT NULL DEFAULT 0,
  rationale text NOT NULL,
  positive_evidence jsonb NOT NULL DEFAULT '[]',
  negative_evidence jsonb NOT NULL DEFAULT '[]',
  missing_evidence jsonb NOT NULL DEFAULT '[]',
  change_drivers jsonb NOT NULL DEFAULT '[]',
  evidence_snapshot jsonb NOT NULL DEFAULT '{}',
  discrepancy_types jsonb NOT NULL DEFAULT '[]',
  previous_assessment_id text,
  version integer NOT NULL DEFAULT 1,
  created_at timestamptz NOT NULL,
  updated_at timestamptz NOT NULL,
  UNIQUE(organization_id,id),
  FOREIGN KEY(organization_id,opportunity_id) REFERENCES opportunities(organization_id,id),
  FOREIGN KEY(organization_id,previous_assessment_id) REFERENCES forecast_assessments(organization_id,id),
  CHECK(seller_category IS NULL OR seller_category IN('PIPELINE','UPSIDE','BEST_CASE','COMMIT','CLOSED')),
  CHECK(manager_category IS NULL OR manager_category IN('PIPELINE','UPSIDE','BEST_CASE','COMMIT','CLOSED')),
  CHECK(aros_category IN('LIKELY','AT_RISK','HIGH_RISK')),
  CHECK(probability BETWEEN 0 AND 100),
  CHECK(confidence IN('LOW','MEDIUM','HIGH')),
  CHECK(risk_score BETWEEN 0 AND 100),
  CHECK(upside_score BETWEEN 0 AND 100)
);

CREATE TABLE leadership_interventions(
  id text PRIMARY KEY,
  organization_id text NOT NULL REFERENCES organizations(id),
  opportunity_id text NOT NULL,
  escalation_id text,
  assessment_id text NOT NULL,
  level text NOT NULL,
  type text NOT NULL,
  status text NOT NULL,
  priority_score integer NOT NULL,
  summary text NOT NULL,
  rationale text NOT NULL,
  evidence jsonb NOT NULL DEFAULT '[]',
  recommended_action text NOT NULL,
  expected_outcome text,
  approved_by_membership_id text,
  approved_at timestamptz,
  resolved_at timestamptz,
  idempotency_key text,
  version integer NOT NULL DEFAULT 1,
  created_at timestamptz NOT NULL,
  updated_at timestamptz NOT NULL,
  UNIQUE(organization_id,id),
  UNIQUE(organization_id,idempotency_key),
  FOREIGN KEY(organization_id,opportunity_id) REFERENCES opportunities(organization_id,id),
  FOREIGN KEY(organization_id,escalation_id) REFERENCES escalations(organization_id,id),
  FOREIGN KEY(organization_id,assessment_id) REFERENCES forecast_assessments(organization_id,id),
  FOREIGN KEY(organization_id,approved_by_membership_id) REFERENCES organization_memberships(organization_id,id),
  CHECK(level IN('VP','CRO')),
  CHECK(status IN('ELIGIBLE','PENDING','APPROVED','ACTIONED','MONITORING','RESOLVED','DISMISSED')),
  CHECK(priority_score BETWEEN 0 AND 100)
);

CREATE TABLE leadership_reviews(
  id text PRIMARY KEY,
  organization_id text NOT NULL REFERENCES organizations(id),
  assessment_id text NOT NULL,
  opportunity_id text NOT NULL,
  reviewer_membership_id text NOT NULL,
  review_type text NOT NULL,
  action text NOT NULL,
  prior_seller_category text,
  prior_manager_category text,
  resulting_manager_category text,
  rationale text,
  idempotency_key text NOT NULL,
  created_at timestamptz NOT NULL,
  UNIQUE(organization_id,id),
  UNIQUE(organization_id,idempotency_key),
  FOREIGN KEY(organization_id,assessment_id) REFERENCES forecast_assessments(organization_id,id),
  FOREIGN KEY(organization_id,opportunity_id) REFERENCES opportunities(organization_id,id),
  FOREIGN KEY(organization_id,reviewer_membership_id) REFERENCES organization_memberships(organization_id,id),
  CHECK(review_type IN('FORECAST_REVIEW','VP_OPERATING_REVIEW','CRO_OPERATING_REVIEW')),
  CHECK(action IN('ACCEPT_AROS','REQUEST_MANAGER_REVIEW','KEEP_CURRENT','CHANGE_MANAGER_FORECAST','ESCALATE'))
);

CREATE INDEX forecast_assessment_motion_time_idx ON forecast_assessments(organization_id,opportunity_id,created_at DESC);
CREATE INDEX forecast_assessment_risk_idx ON forecast_assessments(organization_id,aros_category,risk_score DESC,created_at DESC);
CREATE INDEX leadership_intervention_queue_idx ON leadership_interventions(organization_id,level,status,priority_score DESC);
CREATE INDEX leadership_review_motion_idx ON leadership_reviews(organization_id,opportunity_id,created_at DESC);
CREATE UNIQUE INDEX leadership_active_motion_level_unique
  ON leadership_interventions(organization_id,opportunity_id,level,type)
  WHERE status IN('ELIGIBLE','PENDING','APPROVED','ACTIONED','MONITORING');
