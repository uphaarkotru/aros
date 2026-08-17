-- A 2x2 is a collaboration cadence, not a governed business decision.
-- The prepared cadence session and its participants remain intact.
DELETE FROM action_decisions
WHERE id = 'decision-coinbase-2x2'
  AND organization_id = 'org-cognivit-demo'
  AND type = 'CADENCE_RECOMMENDATION';
