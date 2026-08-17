ALTER TABLE auth_sessions
  ADD COLUMN IF NOT EXISTS view_as_user_id text REFERENCES users(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS auth_sessions_view_as_user_idx
  ON auth_sessions (organization_id, view_as_user_id)
  WHERE view_as_user_id IS NOT NULL;

-- Remove identities accidentally left by the concurrency suite before its
-- cleanup was made transactional/test-scoped. These patterns were never part
-- of the deterministic demo persona library.
DELETE FROM membership_role_assignments
WHERE membership_id IN (
  SELECT m.id
  FROM organization_memberships m
  JOIN users u ON u.id = m.user_id
  WHERE m.organization_id = 'org-cognivit-demo'
    AND u.email LIKE '%@example.test'
);

DELETE FROM membership_organizational_units
WHERE membership_id IN (
  SELECT m.id
  FROM organization_memberships m
  JOIN users u ON u.id = m.user_id
  WHERE m.organization_id = 'org-cognivit-demo'
    AND u.email LIKE '%@example.test'
);

DELETE FROM organization_relationships
WHERE organization_id = 'org-cognivit-demo'
  AND (
    source_membership_id IN (
      SELECT m.id FROM organization_memberships m JOIN users u ON u.id = m.user_id
      WHERE m.organization_id = 'org-cognivit-demo' AND u.email LIKE '%@example.test'
    )
    OR target_membership_id IN (
      SELECT m.id FROM organization_memberships m JOIN users u ON u.id = m.user_id
      WHERE m.organization_id = 'org-cognivit-demo' AND u.email LIKE '%@example.test'
    )
  );

DELETE FROM organization_memberships
WHERE organization_id = 'org-cognivit-demo'
  AND user_id IN (
    SELECT id FROM users
    WHERE email LIKE '%@example.test'
  );

DELETE FROM users
WHERE organization_id = 'org-cognivit-demo'
  AND email LIKE '%@example.test';
