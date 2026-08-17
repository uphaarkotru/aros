ALTER TABLE leadership_interventions
  DROP CONSTRAINT leadership_interventions_organization_id_escalation_id_fkey,
  ADD CONSTRAINT leadership_intervention_tenant_escalation_fk
    FOREIGN KEY(organization_id,escalation_id)
    REFERENCES escalations(organization_id,id)
    ON DELETE SET NULL (escalation_id);
