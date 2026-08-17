import { createHash } from "node:crypto";
import { Pool, type PoolClient } from "pg";
import { createDemoIdentityStore } from "../src/auth/seed";
import { syntheticAccounts } from "../src/data/synthetic/accounts";
import { accountDigitalTwins } from "../src/data/synthetic/final-account-digital-twins";
import { governedDecisions } from "../src/features/morning-briefing/data";
import { createCoinbaseRenewalWorkspaceFixture } from "../src/data/renewal-intelligence-fixtures/coinbase";

async function main() {
  if (!process.env.DATABASE_URL) throw new Error("DATABASE_URL is required");
  const pool = new Pool({ connectionString: process.env.DATABASE_URL });
  const store = createDemoIdentityStore(),
    now = "2026-08-12T16:00:00.000Z";
  const json = (value: unknown) => JSON.stringify(value ?? null);

  async function seedIdentity(client: PoolClient) {
    for (const organization of store.organizations)
      await client.query(
        `INSERT INTO organizations(id,name,slug,status,primary_domain,environment,timezone,fiscal_year_start_month,default_methodology,created_at,updated_at) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11) ON CONFLICT(id) DO UPDATE SET name=excluded.name,updated_at=excluded.updated_at`,
        [
          organization.id,
          organization.name,
          organization.slug,
          organization.status,
          organization.primaryDomain,
          organization.environment,
          organization.timezone,
          organization.fiscalYearStartMonth,
          organization.defaultMethodology,
          organization.createdAt,
          organization.updatedAt,
        ],
      );
    for (const region of store.regions)
      await client.query(
        `INSERT INTO regions(id,organization_id,name,parent_region_id) VALUES($1,$2,$3,$4) ON CONFLICT(id) DO UPDATE SET name=excluded.name`,
        [region.id, region.organizationId, region.name, region.parentRegionId],
      );
    for (const user of store.users)
      await client.query(
        `INSERT INTO users(id,organization_id,email,first_name,last_name,display_name,role,status,timezone,avatar_url,is_demo_user,is_admin,password_hash,platform_role,created_at,updated_at,last_login_at) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17) ON CONFLICT(id) DO UPDATE SET email=excluded.email,password_hash=excluded.password_hash,updated_at=excluded.updated_at`,
        [
          user.id,
          user.organizationId,
          user.email,
          user.firstName,
          user.lastName,
          user.displayName,
          user.role,
          user.status,
          user.timezone,
          user.avatarUrl,
          user.isDemoUser,
          user.isAdmin,
          user.passwordHash,
          user.platformRole,
          user.createdAt,
          user.updatedAt,
          user.lastLoginAt,
        ],
      );
    for (const team of store.teams)
      await client.query(
        `INSERT INTO teams(id,organization_id,name,manager_user_id,parent_team_id,type,created_at,updated_at) VALUES($1,$2,$3,$4,$5,$6,$7,$8) ON CONFLICT(id) DO UPDATE SET name=excluded.name,manager_user_id=excluded.manager_user_id`,
        [
          team.id,
          team.organizationId,
          team.name,
          team.managerUserId,
          team.parentTeamId,
          team.type,
          team.createdAt,
          team.updatedAt,
        ],
      );
    for (const user of store.users)
      await client.query(
        `UPDATE users SET manager_user_id=$2,team_id=$3,region_id=$4 WHERE id=$1`,
        [user.id, user.managerUserId, user.teamId, user.regionId],
      );
    for (const membership of store.memberships)
      await client.query(
        `INSERT INTO organization_memberships(id,organization_id,user_id,admin_role,status,joined_at,permission_overrides,created_at,updated_at) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9) ON CONFLICT(id) DO UPDATE SET admin_role=excluded.admin_role,status=excluded.status,updated_at=excluded.updated_at`,
        [
          membership.id,
          membership.organizationId,
          membership.userId,
          membership.adminRole,
          membership.status,
          membership.joinedAt,
          json(membership.permissionOverrides ?? {}),
          membership.createdAt,
          membership.updatedAt,
        ],
      );
    for (const template of store.systemRoleTemplates)
      await client.query(
        `INSERT INTO system_role_templates(id,code,name,category,description,default_experience_key,default_permissions,capabilities,is_active) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9) ON CONFLICT(id) DO UPDATE SET name=excluded.name,is_active=excluded.is_active`,
        [
          template.id,
          template.code,
          template.name,
          template.category,
          template.description,
          template.defaultExperienceKey,
          json(template.defaultPermissions),
          json(template.capabilities),
          template.isActive,
        ],
      );
    for (const role of store.organizationRoles)
      await client.query(
        `INSERT INTO organization_role_definitions(id,organization_id,name,code,system_template_id,category,description,default_experience_key,permissions,is_system_seeded,is_active,created_at,updated_at) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13) ON CONFLICT(id) DO UPDATE SET name=excluded.name,system_template_id=excluded.system_template_id,is_active=excluded.is_active,updated_at=excluded.updated_at`,
        [
          role.id,
          role.organizationId,
          role.name,
          role.code,
          role.systemTemplateId,
          role.category,
          role.description,
          role.defaultExperienceKey,
          json(role.permissions),
          role.isSystemSeeded,
          role.isActive,
          role.createdAt,
          role.updatedAt,
        ],
      );
    await client.query(
      `UPDATE membership_role_assignments SET is_primary=false WHERE organization_id = ANY($1::text[])`,
      [[...new Set(store.organizations.map((item) => item.id))]],
    );
    for (const assignment of store.roleAssignments)
      await client.query(
        `INSERT INTO membership_role_assignments(id,organization_id,membership_id,organization_role_definition_id,is_primary,effective_from,effective_to,created_at,updated_at) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9) ON CONFLICT(id) DO UPDATE SET is_primary=excluded.is_primary,effective_to=excluded.effective_to,updated_at=excluded.updated_at`,
        [
          assignment.id,
          assignment.organizationId,
          assignment.membershipId,
          assignment.organizationRoleDefinitionId,
          assignment.isPrimary,
          assignment.effectiveFrom,
          assignment.effectiveTo,
          assignment.createdAt,
          assignment.updatedAt,
        ],
      );
    for (const unit of store.organizationalUnits)
      await client.query(
        `INSERT INTO organizational_units(id,organization_id,name,type,parent_unit_id,leader_membership_id,status,created_at,updated_at) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9) ON CONFLICT(id) DO UPDATE SET name=excluded.name,parent_unit_id=excluded.parent_unit_id,leader_membership_id=excluded.leader_membership_id,status=excluded.status`,
        [
          unit.id,
          unit.organizationId,
          unit.name,
          unit.type,
          unit.parentUnitId,
          unit.leaderMembershipId,
          unit.status,
          unit.createdAt,
          unit.updatedAt,
        ],
      );
    for (const item of store.unitMemberships)
      await client.query(
        `INSERT INTO membership_organizational_units(id,organization_id,membership_id,organizational_unit_id,membership_type,is_primary,created_at) VALUES($1,$2,$3,$4,$5,$6,$7) ON CONFLICT(id) DO NOTHING`,
        [
          item.id,
          item.organizationId,
          item.membershipId,
          item.organizationalUnitId,
          item.membershipType,
          item.isPrimary,
          item.createdAt,
        ],
      );
    for (const item of store.relationships) {
      if (item.relationshipType === "REPORTS_TO" && item.isPrimary)
        await client.query(
          `UPDATE organization_relationships SET is_primary=false,effective_to=COALESCE(effective_to,$4),updated_at=$4 WHERE organization_id=$1 AND source_membership_id=$2 AND relationship_type='REPORTS_TO' AND is_primary AND effective_to IS NULL AND id<>$3`,
          [item.organizationId, item.sourceMembershipId, item.id, now],
        );
      await client.query(
        `INSERT INTO organization_relationships(id,organization_id,source_membership_id,target_membership_id,relationship_type,is_primary,effective_from,effective_to,metadata,created_at,updated_at) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11) ON CONFLICT(id) DO UPDATE SET target_membership_id=excluded.target_membership_id,relationship_type=excluded.relationship_type,is_primary=excluded.is_primary,effective_to=excluded.effective_to,metadata=excluded.metadata,updated_at=excluded.updated_at`,
        [
          item.id,
          item.organizationId,
          item.sourceMembershipId,
          item.targetMembershipId,
          item.relationshipType,
          item.isPrimary,
          item.effectiveFrom,
          item.effectiveTo,
          json(item.metadata),
          item.createdAt,
          item.updatedAt,
        ],
      );
    }
  }

  async function seedCadence(client: PoolClient) {
    const organizationId = "org-cognivit-demo",
      accountId = "acct-coinbase",
      opportunityId = "opp-coinbase-renewal",
      manager = "membership-org-cognivit-demo-user-rsm-mark",
      seller = "membership-org-cognivit-demo-user-ae-sarah",
      se = "membership-org-cognivit-demo-user-se-raj",
      seManager = "membership-org-cognivit-demo-user-se-manager-anita",
      sdr = "membership-org-cognivit-demo-user-sdr-alex",
      partner = "membership-org-cognivit-demo-user-partner-priya",
      fieldCto = "membership-org-cognivit-demo-user-field-cto-david",
      customerSuccess = "membership-org-cognivit-demo-user-cs-maria",
      valueEngineer = "membership-org-cognivit-demo-user-value-jason",
      productSpecialist = "membership-org-cognivit-demo-user-product-nina",
      services = "membership-org-cognivit-demo-user-services-elena",
      revops = "membership-org-cognivit-demo-user-revops-owen",
      commercial = "membership-org-cognivit-demo-user-commercial-claire",
      fieldMarketing = "membership-org-cognivit-demo-user-marketing-maya",
      cro = "membership-org-cognivit-demo-user-cro-michael",
      vp = "membership-org-cognivit-demo-user-vp-jennifer",
      otherManager = "membership-org-cognivit-demo-user-rsm-other",
      daniel = "membership-org-cognivit-demo-user-ae-daniel",
      priyaAe = "membership-org-cognivit-demo-user-ae-priya";
    const templates = [
      ["MANAGER_1_ON_1", "Manager 1:1", "INTERNAL", "WEEKLY"],
      ["SE_MANAGER_1_ON_1", "SE Manager 1:1", "INTERNAL", "WEEKLY"],
      ["AE_SE_SYNC", "AE–SE Sync", "INTERNAL", "WEEKLY"],
      ["AE_SDR_SYNC", "AE–SDR Sync", "INTERNAL", "WEEKLY"],
      ["AE_PARTNER_SYNC", "AE–Partner Sync", "PARTNER", "BIWEEKLY"],
      ["CROSS_FUNCTIONAL_2X2", "Cross-functional 2x2", "INTERNAL", "AS_NEEDED"],
      [
        "STRATEGIC_DEAL_REVIEW",
        "Strategic Deal Review",
        "INTERNAL",
        "AS_NEEDED",
      ],
      ["CUSTOMER_NEXT_STEP", "Customer Next-Step", "CUSTOMER", "AS_NEEDED"],
      ["DISCOVERY", "Discovery", "PROSPECT", "AS_NEEDED"],
      ["TECHNICAL_VALIDATION", "Technical Validation", "CUSTOMER", "AS_NEEDED"],
      ["SECURITY_REVIEW", "Security Review", "CUSTOMER", "WEEKLY"],
      [
        "EXECUTIVE_SPONSOR_MEETING",
        "Executive Sponsor Meeting",
        "EXECUTIVE",
        "AS_NEEDED",
      ],
      ["RENEWAL_REVIEW", "Renewal Review", "CUSTOMER", "MONTHLY"],
      [
        "MUTUAL_ACTION_PLAN_CHECKPOINT",
        "Mutual Action Plan Checkpoint",
        "CUSTOMER",
        "BIWEEKLY",
      ],
      ["CUSTOM", "Custom Cadence", "INTERNAL", "AS_NEEDED"],
    ];
    for (const [code, name, scope, frequency] of templates)
      await client.query(
        `INSERT INTO cadence_templates(id,organization_id,code,name,scope,suggested_frequency,participant_expectations,sections,is_system_seeded,is_active,created_at,updated_at) VALUES($1,$2,$3,$4,$5,$6,'[]','[]',true,true,$7,$7) ON CONFLICT(organization_id,code) DO UPDATE SET name=excluded.name,scope=excluded.scope,suggested_frequency=excluded.suggested_frequency,is_active=true,updated_at=excluded.updated_at`,
        [
          `cadence-template-${code.toLowerCase().replaceAll("_", "-")}`,
          organizationId,
          code,
          name,
          scope,
          frequency,
          now,
        ],
      );
    const session = (
      id: string,
      code: string,
      scope: string,
      status: string,
      internal: string,
      external: string | null,
      scheduledAt = now,
      sessionAccountId = accountId,
      sessionOpportunityId = opportunityId,
    ) =>
      client.query(
        `INSERT INTO cadence_sessions(id,organization_id,template_id,status,scope,account_id,opportunity_id,scheduled_at,completed_at,preparation_summary,internal_summary,external_safe_summary,idempotency_key,created_at,updated_at) VALUES($1,$2,$3,$4,$5,$6,$7,$8::timestamptz,CASE WHEN $4='COMPLETED' THEN $8::timestamptz ELSE NULL END,$9,$10,$11,$1,$8::timestamptz,$8::timestamptz) ON CONFLICT(id) DO UPDATE SET status=excluded.status,scheduled_at=excluded.scheduled_at,completed_at=excluded.completed_at,preparation_summary=excluded.preparation_summary,internal_summary=excluded.internal_summary,external_safe_summary=excluded.external_safe_summary,updated_at=excluded.updated_at`,
        [
          id,
          organizationId,
          `cadence-template-${code.toLowerCase().replaceAll("_", "-")}`,
          status,
          scope,
          sessionAccountId,
          sessionOpportunityId,
          scheduledAt,
          "AROS identified the security blocker, slipping commitments, stakeholder movement, and coverage facts.",
          internal,
          external,
        ],
      );
    await session(
      "cadence-coinbase-ae-se",
      "AE_SE_SYNC",
      "INTERNAL",
      "COMPLETED",
      "Security review stalled; executive engagement is declining. Keep forecast concern internal.",
      null,
    );
    await session(
      "cadence-coinbase-security",
      "SECURITY_REVIEW",
      "CUSTOMER",
      "COMPLETED",
      "Internal risk assessment: renewal exposure and escalation strategy remain confidential.",
      "Coinbase and CogniVit agreed that the updated security architecture response is due August 11, with the next checkpoint August 18.",
    );
    await session(
      "cadence-mark-sarah-prior",
      "MANAGER_1_ON_1",
      "INTERNAL",
      "COMPLETED",
      "Coach Sarah on evidence-based executive re-engagement and follow through on Coinbase security commitments.",
      null,
    );
    await session(
      "cadence-coinbase-ae-sdr-prior",
      "AE_SDR_SYNC",
      "INTERNAL",
      "COMPLETED",
      "Sarah and Alex aligned on executive persona coverage and a clean handoff into the renewal motion.",
      null,
      "2026-08-12T16:00:00Z",
    );
    await session(
      "cadence-coinbase-ae-partner-prior",
      "AE_PARTNER_SYNC",
      "PARTNER",
      "COMPLETED",
      "Sarah and Priya agreed to validate marketplace timing and identify a partner executive introduction.",
      null,
      "2026-08-13T18:00:00Z",
    );
    await session(
      "cadence-mark-sarah-next",
      "MANAGER_1_ON_1",
      "INTERNAL",
      "PREPARED",
      "Follow up on the Coinbase intervention, prior decisions, overdue commitments, and whether risk improved.",
      null,
      "2026-08-18T16:00:00Z",
    );
    await session(
      "cadence-coinbase-2x2",
      "CROSS_FUNCTIONAL_2X2",
      "INTERNAL",
      "PREPARED",
      "Resolve technical ownership, executive engagement, and escalation conditions.",
      null,
      "2026-08-18T18:00:00Z",
    );
    await session(
      "cadence-anita-raj-next",
      "SE_MANAGER_1_ON_1",
      "INTERNAL",
      "PREPARED",
      "Review Raj's security workload, the overdue architecture response, resource constraints, and technical coaching follow-ups.",
      null,
      "2026-08-19T16:30:00Z",
    );
    await session(
      "cadence-coinbase-ae-se-next",
      "AE_SE_SYNC",
      "INTERNAL",
      "PREPARED",
      "Align commercial and technical owners before the next Coinbase security checkpoint.",
      null,
      "2026-08-19T18:00:00Z",
    );
    await session(
      "cadence-coinbase-ae-sdr",
      "AE_SDR_SYNC",
      "INTERNAL",
      "PREPARED",
      "Review executive-contact gaps, outreach response signals, and the handoff into the renewal motion.",
      null,
      "2026-08-20T16:00:00Z",
    );
    await session(
      "cadence-coinbase-ae-partner",
      "AE_PARTNER_SYNC",
      "PARTNER",
      "PREPARED",
      "Align the marketplace co-sell motion, partner introduction, and joint executive engagement plan.",
      null,
      "2026-08-20T18:00:00Z",
    );
    await session(
      "cadence-coinbase-security-next",
      "SECURITY_REVIEW",
      "CUSTOMER",
      "PREPARED",
      "Prepare the shared checkpoint from open security requirements and mutual commitments; keep forecast and coaching context internal.",
      "Proposed agenda: confirm open requirements, architecture response owner, customer feedback date, and next checkpoint.",
      "2026-08-21T17:00:00Z",
    );
    await session(
      "cadence-paypal-mark-daniel-next",
      "MANAGER_1_ON_1",
      "INTERNAL",
      "PREPARED",
      "Review PayPal expansion evidence, next-step quality, and Daniel's commitments.",
      null,
      "2026-08-21T16:00:00Z",
      "acct-paypal",
      "opp-pp",
    );
    await session(
      "cadence-nvidia-olivia-priya-next",
      "MANAGER_1_ON_1",
      "INTERNAL",
      "PREPARED",
      "Review the NVIDIA global rollout, executive briefing readiness, and next commitments.",
      null,
      "2026-08-21T19:00:00Z",
      "acct-nvidia",
      "opp-nv",
    );
    await session(
      "cadence-coinbase-strategic-team-next",
      "STRATEGIC_DEAL_REVIEW",
      "INTERNAL",
      "PREPARED",
      "Coordinate the full Coinbase revenue team around security, value, services, commercial, and stakeholder workstreams.",
      null,
      "2026-08-22T17:00:00Z",
    );
    await session(
      "cadence-coinbase-executive-next",
      "EXECUTIVE_SPONSOR_MEETING",
      "EXECUTIVE",
      "PREPARED",
      "Align leadership and technical executive support before customer executive re-engagement.",
      null,
      "2026-08-22T19:00:00Z",
    );
    const participants: string[][] = [
      [
        "cadence-participant-ae-se-sarah",
        "cadence-coinbase-ae-se",
        seller,
        "PRIMARY_SELLER",
      ],
      [
        "cadence-participant-ae-se-raj",
        "cadence-coinbase-ae-se",
        se,
        "SALES_ENGINEERING",
      ],
      [
        "cadence-participant-security-sarah",
        "cadence-coinbase-security",
        seller,
        "PRIMARY_SELLER",
      ],
      [
        "cadence-participant-security-raj",
        "cadence-coinbase-security",
        se,
        "SALES_ENGINEERING",
      ],
      [
        "cadence-participant-2x2-sarah",
        "cadence-coinbase-2x2",
        seller,
        "PRIMARY_SELLER",
      ],
      [
        "cadence-participant-2x2-raj",
        "cadence-coinbase-2x2",
        se,
        "SALES_ENGINEERING",
      ],
      [
        "cadence-participant-2x2-mark",
        "cadence-coinbase-2x2",
        manager,
        "MANAGER",
      ],
      [
        "cadence-participant-2x2-anita",
        "cadence-coinbase-2x2",
        seManager,
        "SE_MANAGER",
      ],
      [
        "cadence-participant-1x1-mark",
        "cadence-mark-sarah-prior",
        manager,
        "MANAGER",
      ],
      [
        "cadence-participant-1x1-sarah",
        "cadence-mark-sarah-prior",
        seller,
        "DIRECT_REPORT",
      ],
      [
        "cadence-participant-next-1x1-mark",
        "cadence-mark-sarah-next",
        manager,
        "MANAGER",
      ],
      [
        "cadence-participant-next-1x1-sarah",
        "cadence-mark-sarah-next",
        seller,
        "DIRECT_REPORT",
      ],
      [
        "cadence-participant-ae-sdr-prior-sarah",
        "cadence-coinbase-ae-sdr-prior",
        seller,
        "PRIMARY_SELLER",
      ],
      [
        "cadence-participant-ae-sdr-prior-alex",
        "cadence-coinbase-ae-sdr-prior",
        sdr,
        "PROSPECTING",
      ],
      [
        "cadence-participant-ae-partner-prior-sarah",
        "cadence-coinbase-ae-partner-prior",
        seller,
        "PRIMARY_SELLER",
      ],
      [
        "cadence-participant-ae-partner-prior-priya",
        "cadence-coinbase-ae-partner-prior",
        partner,
        "PARTNER",
      ],
      [
        "cadence-participant-se-1x1-anita",
        "cadence-anita-raj-next",
        seManager,
        "SE_MANAGER",
      ],
      [
        "cadence-participant-se-1x1-raj",
        "cadence-anita-raj-next",
        se,
        "DIRECT_REPORT",
      ],
      [
        "cadence-participant-ae-se-next-sarah",
        "cadence-coinbase-ae-se-next",
        seller,
        "PRIMARY_SELLER",
      ],
      [
        "cadence-participant-ae-se-next-raj",
        "cadence-coinbase-ae-se-next",
        se,
        "SALES_ENGINEERING",
      ],
      [
        "cadence-participant-ae-sdr-sarah",
        "cadence-coinbase-ae-sdr",
        seller,
        "PRIMARY_SELLER",
      ],
      [
        "cadence-participant-ae-sdr-alex",
        "cadence-coinbase-ae-sdr",
        sdr,
        "PROSPECTING",
      ],
      [
        "cadence-participant-ae-partner-sarah",
        "cadence-coinbase-ae-partner",
        seller,
        "PRIMARY_SELLER",
      ],
      [
        "cadence-participant-ae-partner-priya",
        "cadence-coinbase-ae-partner",
        partner,
        "PARTNER",
      ],
      [
        "cadence-participant-security-next-sarah",
        "cadence-coinbase-security-next",
        seller,
        "PRIMARY_SELLER",
      ],
      [
        "cadence-participant-security-next-raj",
        "cadence-coinbase-security-next",
        se,
        "SALES_ENGINEERING",
      ],
      [
        "cadence-participant-paypal-mark",
        "cadence-paypal-mark-daniel-next",
        manager,
        "MANAGER",
      ],
      [
        "cadence-participant-paypal-daniel",
        "cadence-paypal-mark-daniel-next",
        daniel,
        "DIRECT_REPORT",
      ],
      [
        "cadence-participant-nvidia-olivia",
        "cadence-nvidia-olivia-priya-next",
        otherManager,
        "MANAGER",
      ],
      [
        "cadence-participant-nvidia-priya",
        "cadence-nvidia-olivia-priya-next",
        priyaAe,
        "DIRECT_REPORT",
      ],
      ...[
        [seller, "PRIMARY_SELLER"],
        [fieldCto, "TECHNICAL_EXECUTIVE"],
        [customerSuccess, "CUSTOMER_SUCCESS"],
        [valueEngineer, "VALUE_ENGINEERING"],
        [productSpecialist, "PRODUCT_SPECIALIST"],
        [services, "SERVICES"],
        [revops, "REVOPS"],
        [commercial, "COMMERCIAL"],
        [fieldMarketing, "FIELD_MARKETING"],
      ].map(([membership, role]) => [
        `cadence-participant-strategic-${membership.split("-").at(-1)}`,
        "cadence-coinbase-strategic-team-next",
        membership,
        role,
      ]),
      [
        "cadence-participant-executive-cro",
        "cadence-coinbase-executive-next",
        cro,
        "EXECUTIVE_SPONSOR",
      ],
      [
        "cadence-participant-executive-vp",
        "cadence-coinbase-executive-next",
        vp,
        "REVENUE_LEADERSHIP",
      ],
      [
        "cadence-participant-executive-field-cto",
        "cadence-coinbase-executive-next",
        fieldCto,
        "TECHNICAL_EXECUTIVE",
      ],
    ];
    for (const [id, cadence, membership, role] of participants)
      await client.query(
        `INSERT INTO cadence_participants(id,organization_id,cadence_session_id,membership_id,participant_role,required,attended,created_at) SELECT $1,$2,$3,$4,$5,true,CASE WHEN status='COMPLETED' THEN true ELSE NULL END,$6 FROM cadence_sessions WHERE organization_id=$2 AND id=$3 ON CONFLICT(id) DO UPDATE SET attended=excluded.attended`,
        [id, organizationId, cadence, membership, role, now],
      );
    await client.query(
      `INSERT INTO cadence_participants(id,organization_id,cadence_session_id,external_stakeholder_id,participant_role,required,attended,created_at) SELECT 'cadence-participant-security-customer',$1,'cadence-coinbase-security',id,'CUSTOMER_SECURITY',true,true,$2 FROM revenue_stakeholders WHERE organization_id=$1 AND account_id=$3 ORDER BY CASE WHEN lower(title) LIKE '%security%' THEN 0 ELSE 1 END LIMIT 1 ON CONFLICT(id) DO NOTHING`,
      [organizationId, now, accountId],
    );
    await client.query(
      `INSERT INTO cadence_participants(id,organization_id,cadence_session_id,external_stakeholder_id,participant_role,required,attended,created_at) SELECT 'cadence-participant-security-next-customer',$1,'cadence-coinbase-security-next',id,'CUSTOMER_SECURITY',true,false,$2 FROM revenue_stakeholders WHERE organization_id=$1 AND account_id=$3 ORDER BY CASE WHEN lower(title) LIKE '%security%' THEN 0 ELSE 1 END LIMIT 1 ON CONFLICT(id) DO NOTHING`,
      [organizationId, now, accountId],
    );
    const agenda = [
      [
        "agenda-coinbase-security",
        "cadence-coinbase-ae-se",
        "TECHNICAL_BLOCKER",
        100,
        "Security review stalled",
        "Security deliverable is overdue and the renewal is approaching.",
        "Confirm technical owner, evidence required, and next customer checkpoint.",
        "Initiate cross-functional 2x2",
        "INTERNAL_ONLY",
      ],
      [
        "agenda-coinbase-external",
        "cadence-coinbase-security",
        "NEXT_STEP",
        90,
        "Agree security response milestone",
        "Both teams need a dated, mutually understood next step.",
        "Confirm requirements, owners, delivery date, and checkpoint.",
        null,
        "EXTERNAL_SHAREABLE",
      ],
      [
        "agenda-coinbase-2x2",
        "cadence-coinbase-2x2",
        "CROSS_FUNCTIONAL_COORDINATION",
        100,
        "Resolve Coinbase intervention plan",
        "Commercial and technical risk remain unresolved after the AE–SE sync.",
        "Assign functional commitments and define escalation condition.",
        "Approve executive re-engagement plan",
        "INTERNAL_ONLY",
      ],
      [
        "agenda-coinbase-1x1-follow-up",
        "cadence-mark-sarah-next",
        "INTERVENTION_FOLLOW_UP",
        100,
        "Coinbase intervention follow-up",
        "The prior manager decision and security commitments remain unresolved.",
        "Review prior commitments, current risk, and whether the 2x2 improved the Twin.",
        "Decide whether VP escalation should proceed",
        "INTERNAL_ONLY",
      ],
      [
        "agenda-anita-raj-workload",
        "cadence-anita-raj-next",
        "TECHNICAL_WORKLOAD",
        95,
        "Coinbase security commitment is overdue",
        "The architecture response remains open while Raj supports multiple technical workstreams.",
        "Review workload, unblock evidence collection, and confirm the technical owner.",
        "Decide whether additional technical capacity is required",
        "INTERNAL_ONLY",
      ],
      [
        "agenda-ae-se-next-security",
        "cadence-coinbase-ae-se-next",
        "TECHNICAL_BLOCKER",
        100,
        "Close the security-response gap",
        "The customer checkpoint is approaching and the prior deliverable slipped.",
        "Reconcile open requirements, response evidence, owners, and dates.",
        "Commit to the response delivery date",
        "INTERNAL_ONLY",
      ],
      [
        "agenda-ae-sdr-executive",
        "cadence-coinbase-ae-sdr",
        "STAKEHOLDER_COVERAGE",
        88,
        "Executive engagement is declining",
        "Recent engagement signals show a 42% decline and missing executive response.",
        "Review target personas, outreach evidence, and the handoff plan.",
        "Choose the next executive outreach path",
        "INTERNAL_ONLY",
      ],
      [
        "agenda-ae-partner-marketplace",
        "cadence-coinbase-ae-partner",
        "PARTNER_INTERVENTION",
        82,
        "Activate the co-sell path",
        "Partner coverage exists but the marketplace and introduction milestones are not dated.",
        "Confirm partner influence, introduction owner, and joint execution milestone.",
        "Assign the partner introduction commitment",
        "INTERNAL_ONLY",
      ],
      [
        "agenda-security-next-requirements",
        "cadence-coinbase-security-next",
        "SECURITY_CHECKPOINT",
        100,
        "Confirm open security requirements",
        "The prior checkpoint produced an overdue seller response and pending customer feedback.",
        "Review only mutually shareable requirements, owners, and dates.",
        "Agree the next checkpoint and acceptance criteria",
        "EXTERNAL_SHAREABLE",
      ],
      [
        "agenda-paypal-manager-next",
        "cadence-paypal-mark-daniel-next",
        "OPPORTUNITY_PROGRESSION",
        86,
        "Turn PayPal expansion interest into a dated next step",
        "The expansion signal is strong, but human commitments and a discovery milestone need alignment.",
        "Review buyer evidence, next-step quality, and the owner for discovery preparation.",
        "Agree the next customer milestone and owner",
        "INTERNAL_ONLY",
      ],
      [
        "agenda-nvidia-manager-next",
        "cadence-nvidia-olivia-priya-next",
        "EXECUTIVE_ENGAGEMENT",
        90,
        "Prepare the NVIDIA executive briefing",
        "The global rollout can accelerate if the executive discussion produces a clear decision path.",
        "Review stakeholder context, unresolved commitments, and the desired meeting outcome.",
        "Confirm briefing owner and follow-up commitments",
        "INTERNAL_ONLY",
      ],
      [
        "agenda-strategic-team-next",
        "cadence-coinbase-strategic-team-next",
        "CROSS_FUNCTIONAL_COORDINATION",
        96,
        "Align the complete Coinbase revenue team",
        "Security, value, customer success, services, commercial, and engagement workstreams must converge on one plan.",
        "Review each function's evidence, blockers, and next commitment.",
        "Assign functional owners and dated outcomes",
        "INTERNAL_ONLY",
      ],
      [
        "agenda-executive-team-next",
        "cadence-coinbase-executive-next",
        "EXECUTIVE_ESCALATION",
        94,
        "Plan customer executive re-engagement",
        "Executive engagement is declining while the strategic renewal remains exposed.",
        "Align the executive message, technical posture, and escalation boundaries.",
        "Approve an executive re-engagement plan",
        "INTERNAL_ONLY",
      ],
    ];
    for (const row of agenda)
      await client.query(
        `INSERT INTO cadence_agenda_items(id,organization_id,cadence_session_id,type,priority,title,rationale,recommended_discussion,recommended_decision,status,visibility,created_at,updated_at) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,'PROPOSED',$10,$11,$11) ON CONFLICT(id) DO UPDATE SET rationale=excluded.rationale,updated_at=excluded.updated_at`,
        [row[0], organizationId, ...row.slice(1), now],
      );
    const commitments = [
      [
        "commitment-coinbase-security-response",
        "cadence-coinbase-ae-se",
        se,
        "Updated security architecture response",
        "2026-08-11T17:00:00Z",
        "OPEN",
        "Unblock customer security review",
        "INTERNAL_ONLY",
        "HIGH",
      ],
      [
        "commitment-coinbase-exec-plan",
        "cadence-mark-sarah-prior",
        seller,
        "Prepare evidence-based executive re-engagement plan",
        "2026-08-13T17:00:00Z",
        "OPEN",
        "Secure executive sponsor meeting",
        "INTERNAL_ONLY",
        "HIGH",
      ],
      [
        "commitment-coinbase-customer-feedback",
        "cadence-coinbase-security",
        null,
        "Customer security team returns consolidated feedback",
        "2026-08-18T17:00:00Z",
        "OPEN",
        "Confirm remaining security requirements",
        "EXTERNAL_SHAREABLE",
        "HIGH",
      ],
      [
        "commitment-coinbase-sdr-executive-map",
        "cadence-coinbase-ae-sdr-prior",
        sdr,
        "Map two additional executive stakeholders and document response signals",
        "2026-08-19T17:00:00Z",
        "IN_PROGRESS",
        "Restore executive coverage for the renewal",
        "INTERNAL_ONLY",
        "MEDIUM",
      ],
      [
        "commitment-coinbase-partner-introduction",
        "cadence-coinbase-ae-partner-prior",
        partner,
        "Secure a partner executive introduction for Coinbase",
        "2026-08-20T17:00:00Z",
        "OPEN",
        "Create an additional executive engagement path",
        "INTERNAL_ONLY",
        "MEDIUM",
      ],
    ];
    for (const [
      id,
      cadence,
      owner,
      description,
      due,
      status,
      outcome,
      visibility,
      impact,
    ] of commitments)
      await client.query(
        `INSERT INTO commitments(id,organization_id,cadence_session_id,account_id,opportunity_id,owner_membership_id,description,due_at,status,expected_outcome,visibility,impact,created_at,updated_at) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$13) ON CONFLICT(id) DO UPDATE SET status=excluded.status,due_at=excluded.due_at,updated_at=excluded.updated_at`,
        [
          id,
          organizationId,
          cadence,
          accountId,
          opportunityId,
          owner,
          description,
          due,
          status,
          outcome,
          visibility,
          impact,
          now,
        ],
      );
    await client.query(
      `INSERT INTO cadence_blockers(id,organization_id,cadence_session_id,account_id,opportunity_id,type,severity,description,owner_membership_id,status,visibility,first_observed_at,created_at,updated_at) VALUES('blocker-coinbase-security',$1,'cadence-coinbase-security',$2,$3,'SECURITY','CRITICAL','Security architecture review remains unresolved',$4,'OPEN','EXTERNAL_SHAREABLE','2026-07-27T16:00:00Z',$5,$5) ON CONFLICT(id) DO UPDATE SET status=excluded.status,updated_at=excluded.updated_at`,
      [organizationId, accountId, opportunityId, se, now],
    );
    await client.query(
      `INSERT INTO manager_interventions(id,organization_id,manager_membership_id,seller_membership_id,account_id,opportunity_id,type,status,priority_score,severity,summary,rationale,evidence,recommended_action,created_at,updated_at) VALUES('intervention-coinbase-security',$1,$2,$3,$4,$5,'CROSS_FUNCTIONAL_COORDINATION','OPEN',95,'CRITICAL','Coinbase security review needs manager intervention','$22.4M renewal; security review stalled; two commitments slipping; executive engagement declining; renewal approaching',$6,'Initiate cross-functional 2x2',$7,$7) ON CONFLICT(id) DO UPDATE SET priority_score=excluded.priority_score,rationale=excluded.rationale,status='OPEN',updated_at=excluded.updated_at`,
      [
        organizationId,
        manager,
        seller,
        accountId,
        opportunityId,
        json([
          "$22.4M revenue exposure",
          "security blocker open 18 days",
          "2 commitments overdue",
          "executive engagement declining",
          "renewal within 45 days",
        ]),
        now,
      ],
    );
    await client.query(
      `DELETE FROM action_decisions WHERE organization_id=$1 AND id='decision-coinbase-2x2' AND type='CADENCE_RECOMMENDATION'`,
      [organizationId],
    );
    await client.query(
      `INSERT INTO escalations(id,organization_id,account_id,opportunity_id,cadence_session_id,type,severity,from_level,to_level,reason,evidence,status,created_at) VALUES('escalation-coinbase-vp-eligible',$1,$2,$3,'cadence-coinbase-2x2','UNRESOLVED_STRATEGIC_RISK','HIGH','CROSS_FUNCTIONAL','VP','Security blocker remains unresolved after seller, manager, and cross-functional intervention',$4,'ELIGIBLE',$5) ON CONFLICT(organization_id,opportunity_id,to_level,type) WHERE opportunity_id IS NOT NULL AND status IN('ELIGIBLE','PENDING','ACKNOWLEDGED') DO UPDATE SET status=excluded.status,evidence=excluded.evidence`,
      [
        organizationId,
        accountId,
        opportunityId,
        json([
          "$22.4M renewal",
          "blocker open 21 days",
          "2 missed commitments",
          "manager intervention completed",
          "2x2 prepared",
        ]),
        now,
      ],
    );
    await client.query(
      `INSERT INTO revenue_digital_twin_events(id,organization_id,revenue_digital_twin_id,actor_membership_id,event_type,payload,occurred_at,created_at) SELECT 'twin-event-coinbase-commitment-slipped',$1,id,$2,'COMMITMENT_MISSED',$3,'2026-08-14T16:00:00Z',$4 FROM revenue_digital_twins WHERE organization_id=$1 AND account_id=$5 ON CONFLICT(id) DO NOTHING`,
      [
        organizationId,
        se,
        json({
          commitmentId: "commitment-coinbase-security-response",
          daysOverdue: 3,
        }),
        now,
        accountId,
      ],
    );
  }

  async function seedLeadership(client: PoolClient) {
    const organizationId = "org-cognivit-demo";
    await client.query(
      `UPDATE opportunities SET owner_membership_id=CASE id
        WHEN 'opp-pp' THEN 'membership-org-cognivit-demo-user-ae-daniel'
        WHEN 'opp-nv' THEN 'membership-org-cognivit-demo-user-ae-priya'
        WHEN 'opp-ft' THEN 'membership-org-cognivit-demo-user-ae-sarah'
        WHEN 'opp-sf' THEN 'membership-org-cognivit-demo-user-ae-priya'
        ELSE owner_membership_id END,
        seller_forecast_category=CASE id WHEN 'opp-coinbase-renewal' THEN 'COMMIT' WHEN 'opp-pp' THEN 'BEST_CASE' WHEN 'opp-nv' THEN 'COMMIT' WHEN 'opp-ft' THEN 'COMMIT' WHEN 'opp-sf' THEN 'BEST_CASE' ELSE seller_forecast_category END,
        manager_forecast_category=CASE id WHEN 'opp-coinbase-renewal' THEN 'COMMIT' WHEN 'opp-pp' THEN 'BEST_CASE' WHEN 'opp-nv' THEN 'BEST_CASE' WHEN 'opp-ft' THEN 'BEST_CASE' WHEN 'opp-sf' THEN 'PIPELINE' ELSE manager_forecast_category END,
        forecast_updated_at=$2
       WHERE organization_id=$1 AND id IN('opp-coinbase-renewal','opp-pp','opp-nv','opp-ft','opp-sf')`,
      [organizationId, now],
    );
    for (const blocker of [
      [
        "blocker-paypal-security-pattern",
        "acct-paypal",
        "opp-pp",
        "SECURITY",
        "HIGH",
        "PayPal security evidence review is delaying discovery confirmation",
        "2026-08-02T16:00:00Z",
      ],
      [
        "blocker-franklin-procurement-pattern",
        "acct-franklin",
        "opp-ft",
        "PROCUREMENT",
        "HIGH",
        "Franklin procurement and legal milestones remain behind plan",
        "2026-07-30T16:00:00Z",
      ],
    ])
      await client.query(
        `INSERT INTO cadence_blockers(id,organization_id,account_id,opportunity_id,type,severity,description,status,visibility,first_observed_at,created_at,updated_at) VALUES($1,$2,$3,$4,$5,$6,$7,'OPEN','INTERNAL_ONLY',$8,$9,$9) ON CONFLICT(id) DO UPDATE SET status='OPEN',description=excluded.description,updated_at=excluded.updated_at`,
        [blocker[0], organizationId, ...blocker.slice(1), now],
      );

    const assessments = [
      [
        "forecast-coinbase-initial",
        "opp-coinbase-renewal",
        "COMMIT",
        "COMMIT",
        "LIKELY",
        82,
        "HIGH",
        24,
        "Coinbase renewal intent and usage supported a moderately healthy commit.",
        ["Strong product usage", "Customer renewal intent positive"],
        ["Security review recently opened"],
        [],
        ["Initial evidence baseline"],
        [],
        null,
        "2026-08-01T16:00:00Z",
      ],
      [
        "forecast-coinbase-current",
        "opp-coinbase-renewal",
        "COMMIT",
        "COMMIT",
        "HIGH_RISK",
        67,
        "HIGH",
        61,
        "High-risk commit: lower-level interventions occurred, but security and executive-engagement risk remain unresolved.",
        ["Strong product usage", "Customer renewal intent remains positive"],
        [
          "Security review unresolved for 21 days",
          "2 material commitments missed or overdue",
          "Executive engagement declined",
          "RSM intervention and cross-functional review have not resolved risk",
        ],
        [],
        [
          "-15 probability points since the prior assessment",
          "Security review remains unresolved",
          "Commitment slippage increased",
          "Executive engagement weakened",
        ],
        [
          "SELLER_AROS_DISAGREEMENT",
          "MANAGER_AROS_DISAGREEMENT",
          "LARGE_PROBABILITY_DROP",
          "SECURITY_PROCUREMENT_RISK",
          "COMMITMENT_RISK",
          "EXECUTIVE_ENGAGEMENT_RISK",
        ],
        "forecast-coinbase-initial",
        "2026-08-17T16:00:00Z",
      ],
      [
        "forecast-paypal-current",
        "opp-pp",
        "BEST_CASE",
        "BEST_CASE",
        "AT_RISK",
        71,
        "MEDIUM",
        38,
        "PayPal expansion has positive executive interest, with security timing still unconfirmed.",
        ["Economic buyer requested executive value alignment"],
        ["Security evidence review remains open"],
        ["Customer-confirmed security date"],
        ["Security review is associated with timing uncertainty"],
        ["SECURITY_PROCUREMENT_RISK"],
        null,
        "2026-08-17T16:05:00Z",
      ],
      [
        "forecast-nvidia-current",
        "opp-nv",
        "COMMIT",
        "BEST_CASE",
        "LIKELY",
        88,
        "HIGH",
        16,
        "NVIDIA usage expansion and executive engagement support upside.",
        ["Usage expanded", "Executive briefing scheduled"],
        [],
        [],
        ["Adoption strengthened the rollout evidence"],
        ["SELLER_MANAGER_DISAGREEMENT"],
        null,
        "2026-08-17T16:10:00Z",
      ],
      [
        "forecast-franklin-current",
        "opp-ft",
        "COMMIT",
        "BEST_CASE",
        "HIGH_RISK",
        52,
        "HIGH",
        67,
        "Franklin is high risk because procurement, qualification, and relationship evidence remain weak.",
        [],
        [
          "Procurement and legal milestones delayed",
          "Champion engagement weakened",
          "MEDDPICC evidence incomplete",
        ],
        [],
        ["Procurement and relationship risk increased"],
        [
          "SELLER_MANAGER_DISAGREEMENT",
          "SELLER_AROS_DISAGREEMENT",
          "MANAGER_AROS_DISAGREEMENT",
          "SECURITY_PROCUREMENT_RISK",
          "METHODOLOGY_RISK",
        ],
        null,
        "2026-08-17T16:15:00Z",
      ],
      [
        "forecast-snowflake-current",
        "opp-sf",
        "BEST_CASE",
        "PIPELINE",
        "AT_RISK",
        58,
        "MEDIUM",
        51,
        "Snowflake timing moved while economic-buyer evidence remains missing.",
        [],
        ["Close date moved", "Budget timing uncertain"],
        ["Economic buyer confirmation"],
        ["Budget timing reduced confidence"],
        ["SELLER_MANAGER_DISAGREEMENT", "LATE_STAGE_EVIDENCE_GAP"],
        null,
        "2026-08-17T16:20:00Z",
      ],
    ] as const;
    for (const assessment of assessments) {
      const [
        id,
        opportunityId,
        seller,
        manager,
        aros,
        probability,
        confidence,
        risk,
        rationale,
        positive,
        negative,
        missing,
        drivers,
        discrepancies,
        previous,
        createdAt,
      ] = assessment;
      await client.query(
        `INSERT INTO forecast_assessments(id,organization_id,opportunity_id,seller_category,manager_category,aros_category,probability,confidence,risk_score,upside_score,rationale,positive_evidence,negative_evidence,missing_evidence,change_drivers,evidence_snapshot,discrepancy_types,previous_assessment_id,created_at,updated_at) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$19) ON CONFLICT(id) DO UPDATE SET seller_category=excluded.seller_category,manager_category=excluded.manager_category,aros_category=excluded.aros_category,probability=excluded.probability,confidence=excluded.confidence,risk_score=excluded.risk_score,rationale=excluded.rationale,positive_evidence=excluded.positive_evidence,negative_evidence=excluded.negative_evidence,missing_evidence=excluded.missing_evidence,change_drivers=excluded.change_drivers,evidence_snapshot=excluded.evidence_snapshot,discrepancy_types=excluded.discrepancy_types,updated_at=excluded.updated_at`,
        [
          id,
          organizationId,
          opportunityId,
          seller,
          manager,
          aros,
          probability,
          confidence,
          risk,
          Math.max(0, probability - 35),
          rationale,
          json(positive),
          json(negative),
          json(missing),
          json(drivers),
          json({ source: "deterministic-demo", capturedAt: createdAt }),
          json(discrepancies),
          previous,
          createdAt,
        ],
      );
    }
    await client.query(
      `INSERT INTO leadership_interventions(id,organization_id,opportunity_id,escalation_id,assessment_id,level,type,status,priority_score,summary,rationale,evidence,recommended_action,expected_outcome,idempotency_key,created_at,updated_at) VALUES('leadership-intervention-coinbase-vp',$1,'opp-coinbase-renewal','escalation-coinbase-vp-eligible','forecast-coinbase-current','VP','EXECUTIVE_ENGAGEMENT','ELIGIBLE',96,'Coinbase requires VP technical-executive engagement','Seller and manager remain at COMMIT while evidence deteriorated after manager and cross-functional intervention',$2,'Engage customer technical leadership with David Lee','Restore executive alignment and unblock the security decision','demo-coinbase-vp-intervention',$3,$3) ON CONFLICT(id) DO UPDATE SET status=CASE WHEN leadership_interventions.status IN('APPROVED','ACTIONED','MONITORING','RESOLVED') THEN leadership_interventions.status ELSE 'ELIGIBLE' END,priority_score=excluded.priority_score,rationale=excluded.rationale,evidence=excluded.evidence,updated_at=excluded.updated_at`,
      [
        organizationId,
        json([
          "$22.4M exposure",
          "-15 probability points",
          "security blocker open 21 days",
          "2 commitments missed",
          "RSM intervention attempted",
          "cross-functional 2x2 attempted",
        ]),
        now,
      ],
    );
    await client.query(
      `INSERT INTO action_decisions(id,organization_id,account_id,opportunity_id,assigned_membership_id,type,recommendation,status,evidence,metadata,idempotency_key,created_at,updated_at) VALUES('decision-leadership-coinbase-vp',$1,'acct-coinbase','opp-coinbase-renewal','membership-org-cognivit-demo-user-vp-jennifer','LEADERSHIP_INTERVENTION','Approve VP technical-executive engagement for Coinbase','PENDING',$2,$3,'decision-leadership-coinbase-vp',$4,$4) ON CONFLICT(id) DO UPDATE SET recommendation=excluded.recommendation,evidence=excluded.evidence,metadata=excluded.metadata,status=CASE WHEN action_decisions.status='APPROVED' THEN 'APPROVED' ELSE 'PENDING' END,updated_at=excluded.updated_at`,
      [
        organizationId,
        json(["forecast-coinbase-current", "escalation-coinbase-vp-eligible"]),
        json({
          leadershipInterventionId: "leadership-intervention-coinbase-vp",
          priorityScore: 96,
          level: "VP",
        }),
        now,
      ],
    );
    for (const [id, opportunityId, eventType, payload] of [
      [
        "twin-event-forecast-coinbase-initial",
        "opp-coinbase-renewal",
        "FORECAST_ASSESSMENT_CREATED",
        { assessmentId: "forecast-coinbase-initial", probability: 82 },
      ],
      [
        "twin-event-forecast-coinbase-current",
        "opp-coinbase-renewal",
        "FORECAST_ASSESSMENT_CHANGED",
        {
          assessmentId: "forecast-coinbase-current",
          probability: 67,
          previousProbability: 82,
        },
      ],
      [
        "twin-event-leadership-coinbase-recommended",
        "opp-coinbase-renewal",
        "LEADERSHIP_INTERVENTION_RECOMMENDED",
        { interventionId: "leadership-intervention-coinbase-vp" },
      ],
    ] as const)
      await client.query(
        `INSERT INTO revenue_digital_twin_events(id,organization_id,revenue_digital_twin_id,event_type,payload,occurred_at) SELECT $1,$2,t.id,$4,$5,$6 FROM opportunities o JOIN revenue_digital_twins t ON(t.organization_id=o.organization_id AND t.account_id=o.account_id) WHERE o.organization_id=$2 AND o.id=$3 ON CONFLICT(id) DO NOTHING`,
        [id, organizationId, opportunityId, eventType, json(payload), now],
      );
  }

  async function ensureTenant(
    client: PoolClient,
    id: string,
    name: string,
    slug: string,
  ) {
    await client.query(
      `INSERT INTO organizations(id,name,slug,status,environment,timezone,created_at,updated_at) VALUES($1,$2,$3,'ACTIVE','SANDBOX','America/Los_Angeles',$4,$4) ON CONFLICT(id) DO NOTHING`,
      [id, name, slug, now],
    );
    const uid = `user-${slug}`,
      mid = `membership-${slug}`;
    await client.query(
      `INSERT INTO users(id,organization_id,email,first_name,last_name,display_name,role,status,is_demo_user,is_admin,password_hash,created_at,updated_at) VALUES($1,$2,$3,'Design','Partner',$4,'AE','ACTIVE',false,true,$5,$6,$6) ON CONFLICT(id) DO NOTHING`,
      [
        uid,
        id,
        `owner@${slug}.example`,
        `${name} Owner`,
        createHash("sha256").update("ArosDemo!2026").digest("hex"),
        now,
      ],
    );
    await client.query(
      `INSERT INTO organization_memberships(id,organization_id,user_id,admin_role,status,joined_at,created_at,updated_at) VALUES($1,$2,$3,'ORG_OWNER','ACTIVE',$4,$4,$4) ON CONFLICT(id) DO NOTHING`,
      [mid, id, uid, now],
    );
    return mid;
  }

  async function seedRevenue(client: PoolClient) {
    for (const account of syntheticAccounts)
      await client.query(
        `INSERT INTO accounts(id,organization_id,external_id,name,segment,status,created_at,updated_at) VALUES($1,'org-cognivit-demo',$1,$2,$3,$4,$5,$5) ON CONFLICT(id) DO UPDATE SET name=excluded.name,updated_at=excluded.updated_at`,
        [
          account.id,
          account.name,
          account.segment,
          account.accountStatus.toUpperCase(),
          now,
        ],
      );
    for (const twin of accountDigitalTwins) {
      const summary = twin as typeof twin & {
          healthScore?: number;
          riskLevel?: string;
        },
        renewalWorkspace =
          twin.accountId === "acct-coinbase"
            ? createCoinbaseRenewalWorkspaceFixture()
            : undefined;
      await client.query(
        `INSERT INTO revenue_digital_twins(id,organization_id,account_id,health_state,risk_state,lifecycle_state,state,created_at,updated_at) VALUES($1,'org-cognivit-demo',$2,$3,$4,'ACTIVE',$5,$6,$6) ON CONFLICT(organization_id,account_id) DO UPDATE SET state=excluded.state,health_state=excluded.health_state,risk_state=excluded.risk_state,updated_at=excluded.updated_at`,
        [
          `twin-${twin.accountId}`,
          twin.accountId,
          String(summary.healthScore ?? "UNKNOWN"),
          String(summary.riskLevel ?? "UNKNOWN"),
          json({ ...twin, renewalWorkspace }),
          now,
        ],
      );
      for (const stakeholder of twin.stakeholders)
        await client.query(
          `INSERT INTO revenue_stakeholders(id,organization_id,account_id,name,title,department,seniority,buying_role,influence_level,support_level,relationship_strength,engagement_trend,sentiment,last_interaction_at,attributes,updated_at) VALUES($1,'org-cognivit-demo',$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15) ON CONFLICT(id) DO UPDATE SET name=excluded.name,attributes=excluded.attributes,updated_at=excluded.updated_at`,
          [
            stakeholder.id,
            twin.accountId,
            stakeholder.name,
            stakeholder.title,
            stakeholder.department,
            stakeholder.seniority,
            stakeholder.roleInBuyingProcess,
            stakeholder.influenceLevel,
            stakeholder.supportLevel,
            stakeholder.relationshipStrength,
            stakeholder.engagementTrend,
            stakeholder.sentiment,
            stakeholder.lastInteractionAt,
            json({
              isChampion: stakeholder.isChampion,
              isEconomicBuyer: stakeholder.isEconomicBuyer,
              isExecutiveSponsor: stakeholder.isExecutiveSponsor,
              isBlocker: stakeholder.isBlocker,
              sourceIds: stakeholder.sourceIds,
              notes: stakeholder.notes,
            }),
            now,
          ],
        );
      await client.query(
        `INSERT INTO methodology_states(id,organization_id,account_id,methodology,completeness_score,state,updated_at) VALUES($1,'org-cognivit-demo',$2,'MEDDPICC',$3,$4,$5) ON CONFLICT(organization_id,account_id,methodology) DO UPDATE SET completeness_score=excluded.completeness_score,state=excluded.state,updated_at=excluded.updated_at`,
        [
          `methodology-${twin.accountId}`,
          twin.accountId,
          twin.meddpicc.completenessScore,
          json(twin.meddpicc),
          now,
        ],
      );
      for (const event of twin.fullTimeline)
        await client.query(
          `INSERT INTO revenue_digital_twin_events(id,organization_id,revenue_digital_twin_id,event_type,payload,occurred_at,created_at) VALUES($1,'org-cognivit-demo',$2,$3,$4,$5,$6) ON CONFLICT(id) DO NOTHING`,
          [
            event.id,
            `twin-${twin.accountId}`,
            event.type,
            json(event),
            event.occurredAt,
            now,
          ],
        );
    }
    for (const twin of accountDigitalTwins) {
      for (const opportunity of twin.opportunities)
        await client.query(
          `INSERT INTO opportunities(id,organization_id,account_id,external_id,name,stage,amount,currency,close_date,status,created_at,updated_at) VALUES($1,'org-cognivit-demo',$2,$1,$3,$4,$5,$6,$7,'OPEN',$8,$8) ON CONFLICT(id) DO UPDATE SET stage=excluded.stage,amount=excluded.amount,close_date=excluded.close_date,updated_at=excluded.updated_at`,
          [
            opportunity.id,
            twin.accountId,
            opportunity.name,
            opportunity.stage,
            opportunity.amount,
            opportunity.currency,
            opportunity.closeDate,
            now,
          ],
        );
      for (const [index, risk] of twin.knownRisks.entries())
        await client.query(
          `INSERT INTO revenue_signals(id,organization_id,account_id,type,source,severity,confidence,payload,observed_at,created_at) VALUES($1,'org-cognivit-demo',$2,'ACCOUNT_RISK','deterministic-seed','HIGH',0.9,$3,$4,$4) ON CONFLICT(id) DO UPDATE SET payload=excluded.payload,observed_at=excluded.observed_at`,
          [
            `signal-${twin.accountId}-risk-${index}`,
            twin.accountId,
            json({ risk }),
            now,
          ],
        );
    }
    for (const decision of governedDecisions)
      await client.query(
        `INSERT INTO action_decisions(id,organization_id,account_id,type,recommendation,status,evidence,metadata,idempotency_key,created_at,updated_at) VALUES($1,'org-cognivit-demo',$2,$3,$4,'PENDING',$5,$6,$1,$7,$7) ON CONFLICT(id) DO UPDATE SET recommendation=excluded.recommendation,metadata=excluded.metadata`,
        [
          decision.id,
          decision.accountId,
          decision.type,
          decision.recommendedAction,
          json(decision.evidence),
          json(decision),
          now,
        ],
      );
    await client.query(
      `INSERT INTO opportunities(id,organization_id,account_id,external_id,name,stage,amount,currency,close_date,status,owner_membership_id,created_at,updated_at) VALUES('opp-coinbase-renewal','org-cognivit-demo','acct-coinbase','opp-coinbase-renewal','Coinbase Renewal','Security Review',22400000,'USD','2026-10-15','OPEN','membership-org-cognivit-demo-user-ae-sarah',$1,$1) ON CONFLICT(id) DO UPDATE SET name=excluded.name,stage=excluded.stage,amount=excluded.amount,close_date=excluded.close_date,owner_membership_id=excluded.owner_membership_id,updated_at=excluded.updated_at`,
      [now],
    );
    const acmeMember = await ensureTenant(
        client,
        "org-acme",
        "Acme Software",
        "acme-software",
      ),
      globexMember = await ensureTenant(
        client,
        "org-globex",
        "Globex Technologies",
        "globex-technologies",
      );
    for (const [org, id, name, member] of [
      ["org-acme", "acct-acme", "Acme Design Account", acmeMember],
      ["org-globex", "acct-globex", "Globex Design Account", globexMember],
    ] as const) {
      await client.query(
        `INSERT INTO accounts(id,organization_id,external_id,name,status,created_at,updated_at) VALUES($1,$2,$1,$3,'ACTIVE',$4,$4) ON CONFLICT(id) DO NOTHING`,
        [id, org, name, now],
      );
      await client.query(
        `INSERT INTO opportunities(id,organization_id,account_id,name,status,owner_membership_id,created_at,updated_at) VALUES($1,$2,$3,$4,'OPEN',$5,$6,$6) ON CONFLICT(id) DO NOTHING`,
        [`opp-${id}`, org, id, `${name} Opportunity`, member, now],
      );
      await client.query(
        `INSERT INTO revenue_digital_twins(id,organization_id,account_id,lifecycle_state,state,created_at,updated_at) VALUES($1,$2,$3,'ACTIVE',$4,$5,$5) ON CONFLICT(id) DO NOTHING`,
        [
          `twin-${id}`,
          org,
          id,
          json({ accountId: id, accountName: name }),
          now,
        ],
      );
      await client.query(
        `INSERT INTO revenue_signals(id,organization_id,account_id,type,source,severity,confidence,payload,observed_at,created_at) VALUES($1,$2,$3,'ACCOUNT_HEALTH','deterministic-seed','MEDIUM',0.8,'{}',$4,$4) ON CONFLICT(id) DO NOTHING`,
        [`signal-${id}`, org, id, now],
      );
      await client.query(
        `INSERT INTO action_decisions(id,organization_id,account_id,type,recommendation,status,idempotency_key,created_at,updated_at) VALUES($1,$2,$3,'FOLLOW_UP','Review account context','PENDING',$1,$4,$4) ON CONFLICT(id) DO NOTHING`,
        [`action-${id}`, org, id, now],
      );
    }
    await client.query(
      `INSERT INTO accounts(id,organization_id,external_id,name,status,created_at,updated_at) VALUES('acct-other-tenant','org-isolation-test','acct-other-tenant','Isolation Account','ACTIVE',$1,$1) ON CONFLICT(id) DO NOTHING`,
      [now],
    );
    for (const assignment of store.revenueTeamAssignments)
      await client.query(
        `INSERT INTO revenue_team_assignments(id,organization_id,account_id,opportunity_id,membership_id,organization_role_definition_id,participation_type,is_primary_owner,created_at,updated_at) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$9) ON CONFLICT(id) DO UPDATE SET participation_type=excluded.participation_type,is_primary_owner=excluded.is_primary_owner,updated_at=excluded.updated_at`,
        [
          assignment.id,
          assignment.organizationId,
          assignment.accountId,
          assignment.opportunityId,
          assignment.membershipId,
          assignment.organizationRoleDefinitionId,
          assignment.participationType,
          assignment.isPrimaryOwner,
          assignment.createdAt,
        ],
      );
  }

  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    await seedIdentity(client);
    await seedRevenue(client);
    await seedCadence(client);
    await seedLeadership(client);
    await client.query("COMMIT");
    console.log(
      "Seeded relational identity and deterministic revenue tenants.",
    );
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
    await pool.end();
  }
}
main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
