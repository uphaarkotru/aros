-- Normalize stable Revenue Digital Twin child concepts; root JSON remains a versioned read model.
CREATE TABLE revenue_stakeholders(
 id text PRIMARY KEY, organization_id text NOT NULL REFERENCES organizations(id), account_id text NOT NULL,
 name text NOT NULL,title text,department text,seniority text,buying_role text,influence_level text,support_level text,
 relationship_strength text,engagement_trend text,sentiment text,last_interaction_at timestamptz,attributes jsonb NOT NULL DEFAULT '{}',
 created_at timestamptz NOT NULL DEFAULT now(),updated_at timestamptz NOT NULL DEFAULT now(),UNIQUE(organization_id,id),
 FOREIGN KEY(organization_id,account_id) REFERENCES accounts(organization_id,id));
CREATE TABLE methodology_states(
 id text PRIMARY KEY,organization_id text NOT NULL REFERENCES organizations(id),account_id text NOT NULL,opportunity_id text,
 methodology text NOT NULL,completeness_score numeric(5,2),state jsonb NOT NULL DEFAULT '{}',updated_at timestamptz NOT NULL DEFAULT now(),
 UNIQUE(organization_id,id),UNIQUE(organization_id,account_id,methodology),
 FOREIGN KEY(organization_id,account_id) REFERENCES accounts(organization_id,id),
 FOREIGN KEY(organization_id,opportunity_id) REFERENCES opportunities(organization_id,id));
CREATE INDEX stakeholders_account_idx ON revenue_stakeholders(organization_id,account_id,updated_at DESC);
CREATE INDEX methodology_account_idx ON methodology_states(organization_id,account_id,updated_at DESC);
