ALTER TYPE revenue_role ADD VALUE IF NOT EXISTS 'FIELD_CTO';
ALTER TYPE revenue_role ADD VALUE IF NOT EXISTS 'CUSTOMER_SUCCESS';
ALTER TYPE revenue_role ADD VALUE IF NOT EXISTS 'VALUE_ENGINEERING';
ALTER TYPE revenue_role ADD VALUE IF NOT EXISTS 'PRODUCT_SPECIALIST';
ALTER TYPE revenue_role ADD VALUE IF NOT EXISTS 'SERVICES';
ALTER TYPE revenue_role ADD VALUE IF NOT EXISTS 'REVOPS';
ALTER TYPE revenue_role ADD VALUE IF NOT EXISTS 'COMMERCIAL';
ALTER TYPE revenue_role ADD VALUE IF NOT EXISTS 'FIELD_MARKETING';

INSERT INTO system_role_templates(id,code,name,category,description,default_experience_key,default_permissions,capabilities,is_active) VALUES
('system-role-field-cto','FIELD_CTO','Field CTO','SALES_ENGINEERING','Senior customer-facing technical leadership and executive technical advisory','shared','["account.read","opportunity.read","commitment.create","activity.create"]','["technical-executive","executive-advisory"]',true),
('system-role-customer-success','CUSTOMER_SUCCESS','Customer Success','CUSTOM','Adoption, retention, customer health, and value realization','shared','["account.read","opportunity.read","commitment.create","commitment.update","activity.create"]','["customer-health","adoption"]',true),
('system-role-value-engineering','VALUE_ENGINEERING','Value Engineering','CUSTOM','Business case, ROI, and value realization support','shared','["account.read","opportunity.read","commitment.create","activity.create"]','["business-value","roi"]',true),
('system-role-product-specialist','PRODUCT_SPECIALIST','Product Specialist','CUSTOM','Deep product, domain, and overlay expertise','shared','["account.read","opportunity.read","commitment.create","activity.create"]','["product-expertise","overlay"]',true),
('system-role-services','SERVICES','Services','CUSTOM','Professional services, consulting, implementation, and services architecture','shared','["account.read","opportunity.read","commitment.create","commitment.update","activity.create"]','["implementation","services"]',true),
('system-role-revops','REVOPS','Revenue Operations','REVENUE_OPERATIONS','Revenue, sales, and go-to-market operations','shared','["account.read","opportunity.read","forecast.read","organization.read"]','["revenue-operations","process"]',true),
('system-role-commercial','COMMERCIAL','Commercial','REVENUE_OPERATIONS','Pricing, packaging, contracting, and deal-desk participation','shared','["account.read","opportunity.read","activity.create"]','["commercial-strategy","pricing"]',true),
('system-role-field-marketing','FIELD_MARKETING','Field Marketing','CUSTOM','Account-based, regional, event, and field marketing support','shared','["account.read","opportunity.read","activity.create"]','["field-marketing","abm"]',true)
ON CONFLICT(id) DO UPDATE SET name=excluded.name,description=excluded.description,default_experience_key=excluded.default_experience_key,default_permissions=excluded.default_permissions,capabilities=excluded.capabilities,is_active=excluded.is_active;

CREATE UNIQUE INDEX IF NOT EXISTS revenue_team_assignment_semantic_unique_idx
ON revenue_team_assignments(organization_id,membership_id,COALESCE(account_id,''),COALESCE(opportunity_id,''),participation_type);

CREATE INDEX IF NOT EXISTS revenue_team_opportunity_coverage_idx
ON revenue_team_assignments(organization_id,opportunity_id,participation_type)
WHERE opportunity_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS revenue_team_account_coverage_idx
ON revenue_team_assignments(organization_id,account_id,participation_type)
WHERE account_id IS NOT NULL;
