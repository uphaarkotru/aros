-- Enterprise multi-tenant foundation. Legacy user role/manager/team columns remain during compatibility migration.
CREATE TYPE platform_role AS ENUM ('SUPER_ADMIN');
CREATE TYPE organization_environment AS ENUM ('DEMO','SANDBOX','PRODUCTION');
CREATE TYPE membership_admin_role AS ENUM ('ORG_OWNER','ORG_ADMIN','MEMBER');
CREATE TYPE membership_status AS ENUM ('INVITED','ACTIVE','SUSPENDED','DEACTIVATED');
CREATE TYPE relationship_type AS ENUM ('REPORTS_TO','DOTTED_LINE_TO','TECHNICAL_SUPPORTS','OVERLAY_SUPPORTS','PARTNER_SUPPORTS','MENTORS');

ALTER TABLE organizations ADD COLUMN primary_domain text, ADD COLUMN environment organization_environment NOT NULL DEFAULT 'SANDBOX', ADD COLUMN timezone text NOT NULL DEFAULT 'UTC', ADD COLUMN fiscal_year_start_month smallint, ADD COLUMN default_methodology text;
ALTER TABLE users ADD COLUMN platform_role platform_role;
CREATE UNIQUE INDEX users_global_email_idx ON users(lower(email));

CREATE TABLE organization_memberships(id text PRIMARY KEY,organization_id text NOT NULL REFERENCES organizations(id),user_id text NOT NULL REFERENCES users(id),admin_role membership_admin_role NOT NULL DEFAULT 'MEMBER',status membership_status NOT NULL DEFAULT 'INVITED',joined_at timestamptz,permission_overrides jsonb,created_at timestamptz NOT NULL,updated_at timestamptz NOT NULL,UNIQUE(organization_id,user_id));
CREATE TABLE system_role_templates(id text PRIMARY KEY,code text NOT NULL UNIQUE,name text NOT NULL,category text NOT NULL,description text NOT NULL,default_experience_key text,default_permissions jsonb NOT NULL,capabilities jsonb NOT NULL,is_active boolean NOT NULL DEFAULT true);
CREATE TABLE organization_role_definitions(id text PRIMARY KEY,organization_id text NOT NULL REFERENCES organizations(id),name text NOT NULL,code text NOT NULL,system_template_id text REFERENCES system_role_templates(id),category text NOT NULL,description text,default_experience_key text,permissions jsonb NOT NULL DEFAULT '[]',is_system_seeded boolean NOT NULL DEFAULT false,is_active boolean NOT NULL DEFAULT true,created_at timestamptz NOT NULL,updated_at timestamptz NOT NULL,UNIQUE(organization_id,code));
CREATE TABLE membership_role_assignments(id text PRIMARY KEY,organization_id text NOT NULL REFERENCES organizations(id),membership_id text NOT NULL REFERENCES organization_memberships(id),organization_role_definition_id text NOT NULL REFERENCES organization_role_definitions(id),is_primary boolean NOT NULL DEFAULT false,effective_from timestamptz,effective_to timestamptz,created_at timestamptz NOT NULL,updated_at timestamptz NOT NULL);
CREATE UNIQUE INDEX one_active_primary_role_idx ON membership_role_assignments(membership_id) WHERE is_primary AND effective_to IS NULL;

CREATE TABLE organizational_units(id text PRIMARY KEY,organization_id text NOT NULL REFERENCES organizations(id),name text NOT NULL,type text NOT NULL,parent_unit_id text REFERENCES organizational_units(id),leader_membership_id text REFERENCES organization_memberships(id),status text NOT NULL,created_at timestamptz NOT NULL,updated_at timestamptz NOT NULL);
CREATE TABLE membership_organizational_units(id text PRIMARY KEY,organization_id text NOT NULL REFERENCES organizations(id),membership_id text NOT NULL REFERENCES organization_memberships(id),organizational_unit_id text NOT NULL REFERENCES organizational_units(id),membership_type text,is_primary boolean NOT NULL DEFAULT false,created_at timestamptz NOT NULL);
CREATE TABLE organization_relationships(id text PRIMARY KEY,organization_id text NOT NULL REFERENCES organizations(id),source_membership_id text NOT NULL REFERENCES organization_memberships(id),target_membership_id text NOT NULL REFERENCES organization_memberships(id),relationship_type relationship_type NOT NULL,is_primary boolean NOT NULL DEFAULT false,effective_from timestamptz,effective_to timestamptz,metadata jsonb,created_at timestamptz NOT NULL,updated_at timestamptz NOT NULL,CHECK(source_membership_id<>target_membership_id));
CREATE UNIQUE INDEX one_primary_manager_idx ON organization_relationships(source_membership_id) WHERE relationship_type='REPORTS_TO' AND is_primary AND effective_to IS NULL;
CREATE INDEX reporting_graph_idx ON organization_relationships(organization_id,target_membership_id,relationship_type) WHERE effective_to IS NULL;

CREATE TABLE revenue_team_assignments(id text PRIMARY KEY,organization_id text NOT NULL REFERENCES organizations(id),account_id text,opportunity_id text,membership_id text NOT NULL REFERENCES organization_memberships(id),organization_role_definition_id text REFERENCES organization_role_definitions(id),participation_type text NOT NULL,is_primary_owner boolean NOT NULL DEFAULT false,created_at timestamptz NOT NULL,CHECK(account_id IS NOT NULL OR opportunity_id IS NOT NULL));
CREATE INDEX revenue_team_account_idx ON revenue_team_assignments(organization_id,account_id); CREATE INDEX revenue_team_opportunity_idx ON revenue_team_assignments(organization_id,opportunity_id);
CREATE TABLE organization_invitations(id text PRIMARY KEY,organization_id text NOT NULL REFERENCES organizations(id),email text NOT NULL,admin_role membership_admin_role NOT NULL,configuration jsonb NOT NULL,token_hash text NOT NULL UNIQUE,expires_at timestamptz NOT NULL,accepted_at timestamptz,invited_by_user_id text NOT NULL REFERENCES users(id),status text NOT NULL,created_at timestamptz NOT NULL);
CREATE TABLE tenant_integrations(id text PRIMARY KEY,organization_id text NOT NULL REFERENCES organizations(id),category text NOT NULL,provider text,status text NOT NULL,secret_reference text,updated_at timestamptz NOT NULL,UNIQUE(organization_id,category));
CREATE TABLE governance_configurations(organization_id text PRIMARY KEY REFERENCES organizations(id),configuration jsonb NOT NULL,updated_at timestamptz NOT NULL);

-- Backfill order: memberships -> tenant role definitions -> role assignments -> relationships -> unit memberships -> revenue teams.
-- Validate no cross-tenant foreign-key pairs before application consumers stop reading legacy columns.
