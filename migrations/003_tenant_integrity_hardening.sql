-- Enforce tenant identity at the database boundary, not only in application services.
ALTER TABLE organization_memberships ADD CONSTRAINT organization_memberships_org_id_id_key UNIQUE (organization_id,id);
ALTER TABLE organization_role_definitions ADD CONSTRAINT organization_role_definitions_org_id_id_key UNIQUE (organization_id,id);
ALTER TABLE organizational_units ADD CONSTRAINT organizational_units_org_id_id_key UNIQUE (organization_id,id);

ALTER TABLE membership_role_assignments
  ADD CONSTRAINT membership_role_assignments_tenant_membership_fk FOREIGN KEY (organization_id,membership_id) REFERENCES organization_memberships(organization_id,id),
  ADD CONSTRAINT membership_role_assignments_tenant_role_fk FOREIGN KEY (organization_id,organization_role_definition_id) REFERENCES organization_role_definitions(organization_id,id);

ALTER TABLE organizational_units
  ADD CONSTRAINT organizational_units_tenant_parent_fk FOREIGN KEY (organization_id,parent_unit_id) REFERENCES organizational_units(organization_id,id),
  ADD CONSTRAINT organizational_units_tenant_leader_fk FOREIGN KEY (organization_id,leader_membership_id) REFERENCES organization_memberships(organization_id,id);

ALTER TABLE membership_organizational_units
  ADD CONSTRAINT membership_units_tenant_membership_fk FOREIGN KEY (organization_id,membership_id) REFERENCES organization_memberships(organization_id,id),
  ADD CONSTRAINT membership_units_tenant_unit_fk FOREIGN KEY (organization_id,organizational_unit_id) REFERENCES organizational_units(organization_id,id),
  ADD CONSTRAINT membership_units_unique UNIQUE (organization_id,membership_id,organizational_unit_id);

ALTER TABLE organization_relationships
  ADD CONSTRAINT relationships_tenant_source_fk FOREIGN KEY (organization_id,source_membership_id) REFERENCES organization_memberships(organization_id,id),
  ADD CONSTRAINT relationships_tenant_target_fk FOREIGN KEY (organization_id,target_membership_id) REFERENCES organization_memberships(organization_id,id);

ALTER TABLE revenue_team_assignments
  ADD CONSTRAINT revenue_teams_tenant_membership_fk FOREIGN KEY (organization_id,membership_id) REFERENCES organization_memberships(organization_id,id),
  ADD CONSTRAINT revenue_teams_tenant_role_fk FOREIGN KEY (organization_id,organization_role_definition_id) REFERENCES organization_role_definitions(organization_id,id);

CREATE INDEX membership_roles_scope_idx ON membership_role_assignments(organization_id,membership_id,organization_role_definition_id) WHERE effective_to IS NULL;
CREATE INDEX membership_units_scope_idx ON membership_organizational_units(organization_id,membership_id,organizational_unit_id);
CREATE INDEX reporting_source_scope_idx ON organization_relationships(organization_id,source_membership_id,relationship_type) WHERE effective_to IS NULL;
CREATE INDEX organization_memberships_status_idx ON organization_memberships(organization_id,status,admin_role);

-- Platform events may have no tenant or revenue-role context. Preserve authority snapshots explicitly.
ALTER TABLE security_audit_events ALTER COLUMN organization_id DROP NOT NULL;
ALTER TABLE security_audit_events ALTER COLUMN actor_role DROP NOT NULL;
ALTER TABLE security_audit_events ADD COLUMN actor_admin_role membership_admin_role;
ALTER TABLE security_audit_events ADD COLUMN actor_platform_role platform_role;
