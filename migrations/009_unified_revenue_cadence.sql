CREATE TABLE cadence_templates(
 id text PRIMARY KEY,organization_id text NOT NULL REFERENCES organizations(id),code text NOT NULL,name text NOT NULL,scope text NOT NULL,
 suggested_frequency text,participant_expectations jsonb NOT NULL DEFAULT '[]',sections jsonb NOT NULL DEFAULT '[]',is_system_seeded boolean NOT NULL DEFAULT false,is_active boolean NOT NULL DEFAULT true,created_at timestamptz NOT NULL,updated_at timestamptz NOT NULL,
 UNIQUE(organization_id,code),UNIQUE(organization_id,id));

CREATE TABLE cadence_sessions(
 id text PRIMARY KEY,organization_id text NOT NULL REFERENCES organizations(id),template_id text NOT NULL,status text NOT NULL,scope text NOT NULL,
 account_id text,opportunity_id text,scheduled_at timestamptz,started_at timestamptz,completed_at timestamptz,preparation_summary text,internal_summary text,external_safe_summary text,version integer NOT NULL DEFAULT 1,idempotency_key text,created_at timestamptz NOT NULL,updated_at timestamptz NOT NULL,
 FOREIGN KEY(organization_id,template_id) REFERENCES cadence_templates(organization_id,id),FOREIGN KEY(organization_id,account_id) REFERENCES accounts(organization_id,id),FOREIGN KEY(organization_id,opportunity_id) REFERENCES opportunities(organization_id,id),
 UNIQUE(organization_id,id),UNIQUE(organization_id,idempotency_key),CHECK(scope IN('INTERNAL','CUSTOMER','PROSPECT','PARTNER','EXECUTIVE')),CHECK(status IN('DRAFT','PREPARED','SCHEDULED','IN_PROGRESS','COMPLETED','CANCELLED')));

CREATE TABLE cadence_participants(
 id text PRIMARY KEY,organization_id text NOT NULL REFERENCES organizations(id),cadence_session_id text NOT NULL,membership_id text,external_stakeholder_id text,participation_type text,participant_role text NOT NULL,required boolean NOT NULL DEFAULT false,attended boolean,created_at timestamptz NOT NULL,
 FOREIGN KEY(organization_id,cadence_session_id) REFERENCES cadence_sessions(organization_id,id) ON DELETE CASCADE,FOREIGN KEY(organization_id,membership_id) REFERENCES organization_memberships(organization_id,id),FOREIGN KEY(organization_id,external_stakeholder_id) REFERENCES revenue_stakeholders(organization_id,id),
 CHECK((membership_id IS NOT NULL)::int+(external_stakeholder_id IS NOT NULL)::int=1),UNIQUE(cadence_session_id,membership_id,external_stakeholder_id,participant_role));

CREATE TABLE cadence_agenda_items(
 id text PRIMARY KEY,organization_id text NOT NULL REFERENCES organizations(id),cadence_session_id text NOT NULL,type text NOT NULL,priority integer NOT NULL,title text NOT NULL,rationale text NOT NULL,evidence jsonb NOT NULL DEFAULT '[]',recommended_discussion text,recommended_decision text,status text NOT NULL,visibility text NOT NULL,created_at timestamptz NOT NULL,updated_at timestamptz NOT NULL,
 FOREIGN KEY(organization_id,cadence_session_id) REFERENCES cadence_sessions(organization_id,id) ON DELETE CASCADE,CHECK(visibility IN('SYSTEM_ONLY','INTERNAL_ONLY','EXTERNAL_SHAREABLE')));

CREATE TABLE cadence_decisions(
 id text PRIMARY KEY,organization_id text NOT NULL REFERENCES organizations(id),cadence_session_id text NOT NULL,decision_type text NOT NULL,decision text NOT NULL,rationale text,decided_by_membership_id text,visibility text NOT NULL,created_at timestamptz NOT NULL,
 FOREIGN KEY(organization_id,cadence_session_id) REFERENCES cadence_sessions(organization_id,id),FOREIGN KEY(organization_id,decided_by_membership_id) REFERENCES organization_memberships(organization_id,id),CHECK(visibility IN('INTERNAL_ONLY','EXTERNAL_SHAREABLE')));

CREATE TABLE commitments(
 id text PRIMARY KEY,organization_id text NOT NULL REFERENCES organizations(id),cadence_session_id text,account_id text,opportunity_id text,owner_membership_id text,external_stakeholder_id text,description text NOT NULL,due_at timestamptz,status text NOT NULL,expected_outcome text,completion_evidence jsonb,visibility text NOT NULL,impact text NOT NULL DEFAULT 'MEDIUM',version integer NOT NULL DEFAULT 1,created_at timestamptz NOT NULL,updated_at timestamptz NOT NULL,completed_at timestamptz,
 FOREIGN KEY(organization_id,cadence_session_id) REFERENCES cadence_sessions(organization_id,id),FOREIGN KEY(organization_id,account_id) REFERENCES accounts(organization_id,id),FOREIGN KEY(organization_id,opportunity_id) REFERENCES opportunities(organization_id,id),FOREIGN KEY(organization_id,owner_membership_id) REFERENCES organization_memberships(organization_id,id),FOREIGN KEY(organization_id,external_stakeholder_id) REFERENCES revenue_stakeholders(organization_id,id),
 CHECK(status IN('OPEN','IN_PROGRESS','BLOCKED','COMPLETED','MISSED','CANCELLED')),CHECK(visibility IN('INTERNAL_ONLY','EXTERNAL_SHAREABLE')),CHECK((owner_membership_id IS NOT NULL)::int+(external_stakeholder_id IS NOT NULL)::int<=1),UNIQUE(organization_id,id));

CREATE TABLE cadence_blockers(
 id text PRIMARY KEY,organization_id text NOT NULL REFERENCES organizations(id),cadence_session_id text,account_id text,opportunity_id text,type text NOT NULL,severity text NOT NULL,description text NOT NULL,owner_membership_id text,external_owner_stakeholder_id text,status text NOT NULL,visibility text NOT NULL,first_observed_at timestamptz NOT NULL,resolved_at timestamptz,created_at timestamptz NOT NULL,updated_at timestamptz NOT NULL,
 FOREIGN KEY(organization_id,cadence_session_id) REFERENCES cadence_sessions(organization_id,id),FOREIGN KEY(organization_id,account_id) REFERENCES accounts(organization_id,id),FOREIGN KEY(organization_id,opportunity_id) REFERENCES opportunities(organization_id,id),FOREIGN KEY(organization_id,owner_membership_id) REFERENCES organization_memberships(organization_id,id),FOREIGN KEY(organization_id,external_owner_stakeholder_id) REFERENCES revenue_stakeholders(organization_id,id),CHECK(visibility IN('INTERNAL_ONLY','EXTERNAL_SHAREABLE')),UNIQUE(organization_id,id));

CREATE TABLE cadence_outcomes(id text PRIMARY KEY,organization_id text NOT NULL REFERENCES organizations(id),cadence_session_id text NOT NULL,outcome_type text NOT NULL,description text NOT NULL,impact text,visibility text NOT NULL,evidence jsonb NOT NULL DEFAULT '[]',created_at timestamptz NOT NULL,FOREIGN KEY(organization_id,cadence_session_id) REFERENCES cadence_sessions(organization_id,id),CHECK(visibility IN('INTERNAL_ONLY','EXTERNAL_SHAREABLE')));

CREATE TABLE escalations(
 id text PRIMARY KEY,organization_id text NOT NULL REFERENCES organizations(id),account_id text,opportunity_id text,cadence_session_id text,type text NOT NULL,severity text NOT NULL,from_level text NOT NULL,to_level text NOT NULL,reason text NOT NULL,evidence jsonb NOT NULL DEFAULT '[]',status text NOT NULL,created_at timestamptz NOT NULL,acknowledged_at timestamptz,resolved_at timestamptz,
 FOREIGN KEY(organization_id,account_id) REFERENCES accounts(organization_id,id),FOREIGN KEY(organization_id,opportunity_id) REFERENCES opportunities(organization_id,id),FOREIGN KEY(organization_id,cadence_session_id) REFERENCES cadence_sessions(organization_id,id),CHECK(from_level IN('SELLER_TEAM','MANAGER','CROSS_FUNCTIONAL','VP','CRO')),CHECK(to_level IN('SELLER_TEAM','MANAGER','CROSS_FUNCTIONAL','VP','CRO')),UNIQUE(organization_id,id));

CREATE TABLE manager_interventions(
 id text PRIMARY KEY,organization_id text NOT NULL REFERENCES organizations(id),manager_membership_id text NOT NULL,seller_membership_id text,account_id text,opportunity_id text,type text NOT NULL,status text NOT NULL,priority_score integer NOT NULL,severity text NOT NULL,summary text NOT NULL,rationale text NOT NULL,evidence jsonb NOT NULL DEFAULT '[]',recommended_action text,resolved_at timestamptz,version integer NOT NULL DEFAULT 1,created_at timestamptz NOT NULL,updated_at timestamptz NOT NULL,
 FOREIGN KEY(organization_id,manager_membership_id) REFERENCES organization_memberships(organization_id,id),FOREIGN KEY(organization_id,seller_membership_id) REFERENCES organization_memberships(organization_id,id),FOREIGN KEY(organization_id,account_id) REFERENCES accounts(organization_id,id),FOREIGN KEY(organization_id,opportunity_id) REFERENCES opportunities(organization_id,id),CHECK(status IN('OPEN','ACKNOWLEDGED','ACTIONED','MONITORING','RESOLVED','DISMISSED')),CHECK(priority_score BETWEEN 0 AND 100),UNIQUE(organization_id,id));

CREATE INDEX cadence_sessions_motion_idx ON cadence_sessions(organization_id,opportunity_id,status,scheduled_at);
CREATE INDEX commitments_due_idx ON commitments(organization_id,status,due_at);
CREATE INDEX interventions_manager_idx ON manager_interventions(organization_id,manager_membership_id,status,priority_score DESC);
CREATE INDEX escalations_level_idx ON escalations(organization_id,to_level,status,created_at DESC);
