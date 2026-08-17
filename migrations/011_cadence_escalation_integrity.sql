ALTER TABLE escalations
  ADD CONSTRAINT escalation_status_check CHECK(status IN('ELIGIBLE','PENDING','ACKNOWLEDGED','RESOLVED','DISMISSED'));

CREATE UNIQUE INDEX escalation_active_motion_level_unique
  ON escalations(organization_id,opportunity_id,to_level,type)
  WHERE opportunity_id IS NOT NULL AND status IN('ELIGIBLE','PENDING','ACKNOWLEDGED');
