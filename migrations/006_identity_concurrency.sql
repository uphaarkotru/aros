-- Targeted identity-command concurrency and bootstrap idempotency.
ALTER TABLE organizations ADD COLUMN version integer NOT NULL DEFAULT 1;
ALTER TABLE organization_memberships ADD COLUMN version integer NOT NULL DEFAULT 1;
ALTER TABLE organization_role_definitions ADD COLUMN version integer NOT NULL DEFAULT 1;
ALTER TABLE organizational_units ADD COLUMN version integer NOT NULL DEFAULT 1;
ALTER TABLE organization_invitations ADD COLUMN version integer NOT NULL DEFAULT 1;
ALTER TABLE organizations ADD COLUMN bootstrap_idempotency_key text;
CREATE UNIQUE INDEX organizations_bootstrap_idempotency_idx ON organizations(bootstrap_idempotency_key) WHERE bootstrap_idempotency_key IS NOT NULL;
ALTER TABLE organization_invitations ADD CONSTRAINT invitation_acceptance_state_check CHECK ((status='ACCEPTED' AND accepted_at IS NOT NULL) OR (status<>'ACCEPTED'));
-- Existing partial indexes one_active_primary_role_idx and one_primary_manager_idx remain the final DB guard.
