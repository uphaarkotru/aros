ALTER TABLE users ADD COLUMN IF NOT EXISTS version integer NOT NULL DEFAULT 1;

CREATE UNIQUE INDEX IF NOT EXISTS one_pending_owner_invitation_idx
ON organization_invitations(organization_id)
WHERE admin_role = 'ORG_OWNER' AND status = 'PENDING';
