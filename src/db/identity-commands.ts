import { createHash, randomBytes, randomUUID } from "node:crypto";
import { Pool, type PoolClient } from "pg";
import { hashPassword } from "@/auth/password";
import { managerSemanticRoles } from "@/auth/user-administration";
import {
  defaultRoleNames,
  systemRoleTemplates,
} from "@/auth/system-role-templates";
import {
  participationTypes,
  type AdminRole,
  type OrganizationEnvironment,
  type User,
} from "@/auth/types";
import { cadenceTemplateTypes } from "@/cadence/domain";
export class ConcurrencyConflictError extends Error {
  code = "CONCURRENCY_CONFLICT" as const;
  constructor() {
    super("This record changed since you opened it. Refresh and try again.");
  }
}
export class CommandConflictError extends Error {
  code = "COMMAND_CONFLICT" as const;
}
export type FailureStage =
  | "organization"
  | "membership"
  | "roles"
  | "user"
  | "role-assignment"
  | "unit-assignment"
  | "relationship"
  | "invitation"
  | "audit";
const json = (v: unknown) => JSON.stringify(v ?? null),
  retryable = (e: unknown) =>
    Boolean(
      e &&
      typeof e === "object" &&
      "code" in e &&
      ["40001", "40P01"].includes(String((e as { code: string }).code)),
    );
export interface CommandAudit {
  actor: User;
  organizationId: string | null;
  event: string;
  resourceType: string;
  resourceId: string;
  payload?: Record<string, unknown>;
  before?: Record<string, unknown>;
  after?: Record<string, unknown>;
}
export class IdentityCommandRepository {
  private pool: Pool;
  constructor(connectionString: string) {
    this.pool = new Pool({
      connectionString,
      max: Number(process.env.DATABASE_POOL_MAX ?? 5),
    });
  }
  async close() {
    await this.pool.end();
  }
  private async tx<T>(
    work: (c: PoolClient) => Promise<T>,
    serializable = false,
  ) {
    for (let attempt = 0; attempt < 3; attempt++) {
      const c = await this.pool.connect();
      try {
        await c.query("BEGIN");
        if (serializable)
          await c.query("SET TRANSACTION ISOLATION LEVEL SERIALIZABLE");
        const value = await work(c);
        await c.query("COMMIT");
        return value;
      } catch (e) {
        await c.query("ROLLBACK");
        if (retryable(e) && attempt < 2) continue;
        throw e;
      } finally {
        c.release();
      }
    }
    throw new Error("transaction retry exhausted");
  }
  private async audit(c: PoolClient, a: CommandAudit) {
    const membership = a.organizationId
      ? (
          await c.query(
            `SELECT admin_role FROM organization_memberships WHERE organization_id=$1 AND user_id=$2`,
            [a.organizationId, a.actor.id],
          )
        ).rows[0]
      : undefined;
    await c.query(
      `INSERT INTO security_audit_events(id,organization_id,actor_user_id,actor_role,actor_admin_role,actor_platform_role,event,resource_type,resource_id,timestamp,payload,before_state,after_state) VALUES($1,$2,$3,NULL,$4,$5,$6,$7,$8,now(),$9,$10,$11)`,
      [
        randomUUID(),
        a.organizationId,
        a.actor.id,
        membership?.admin_role ?? null,
        a.actor.platformRole,
        a.event,
        a.resourceType,
        a.resourceId,
        json(a.payload),
        json(a.before),
        json(a.after),
      ],
    );
  }
  async createRole(input: {
    organizationId: string;
    name: string;
    code: string;
    category: string;
    description: string | null;
    systemTemplateId: string | null;
    defaultExperienceKey: string | null;
    permissions: string[];
    audit: CommandAudit;
  }) {
    return this.tx(async (c) => {
      const id = randomUUID();
      await c.query(
        `INSERT INTO organization_role_definitions(id,organization_id,name,code,system_template_id,category,description,default_experience_key,permissions,is_system_seeded,is_active,created_at,updated_at) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,false,true,now(),now())`,
        [
          id,
          input.organizationId,
          input.name,
          input.code,
          input.systemTemplateId,
          input.category,
          input.description,
          input.defaultExperienceKey,
          json(input.permissions),
        ],
      );
      await this.audit(c, { ...input.audit, resourceId: id });
      return { id };
    });
  }
  async assignRole(input: {
    organizationId: string;
    membershipId: string;
    roleId: string;
    isPrimary: boolean;
    audit: CommandAudit;
  }) {
    if (input.isPrimary) return this.setPrimaryRole(input);
    return this.tx(async (c) => {
      await c.query(
        `SELECT id FROM organization_memberships WHERE organization_id=$1 AND id=$2 FOR UPDATE`,
        [input.organizationId, input.membershipId],
      );
      const id = randomUUID();
      await c.query(
        `INSERT INTO membership_role_assignments(id,organization_id,membership_id,organization_role_definition_id,is_primary,effective_from,created_at,updated_at) VALUES($1,$2,$3,$4,false,now(),now(),now()) ON CONFLICT DO NOTHING`,
        [id, input.organizationId, input.membershipId, input.roleId],
      );
      await this.audit(c, { ...input.audit, resourceId: id });
      return { id };
    });
  }
  async removeRole(input: {
    organizationId: string;
    assignmentId: string;
    audit: CommandAudit;
  }) {
    return this.tx(async (c) => {
      const row = (
        await c.query(
          `UPDATE membership_role_assignments SET effective_to=now(),is_primary=false,updated_at=now() WHERE organization_id=$1 AND id=$2 AND effective_to IS NULL RETURNING id`,
          [input.organizationId, input.assignmentId],
        )
      ).rows[0];
      if (!row) throw new CommandConflictError("Role assignment not found.");
      await this.audit(c, input.audit);
      return { id: row.id };
    });
  }
  async createUnit(input: {
    organizationId: string;
    name: string;
    type: string;
    parentUnitId: string | null;
    leaderMembershipId: string | null;
    audit: CommandAudit;
  }) {
    return this.tx(async (c) => {
      const id = randomUUID();
      await c.query(
        `INSERT INTO organizational_units(id,organization_id,name,type,parent_unit_id,leader_membership_id,status,created_at,updated_at) VALUES($1,$2,$3,$4,$5,$6,'ACTIVE',now(),now())`,
        [
          id,
          input.organizationId,
          input.name,
          input.type,
          input.parentUnitId,
          input.leaderMembershipId,
        ],
      );
      await this.audit(c, { ...input.audit, resourceId: id });
      return { id };
    });
  }
  async updateUnit(input: {
    organizationId: string;
    unitId: string;
    name: string;
    parentUnitId: string | null;
    leaderMembershipId: string | null;
    status: string;
    audit: CommandAudit;
  }) {
    return this.tx(async (c) => {
      await c.query(`SELECT pg_advisory_xact_lock(hashtext($1))`, [
        `units:${input.organizationId}`,
      ]);
      if (input.parentUnitId === input.unitId)
        throw new CommandConflictError(
          "An organizational unit cannot contain itself.",
        );
      if (input.parentUnitId) {
        const cycle = await c.query(
          `WITH RECURSIVE descendants(id) AS (SELECT $2::text UNION SELECT u.id FROM organizational_units u JOIN descendants d ON u.parent_unit_id=d.id WHERE u.organization_id=$1) SELECT 1 FROM descendants WHERE id=$3`,
          [input.organizationId, input.unitId, input.parentUnitId],
        );
        if (cycle.rowCount)
          throw new CommandConflictError(
            "That organizational unit move would create a cycle.",
          );
      }
      const row = (
        await c.query(
          `UPDATE organizational_units SET name=$3,parent_unit_id=$4,leader_membership_id=$5,status=$6,version=version+1,updated_at=now() WHERE organization_id=$1 AND id=$2 RETURNING id`,
          [
            input.organizationId,
            input.unitId,
            input.name,
            input.parentUnitId,
            input.leaderMembershipId,
            input.status,
          ],
        )
      ).rows[0];
      if (!row)
        throw new CommandConflictError("Organizational unit not found.");
      await this.audit(c, input.audit);
      return { id: row.id };
    });
  }
  async removeUnitAssignment(input: {
    organizationId: string;
    assignmentId: string;
    audit: CommandAudit;
  }) {
    return this.tx(async (c) => {
      const row = (
        await c.query(
          `DELETE FROM membership_organizational_units WHERE organization_id=$1 AND id=$2 RETURNING id`,
          [input.organizationId, input.assignmentId],
        )
      ).rows[0];
      if (!row) throw new CommandConflictError("Unit assignment not found.");
      await this.audit(c, input.audit);
      return { id: row.id };
    });
  }
  async removeRelationship(input: {
    organizationId: string;
    relationshipId: string;
    audit: CommandAudit;
  }) {
    return this.tx(async (c) => {
      const row = (
        await c.query(
          `UPDATE organization_relationships SET effective_to=now(),is_primary=false,updated_at=now() WHERE organization_id=$1 AND id=$2 AND effective_to IS NULL RETURNING id`,
          [input.organizationId, input.relationshipId],
        )
      ).rows[0];
      if (!row) throw new CommandConflictError("Relationship not found.");
      await this.audit(c, input.audit);
      return { id: row.id };
    });
  }
  async createDottedLine(input: {
    organizationId: string;
    sourceMembershipId: string;
    targetMembershipId: string;
    audit: CommandAudit;
  }) {
    return this.tx(async (c) => {
      if (input.sourceMembershipId === input.targetMembershipId)
        throw new CommandConflictError("A person cannot report to themselves.");
      const id = randomUUID();
      await c.query(
        `INSERT INTO organization_relationships(id,organization_id,source_membership_id,target_membership_id,relationship_type,is_primary,effective_from,created_at,updated_at) VALUES($1,$2,$3,$4,'DOTTED_LINE_TO',false,now(),now(),now())`,
        [
          id,
          input.organizationId,
          input.sourceMembershipId,
          input.targetMembershipId,
        ],
      );
      await this.audit(c, { ...input.audit, resourceId: id });
      return { id };
    });
  }
  async createInvitation(input: {
    organizationId: string;
    actor: User;
    email: string;
    adminRole: AdminRole;
    roleAssignmentIds: string[];
    organizationalUnitIds: string[];
    primaryManagerMembershipId: string | null;
    dottedLineManagerMembershipIds: string[];
  }) {
    return this.tx(async (c) => {
      const token = randomBytes(32).toString("base64url"),
        id = randomUUID();
      await c.query(
        `INSERT INTO organization_invitations(id,organization_id,email,admin_role,configuration,token_hash,expires_at,invited_by_user_id,status,created_at) VALUES($1,$2,lower($3),$4,$5,$6,now()+interval '7 days',$7,'PENDING',now())`,
        [
          id,
          input.organizationId,
          input.email,
          input.adminRole,
          json({
            roleAssignmentIds: [...new Set(input.roleAssignmentIds)],
            organizationalUnitIds: [...new Set(input.organizationalUnitIds)],
            primaryManagerMembershipId: input.primaryManagerMembershipId,
            dottedLineManagerMembershipIds: [
              ...new Set(input.dottedLineManagerMembershipIds),
            ],
          }),
          createHash("sha256").update(token).digest("hex"),
          input.actor.id,
        ],
      );
      await this.audit(c, {
        actor: input.actor,
        organizationId: input.organizationId,
        event: "USER_INVITED",
        resourceType: "invitation",
        resourceId: id,
        payload: { email: input.email, adminRole: input.adminRole },
      });
      return { invitationId: id, token };
    });
  }
  async assignRevenueTeam(input: {
    organizationId: string;
    accountId: string | null;
    opportunityId: string | null;
    membershipId: string;
    roleId: string | null;
    participationType: string;
    isPrimaryOwner: boolean;
    audit: CommandAudit;
  }) {
    if (!participationTypes.includes(input.participationType as never))
      throw new CommandConflictError("Invalid participation type.");
    return this.tx(async (c) => {
      const id = randomUUID(),
        result = await c.query(
          `INSERT INTO revenue_team_assignments(id,organization_id,account_id,opportunity_id,membership_id,organization_role_definition_id,participation_type,is_primary_owner,created_at) VALUES($1,$2,$3,$4,$5,$6,$7,$8,now()) ON CONFLICT DO NOTHING RETURNING id`,
          [
            id,
            input.organizationId,
            input.accountId,
            input.opportunityId,
            input.membershipId,
            input.roleId,
            input.participationType,
            input.isPrimaryOwner,
          ],
        );
      if (!result.rows[0])
        throw new CommandConflictError(
          "This participation assignment already exists.",
        );
      await this.audit(c, { ...input.audit, resourceId: id });
      return { id };
    });
  }
  async createOrganizationUser(input: {
    organizationId: string;
    actor: User;
    email: string;
    firstName: string;
    lastName: string;
    password: string;
    roleCode: string;
    status: string;
    managerUserId: string | null;
    failAt?: FailureStage;
  }) {
    return this.tx(async (c) => {
      await c.query(`SELECT pg_advisory_xact_lock(hashtext($1))`, [
        `user:${input.email.toLowerCase()}`,
      ]);
      let user = (
        await c.query(
          `SELECT id FROM users WHERE lower(email)=lower($1) FOR UPDATE`,
          [input.email],
        )
      ).rows[0];
      if (!user) {
        user = { id: randomUUID() };
        await c.query(
          `INSERT INTO users(id,organization_id,email,first_name,last_name,display_name,role,status,is_demo_user,is_admin,password_hash,created_at,updated_at) VALUES($1,$2,lower($3),$4,$5,$6,$7,$8,false,false,$9,now(),now())`,
          [
            user.id,
            input.organizationId,
            input.email,
            input.firstName,
            input.lastName,
            `${input.firstName} ${input.lastName}`,
            input.roleCode,
            input.status,
            hashPassword(input.password),
          ],
        );
      }
      if (input.failAt === "user") throw new Error("injected:user");
      if (
        (
          await c.query(
            `SELECT 1 FROM organization_memberships WHERE organization_id=$1 AND user_id=$2`,
            [input.organizationId, user.id],
          )
        ).rowCount
      )
        throw new CommandConflictError(
          "A membership already exists for this user.",
        );
      const membershipId = randomUUID();
      await c.query(
        `INSERT INTO organization_memberships(id,organization_id,user_id,admin_role,status,joined_at,created_at,updated_at) VALUES($1,$2,$3,'MEMBER',$4,now(),now(),now())`,
        [
          membershipId,
          input.organizationId,
          user.id,
          input.status === "ACTIVE" ? "ACTIVE" : "DEACTIVATED",
        ],
      );
      if (input.failAt === "membership") throw new Error("injected:membership");
      const role = (
        await c.query(
          `SELECT id FROM organization_role_definitions WHERE organization_id=$1 AND code=$2 AND is_active`,
          [input.organizationId, input.roleCode],
        )
      ).rows[0];
      if (!role) throw new CommandConflictError("Organization role not found.");
      await c.query(
        `INSERT INTO membership_role_assignments(id,organization_id,membership_id,organization_role_definition_id,is_primary,effective_from,created_at,updated_at) VALUES($1,$2,$3,$4,true,now(),now(),now())`,
        [randomUUID(), input.organizationId, membershipId, role.id],
      );
      if (input.failAt === "role-assignment")
        throw new Error("injected:role-assignment");
      if (input.managerUserId) {
        const manager = (
          await c.query(
            `SELECT m.id,COALESCE(t.code,r.code) semantic_role FROM organization_memberships m JOIN membership_role_assignments a ON(a.organization_id=m.organization_id AND a.membership_id=m.id AND a.is_primary AND a.effective_to IS NULL) JOIN organization_role_definitions r ON(r.organization_id=a.organization_id AND r.id=a.organization_role_definition_id) LEFT JOIN system_role_templates t ON t.id=r.system_template_id WHERE m.organization_id=$1 AND m.user_id=$2 AND m.status='ACTIVE'`,
            [input.organizationId, input.managerUserId],
          )
        ).rows[0];
        if (!manager)
          throw new CommandConflictError(
            "Select an active manager from this organization.",
          );
        if (!managerSemanticRoles.includes(manager.semantic_role))
          throw new CommandConflictError(
            "Select a manager with an active management role.",
          );
        await c.query(
          `INSERT INTO organization_relationships(id,organization_id,source_membership_id,target_membership_id,relationship_type,is_primary,effective_from,created_at,updated_at) VALUES($1,$2,$3,$4,'REPORTS_TO',true,now(),now(),now())`,
          [randomUUID(), input.organizationId, membershipId, manager.id],
        );
      }
      if (input.failAt === "audit") throw new Error("injected:audit");
      await this.audit(c, {
        actor: input.actor,
        organizationId: input.organizationId,
        event: "ORGANIZATION_USER_CREATED",
        resourceType: "user",
        resourceId: user.id,
        after: { membershipId, status: input.status, role: input.roleCode },
      });
      return { userId: user.id, membershipId };
    }, true);
  }
  async updateOrganizationUser(input: {
    organizationId: string;
    actor: User;
    userId: string;
    expectedVersion: number;
    email: string;
    firstName: string;
    lastName: string;
    password?: string;
    roleCode: string;
    status: string;
    managerUserId: string | null;
    failAt?: FailureStage;
  }) {
    return this.tx(async (c) => {
      await c.query(`SELECT pg_advisory_xact_lock(hashtext($1))`, [
        `owners:${input.organizationId}`,
      ]);
      const membership = (
        await c.query(
          `SELECT * FROM organization_memberships WHERE organization_id=$1 AND user_id=$2 FOR UPDATE`,
          [input.organizationId, input.userId],
        )
      ).rows[0];
      if (!membership) throw new CommandConflictError("User not found.");
      if (input.actor.id === input.userId && input.status !== "ACTIVE")
        throw new CommandConflictError(
          "You cannot deactivate your own account.",
        );
      if (
        membership.admin_role === "ORG_OWNER" &&
        membership.status === "ACTIVE" &&
        input.status !== "ACTIVE"
      ) {
        const owners = Number(
          (
            await c.query(
              `SELECT count(*) FROM organization_memberships WHERE organization_id=$1 AND admin_role='ORG_OWNER' AND status='ACTIVE'`,
              [input.organizationId],
            )
          ).rows[0].count,
        );
        if (owners <= 1)
          throw new CommandConflictError(
            "The organization must retain at least one active owner.",
          );
      }
      const passwordSql = input.password ? `,password_hash=$8` : "",
        params = input.password
          ? [
              input.userId,
              input.expectedVersion,
              input.email,
              input.firstName,
              input.lastName,
              `${input.firstName} ${input.lastName}`,
              input.roleCode,
              hashPassword(input.password),
            ]
          : [
              input.userId,
              input.expectedVersion,
              input.email,
              input.firstName,
              input.lastName,
              `${input.firstName} ${input.lastName}`,
              input.roleCode,
            ];
      const updated = (
        await c.query(
          `UPDATE users SET email=lower($3),first_name=$4,last_name=$5,display_name=$6,role=$7${passwordSql},version=version+1,updated_at=now() WHERE id=$1 AND version=$2 RETURNING id,version`,
          params,
        )
      ).rows[0];
      if (!updated) throw new ConcurrencyConflictError();
      await c.query(
        `UPDATE organization_memberships SET status=$3,version=version+1,updated_at=now() WHERE organization_id=$1 AND id=$2`,
        [
          input.organizationId,
          membership.id,
          input.status === "ACTIVE" ? "ACTIVE" : "DEACTIVATED",
        ],
      );
      const role = (
        await c.query(
          `SELECT id FROM organization_role_definitions WHERE organization_id=$1 AND code=$2 AND is_active`,
          [input.organizationId, input.roleCode],
        )
      ).rows[0];
      if (!role) throw new CommandConflictError("Organization role not found.");
      await c.query(
        `UPDATE membership_role_assignments SET is_primary=false,effective_to=now(),updated_at=now() WHERE organization_id=$1 AND membership_id=$2 AND is_primary AND effective_to IS NULL`,
        [input.organizationId, membership.id],
      );
      await c.query(
        `INSERT INTO membership_role_assignments(id,organization_id,membership_id,organization_role_definition_id,is_primary,effective_from,created_at,updated_at) VALUES($1,$2,$3,$4,true,now(),now(),now())`,
        [randomUUID(), input.organizationId, membership.id, role.id],
      );
      await c.query(
        `UPDATE organization_relationships SET effective_to=now(),is_primary=false,updated_at=now() WHERE organization_id=$1 AND source_membership_id=$2 AND relationship_type='REPORTS_TO' AND effective_to IS NULL`,
        [input.organizationId, membership.id],
      );
      if (input.managerUserId) {
        const manager = (
          await c.query(
            `SELECT m.id,COALESCE(t.code,r.code) semantic_role FROM organization_memberships m JOIN membership_role_assignments a ON(a.organization_id=m.organization_id AND a.membership_id=m.id AND a.is_primary AND a.effective_to IS NULL) JOIN organization_role_definitions r ON(r.organization_id=a.organization_id AND r.id=a.organization_role_definition_id) LEFT JOIN system_role_templates t ON t.id=r.system_template_id WHERE m.organization_id=$1 AND m.user_id=$2 AND m.status='ACTIVE'`,
            [input.organizationId, input.managerUserId],
          )
        ).rows[0];
        if (!manager)
          throw new CommandConflictError(
            "Select an active manager from this organization.",
          );
        if (!managerSemanticRoles.includes(manager.semantic_role))
          throw new CommandConflictError(
            "Select a manager with an active management role.",
          );
        const cycle = await c.query(
          `WITH RECURSIVE chain(id) AS (SELECT $2::text UNION SELECT r.target_membership_id FROM organization_relationships r JOIN chain x ON r.source_membership_id=x.id WHERE r.organization_id=$1 AND r.relationship_type='REPORTS_TO' AND r.effective_to IS NULL) SELECT 1 FROM chain WHERE id=$3`,
          [input.organizationId, manager.id, membership.id],
        );
        if (cycle.rowCount)
          throw new CommandConflictError(
            "That reporting assignment would create a cycle.",
          );
        await c.query(
          `INSERT INTO organization_relationships(id,organization_id,source_membership_id,target_membership_id,relationship_type,is_primary,effective_from,created_at,updated_at) VALUES($1,$2,$3,$4,'REPORTS_TO',true,now(),now(),now())`,
          [randomUUID(), input.organizationId, membership.id, manager.id],
        );
      }
      if (input.failAt === "audit") throw new Error("injected:audit");
      await this.audit(c, {
        actor: input.actor,
        organizationId: input.organizationId,
        event: "ORGANIZATION_USER_UPDATED",
        resourceType: "user",
        resourceId: input.userId,
        after: {
          status: input.status,
          role: input.roleCode,
          version: updated.version,
        },
      });
      return { userId: input.userId, version: updated.version };
    }, true);
  }
  async updateOrganization(input: {
    organizationId: string;
    actor: User;
    expectedVersion: number;
    patch: {
      name?: string;
      slug?: string;
      primaryDomain?: string | null;
      timezone?: string;
      fiscalYearStartMonth?: number;
      environment?: string;
      status?: string;
    };
    owner?: { email: string; firstName: string; lastName: string };
    failAt?: FailureStage;
  }) {
    return this.tx(async (c) => {
      const before = (
        await c.query(`SELECT * FROM organizations WHERE id=$1 FOR UPDATE`, [
          input.organizationId,
        ])
      ).rows[0];
      if (!before) throw new CommandConflictError("Organization not found.");
      const allowed: Record<string, string[]> = {
        PROVISIONING: ["ACTIVE", "ARCHIVED"],
        ACTIVE: ["SUSPENDED", "ARCHIVED"],
        SUSPENDED: ["ACTIVE", "ARCHIVED"],
        ARCHIVED: [],
      };
      if (
        input.patch.status &&
        input.patch.status !== before.status &&
        !allowed[before.status]?.includes(input.patch.status)
      )
        throw new CommandConflictError(
          "Invalid organization lifecycle transition.",
        );
      const row = (
        await c.query(
          `UPDATE organizations SET name=COALESCE($3,name),slug=COALESCE($4,slug),primary_domain=CASE WHEN $5::text IS NULL THEN primary_domain ELSE NULLIF($5,'') END,timezone=COALESCE($6,timezone),fiscal_year_start_month=COALESCE($7,fiscal_year_start_month),environment=COALESCE($8,environment),status=COALESCE($9,status),version=version+1,updated_at=now() WHERE id=$1 AND version=$2 RETURNING *`,
          [
            input.organizationId,
            input.expectedVersion,
            input.patch.name ?? null,
            input.patch.slug ?? null,
            input.patch.primaryDomain === undefined
              ? null
              : input.patch.primaryDomain,
            input.patch.timezone ?? null,
            input.patch.fiscalYearStartMonth ?? null,
            input.patch.environment ?? null,
            input.patch.status ?? null,
          ],
        )
      ).rows[0];
      if (!row) throw new ConcurrencyConflictError();
      if (input.owner) {
        await c.query(`SELECT pg_advisory_xact_lock(hashtext($1))`, [
          `owners:${input.organizationId}`,
        ]);
        const owner = (
          await c.query(
            `SELECT u.* FROM organization_memberships m JOIN users u ON u.id=m.user_id WHERE m.organization_id=$1 AND m.admin_role='ORG_OWNER' AND m.status IN ('ACTIVE','INVITED') ORDER BY m.created_at LIMIT 1 FOR UPDATE OF u`,
            [input.organizationId],
          )
        ).rows[0];
        if (!owner)
          throw new CommandConflictError("Organization owner not found.");
        await c.query(
          `UPDATE users SET email=lower($2),first_name=$3,last_name=$4,display_name=$5,version=version+1,updated_at=now() WHERE id=$1`,
          [
            owner.id,
            input.owner.email,
            input.owner.firstName,
            input.owner.lastName,
            `${input.owner.firstName} ${input.owner.lastName}`,
          ],
        );
        await c.query(
          `UPDATE organization_invitations SET email=lower($2),version=version+1 WHERE organization_id=$1 AND admin_role='ORG_OWNER' AND status='PENDING'`,
          [input.organizationId, input.owner.email],
        );
      }
      if (input.failAt === "audit") throw new Error("injected:audit");
      const event =
        input.patch.status === "SUSPENDED"
          ? "ORGANIZATION_SUSPENDED"
          : before.status === "SUSPENDED" && input.patch.status === "ACTIVE"
            ? "ORGANIZATION_REACTIVATED"
            : input.patch.status === "ARCHIVED"
              ? "ORGANIZATION_ARCHIVED"
              : "ORGANIZATION_METADATA_UPDATED";
      await this.audit(c, {
        actor: input.actor,
        organizationId: input.organizationId,
        event,
        resourceType: "organization",
        resourceId: input.organizationId,
        before: { status: before.status, version: before.version },
        after: { status: row.status, version: row.version },
      });
      return { organizationId: input.organizationId, version: row.version };
    }, true);
  }
  async transferOwnership(input: {
    organizationId: string;
    actor: User;
    fromMembershipId: string;
    toMembershipId: string;
    demotePrevious: boolean;
    failAt?: FailureStage;
  }) {
    return this.tx(async (c) => {
      await c.query(`SELECT pg_advisory_xact_lock(hashtext($1))`, [
        `owners:${input.organizationId}`,
      ]);
      const ids = [input.fromMembershipId, input.toMembershipId].sort(),
        rows = (
          await c.query(
            `SELECT * FROM organization_memberships WHERE organization_id=$1 AND id=ANY($2::text[]) ORDER BY id FOR UPDATE`,
            [input.organizationId, ids],
          )
        ).rows;
      if (rows.length !== 2)
        throw new CommandConflictError(
          "Ownership target must belong to this organization.",
        );
      const from = rows.find((r) => r.id === input.fromMembershipId);
      if (from?.admin_role !== "ORG_OWNER" || from.status !== "ACTIVE")
        throw new CommandConflictError("Current owner is not active.");
      await c.query(
        `UPDATE organization_memberships SET admin_role='ORG_OWNER',status='ACTIVE',version=version+1,updated_at=now() WHERE organization_id=$1 AND id=$2`,
        [input.organizationId, input.toMembershipId],
      );
      if (input.demotePrevious)
        await c.query(
          `UPDATE organization_memberships SET admin_role='MEMBER',version=version+1,updated_at=now() WHERE organization_id=$1 AND id=$2`,
          [input.organizationId, input.fromMembershipId],
        );
      if (input.failAt === "audit") throw new Error("injected:audit");
      await this.audit(c, {
        actor: input.actor,
        organizationId: input.organizationId,
        event: "ORGANIZATION_OWNER_TRANSFERRED",
        resourceType: "membership",
        resourceId: input.toMembershipId,
        before: { ownerMembershipId: input.fromMembershipId },
        after: { ownerMembershipId: input.toMembershipId },
      });
      return { id: input.toMembershipId };
    }, true);
  }
  async rotateOwnerInvitation(input: {
    organizationId: string;
    actor: User;
    failAt?: FailureStage;
  }) {
    return this.tx(async (c) => {
      await c.query(`SELECT pg_advisory_xact_lock(hashtext($1))`, [
        `owner-invite:${input.organizationId}`,
      ]);
      const invitation = (
        await c.query(
          `SELECT i.*,u.email owner_email FROM organization_invitations i JOIN organization_memberships m ON m.organization_id=i.organization_id AND m.admin_role='ORG_OWNER' JOIN users u ON u.id=m.user_id WHERE i.organization_id=$1 AND i.admin_role='ORG_OWNER' AND i.status='PENDING' ORDER BY i.created_at LIMIT 1 FOR UPDATE OF i`,
          [input.organizationId],
        )
      ).rows[0];
      if (!invitation)
        throw new CommandConflictError("Pending owner invitation not found.");
      const token = randomBytes(32).toString("base64url");
      await c.query(
        `UPDATE organization_invitations SET token_hash=$2,email=lower($3),expires_at=now()+interval '7 days',version=version+1 WHERE id=$1`,
        [
          invitation.id,
          createHash("sha256").update(token).digest("hex"),
          invitation.owner_email,
        ],
      );
      if (input.failAt === "invitation") throw new Error("injected:invitation");
      if (input.failAt === "audit") throw new Error("injected:audit");
      await this.audit(c, {
        actor: input.actor,
        organizationId: input.organizationId,
        event: "OWNER_INVITATION_ROTATED",
        resourceType: "invitation",
        resourceId: invitation.id,
      });
      return { invitationId: invitation.id, token };
    }, true);
  }
  async updateRole(input: {
    organizationId: string;
    roleId: string;
    expectedVersion: number;
    patch: {
      name?: string;
      description?: string | null;
      systemTemplateId?: string | null;
      defaultExperienceKey?: string | null;
      isActive?: boolean;
    };
    audit: CommandAudit;
  }) {
    return this.tx(async (c) => {
      const values = [
          input.organizationId,
          input.roleId,
          input.expectedVersion,
          input.patch.name ?? null,
          input.patch.description === undefined
            ? null
            : input.patch.description,
          input.patch.systemTemplateId === undefined
            ? null
            : input.patch.systemTemplateId,
          input.patch.defaultExperienceKey === undefined
            ? null
            : input.patch.defaultExperienceKey,
          input.patch.isActive ?? null,
        ],
        { rows } = await c.query(
          `UPDATE organization_role_definitions SET name=COALESCE($4,name),description=CASE WHEN $5::text IS NULL THEN description ELSE $5 END,system_template_id=CASE WHEN $6::text IS NULL THEN system_template_id ELSE $6 END,default_experience_key=CASE WHEN $7::text IS NULL THEN default_experience_key ELSE $7 END,is_active=COALESCE($8,is_active),version=version+1,updated_at=now() WHERE organization_id=$1 AND id=$2 AND version=$3 RETURNING id,name,description,version`,
          values,
        );
      if (!rows[0]) throw new ConcurrencyConflictError();
      await this.audit(c, input.audit);
      return rows[0];
    });
  }
  async setPrimaryRole(input: {
    organizationId: string;
    membershipId: string;
    roleId: string;
    audit: CommandAudit;
  }) {
    return this.tx(async (c) => {
      await c.query(
        `SELECT id FROM organization_memberships WHERE organization_id=$1 AND id=$2 FOR UPDATE`,
        [input.organizationId, input.membershipId],
      );
      await c.query(
        `UPDATE membership_role_assignments SET is_primary=false,updated_at=now() WHERE organization_id=$1 AND membership_id=$2 AND is_primary AND effective_to IS NULL`,
        [input.organizationId, input.membershipId],
      );
      const existing = await c.query(
        `SELECT id FROM membership_role_assignments WHERE organization_id=$1 AND membership_id=$2 AND organization_role_definition_id=$3 AND effective_to IS NULL FOR UPDATE`,
        [input.organizationId, input.membershipId, input.roleId],
      );
      const id = existing.rows[0]?.id ?? randomUUID();
      if (existing.rows[0])
        await c.query(
          `UPDATE membership_role_assignments SET is_primary=true,updated_at=now() WHERE id=$1`,
          [id],
        );
      else
        await c.query(
          `INSERT INTO membership_role_assignments(id,organization_id,membership_id,organization_role_definition_id,is_primary,effective_from,created_at,updated_at) VALUES($1,$2,$3,$4,true,now(),now(),now())`,
          [id, input.organizationId, input.membershipId, input.roleId],
        );
      await this.audit(c, input.audit);
      return { id };
    });
  }
  async assignUnit(input: {
    organizationId: string;
    membershipId: string;
    unitId: string;
    isPrimary: boolean;
    audit: CommandAudit;
  }) {
    return this.tx(async (c) => {
      await c.query(
        `SELECT id FROM organization_memberships WHERE organization_id=$1 AND id=$2 FOR UPDATE`,
        [input.organizationId, input.membershipId],
      );
      if (input.isPrimary)
        await c.query(
          `UPDATE membership_organizational_units SET is_primary=false WHERE organization_id=$1 AND membership_id=$2`,
          [input.organizationId, input.membershipId],
        );
      const id = randomUUID();
      await c.query(
        `INSERT INTO membership_organizational_units(id,organization_id,membership_id,organizational_unit_id,is_primary,created_at) VALUES($1,$2,$3,$4,$5,now()) ON CONFLICT(organization_id,membership_id,organizational_unit_id) DO UPDATE SET is_primary=excluded.is_primary`,
        [
          id,
          input.organizationId,
          input.membershipId,
          input.unitId,
          input.isPrimary,
        ],
      );
      await this.audit(c, input.audit);
      return { id };
    });
  }
  async changeAdminRole(input: {
    organizationId: string;
    membershipId: string;
    adminRole: AdminRole;
    status: string;
    audit: CommandAudit;
  }) {
    return this.tx(async (c) => {
      await c.query(`SELECT pg_advisory_xact_lock(hashtext($1))`, [
        `owners:${input.organizationId}`,
      ]);
      const target = (
        await c.query(
          `SELECT * FROM organization_memberships WHERE organization_id=$1 AND id=$2 FOR UPDATE`,
          [input.organizationId, input.membershipId],
        )
      ).rows[0];
      if (!target) throw new CommandConflictError("Membership not found");
      if (
        target.admin_role === "ORG_OWNER" &&
        target.status === "ACTIVE" &&
        (input.adminRole !== "ORG_OWNER" || input.status !== "ACTIVE")
      ) {
        const count = Number(
          (
            await c.query(
              `SELECT count(*) FROM organization_memberships WHERE organization_id=$1 AND admin_role='ORG_OWNER' AND status='ACTIVE'`,
              [input.organizationId],
            )
          ).rows[0].count,
        );
        if (count <= 1)
          throw new CommandConflictError(
            "The organization must retain at least one active owner.",
          );
      }
      await c.query(
        `UPDATE organization_memberships SET admin_role=$3,status=$4,version=version+1,updated_at=now() WHERE organization_id=$1 AND id=$2`,
        [
          input.organizationId,
          input.membershipId,
          input.adminRole,
          input.status,
        ],
      );
      await this.audit(c, input.audit);
      return { id: input.membershipId };
    }, true);
  }
  async setPrimaryManager(input: {
    organizationId: string;
    sourceMembershipId: string;
    targetMembershipId: string;
    audit: CommandAudit;
  }) {
    return this.tx(async (c) => {
      const ids = [input.sourceMembershipId, input.targetMembershipId].sort();
      await c.query(
        `SELECT id FROM organization_memberships WHERE organization_id=$1 AND id=ANY($2::text[]) ORDER BY id FOR UPDATE`,
        [input.organizationId, ids],
      );
      if (input.sourceMembershipId === input.targetMembershipId)
        throw new CommandConflictError("A person cannot report to themselves.");
      const cycle = await c.query(
        `WITH RECURSIVE chain(id) AS (SELECT $2::text UNION SELECT r.target_membership_id FROM organization_relationships r JOIN chain c ON r.source_membership_id=c.id WHERE r.organization_id=$1 AND r.relationship_type='REPORTS_TO' AND r.effective_to IS NULL) SELECT 1 FROM chain WHERE id=$3 LIMIT 1`,
        [
          input.organizationId,
          input.targetMembershipId,
          input.sourceMembershipId,
        ],
      );
      if (cycle.rowCount)
        throw new CommandConflictError(
          "That reporting relationship would create a cycle.",
        );
      await c.query(
        `UPDATE organization_relationships SET effective_to=now(),is_primary=false,updated_at=now() WHERE organization_id=$1 AND source_membership_id=$2 AND relationship_type='REPORTS_TO' AND effective_to IS NULL`,
        [input.organizationId, input.sourceMembershipId],
      );
      const id = randomUUID();
      await c.query(
        `INSERT INTO organization_relationships(id,organization_id,source_membership_id,target_membership_id,relationship_type,is_primary,effective_from,created_at,updated_at) VALUES($1,$2,$3,$4,'REPORTS_TO',true,now(),now(),now())`,
        [
          id,
          input.organizationId,
          input.sourceMembershipId,
          input.targetMembershipId,
        ],
      );
      await this.audit(c, input.audit);
      return { id };
    });
  }
  async bootstrap(input: {
    actor: User;
    name: string;
    slug: string;
    primaryDomain: string | null;
    timezone: string;
    fiscalYearStartMonth: number;
    environment: OrganizationEnvironment;
    ownerEmail: string;
    ownerFirstName: string;
    ownerLastName: string;
    useStandardOrgTemplate: boolean;
    idempotencyKey: string;
    failAt?: FailureStage;
  }) {
    return this.tx(async (c) => {
      const prior = await c.query(
        `SELECT id FROM organizations WHERE bootstrap_idempotency_key=$1`,
        [input.idempotencyKey],
      );
      if (prior.rows[0])
        return { organizationId: prior.rows[0].id, replayed: true };
      const now = new Date().toISOString(),
        organizationId = randomUUID();
      await c.query(
        `INSERT INTO organizations(id,name,slug,status,primary_domain,environment,timezone,fiscal_year_start_month,default_methodology,bootstrap_idempotency_key,created_at,updated_at) VALUES($1,$2,$3,'ACTIVE',$4,$5,$6,$7,'MEDDPICC',$8,$9,$9)`,
        [
          organizationId,
          input.name,
          input.slug,
          input.primaryDomain,
          input.environment,
          input.timezone,
          input.fiscalYearStartMonth,
          input.idempotencyKey,
          now,
        ],
      );
      if (input.failAt === "organization")
        throw new Error("injected:organization");
      let owner = (
        await c.query(
          `SELECT id FROM users WHERE lower(email)=lower($1) FOR UPDATE`,
          [input.ownerEmail],
        )
      ).rows[0];
      if (!owner) {
        owner = { id: randomUUID() };
        await c.query(
          `INSERT INTO users(id,organization_id,email,first_name,last_name,display_name,role,status,is_demo_user,is_admin,password_hash,created_at,updated_at) VALUES($1,$2,$3,$4,$5,$6,'AE','ACTIVE',false,true,$7,$8,$8)`,
          [
            owner.id,
            organizationId,
            input.ownerEmail,
            input.ownerFirstName,
            input.ownerLastName,
            `${input.ownerFirstName} ${input.ownerLastName}`,
            hashPassword(randomBytes(24).toString("base64url")),
            now,
          ],
        );
      }
      const membershipId = randomUUID();
      await c.query(
        `INSERT INTO organization_memberships(id,organization_id,user_id,admin_role,status,created_at,updated_at) VALUES($1,$2,$3,'ORG_OWNER','INVITED',$4,$4)`,
        [membershipId, organizationId, owner.id, now],
      );
      if (input.failAt === "membership") throw new Error("injected:membership");
      for (const t of systemRoleTemplates)
        await c.query(
          `INSERT INTO organization_role_definitions(id,organization_id,name,code,system_template_id,category,description,default_experience_key,permissions,is_system_seeded,is_active,created_at,updated_at) VALUES($1,$2,$3,$4,$5,$6,$7,$8,'[]',true,true,$9,$9)`,
          [
            randomUUID(),
            organizationId,
            defaultRoleNames[t.code],
            t.code,
            t.id,
            t.category,
            t.description,
            t.defaultExperienceKey,
            now,
          ],
        );
      for (const code of cadenceTemplateTypes) {
        const scope =
          code === "AE_PARTNER_SYNC"
            ? "PARTNER"
            : [
                  "CUSTOMER_NEXT_STEP",
                  "TECHNICAL_VALIDATION",
                  "SECURITY_REVIEW",
                  "RENEWAL_REVIEW",
                  "MUTUAL_ACTION_PLAN_CHECKPOINT",
                ].includes(code)
              ? "CUSTOMER"
              : code === "DISCOVERY"
                ? "PROSPECT"
                : code === "EXECUTIVE_SPONSOR_MEETING"
                  ? "EXECUTIVE"
                  : "INTERNAL";
        await c.query(
          `INSERT INTO cadence_templates(id,organization_id,code,name,scope,suggested_frequency,participant_expectations,sections,is_system_seeded,is_active,created_at,updated_at) VALUES($1,$2,$3,$4,$5,'AS_NEEDED','[]','[]',true,true,$6,$6)`,
          [
            randomUUID(),
            organizationId,
            code,
            code
              .split("_")
              .map((word) => word[0] + word.slice(1).toLowerCase())
              .join(" "),
            scope,
            now,
          ],
        );
      }
      if (input.failAt === "roles") throw new Error("injected:roles");
      if (input.useStandardOrgTemplate) {
        const company = randomUUID(),
          revenue = randomUUID();
        await c.query(
          `INSERT INTO organizational_units(id,organization_id,name,type,leader_membership_id,status,created_at,updated_at) VALUES($1,$2,$3,'COMPANY',$4,'ACTIVE',$5,$5),($6,$2,'Revenue','FUNCTION',NULL,'ACTIVE',$5,$5)`,
          [company, organizationId, input.name, membershipId, now, revenue],
        );
        for (const name of [
          "Sales",
          "Solutions Engineering",
          "Partnerships",
          "Sales Development",
        ])
          await c.query(
            `INSERT INTO organizational_units(id,organization_id,name,type,parent_unit_id,status,created_at,updated_at) VALUES($1,$2,$3,'FUNCTION',$4,'ACTIVE',$5,$5)`,
            [randomUUID(), organizationId, name, revenue, now],
          );
      }
      const token = randomBytes(32).toString("base64url");
      await c.query(
        `INSERT INTO organization_invitations(id,organization_id,email,admin_role,configuration,token_hash,expires_at,invited_by_user_id,status,created_at) VALUES($1,$2,$3,'ORG_OWNER',$4,$5,now()+interval '7 days',$6,'PENDING',$7)`,
        [
          randomUUID(),
          organizationId,
          input.ownerEmail,
          json({
            roleAssignmentIds: [],
            organizationalUnitIds: [],
            primaryManagerMembershipId: null,
            dottedLineManagerMembershipIds: [],
          }),
          createHash("sha256").update(token).digest("hex"),
          input.actor.id,
          now,
        ],
      );
      await c.query(
        `INSERT INTO governance_configurations(organization_id,configuration,updated_at) VALUES($1,$2,$3)`,
        [
          organizationId,
          json({
            autonomyDefault: "RECOMMEND",
            requireHumanApproval: true,
            managerApprovalCategories: ["forecast", "customer-commitment"],
            demoModeAllowed: input.environment === "DEMO",
            auditRetentionDays: 365,
          }),
          now,
        ],
      );
      if (input.failAt === "audit") throw new Error("injected:audit");
      await this.audit(c, {
        actor: input.actor,
        organizationId,
        event: "ORGANIZATION_CREATED",
        resourceType: "organization",
        resourceId: organizationId,
        after: { name: input.name, slug: input.slug },
      });
      return { organizationId, token, replayed: false };
    }, true);
  }
  async acceptInvitation(input: {
    token: string;
    firstName: string;
    lastName: string;
    password: string;
    failAt?: FailureStage;
  }) {
    return this.tx(async (c) => {
      const tokenHash = createHash("sha256").update(input.token).digest("hex"),
        inv = (
          await c.query(
            `SELECT * FROM organization_invitations WHERE token_hash=$1 FOR UPDATE`,
            [tokenHash],
          )
        ).rows[0];
      if (!inv)
        throw new CommandConflictError("Invitation is invalid or expired.");
      if (inv.status !== "PENDING")
        throw new CommandConflictError("Invitation was already accepted.");
      if (new Date(inv.expires_at).getTime() <= Date.now())
        throw new CommandConflictError("Invitation is invalid or expired.");
      const config = inv.configuration ?? {},
        now = new Date().toISOString();
      let user = (
        await c.query(
          `SELECT * FROM users WHERE lower(email)=lower($1) FOR UPDATE`,
          [inv.email],
        )
      ).rows[0];
      if (!user) {
        user = { id: randomUUID(), platform_role: null };
        await c.query(
          `INSERT INTO users(id,organization_id,email,first_name,last_name,display_name,role,status,is_demo_user,is_admin,password_hash,created_at,updated_at) VALUES($1,$2,$3,$4,$5,$6,'AE','ACTIVE',false,$7,$8,$9,$9)`,
          [
            user.id,
            inv.organization_id,
            inv.email,
            input.firstName,
            input.lastName,
            `${input.firstName} ${input.lastName}`,
            inv.admin_role !== "MEMBER",
            hashPassword(input.password),
            now,
          ],
        );
      }
      if (input.failAt === "user") throw new Error("injected:user");
      let membership = (
        await c.query(
          `SELECT id FROM organization_memberships WHERE organization_id=$1 AND user_id=$2 FOR UPDATE`,
          [inv.organization_id, user.id],
        )
      ).rows[0];
      if (membership)
        await c.query(
          `UPDATE organization_memberships SET admin_role=$3,status='ACTIVE',joined_at=$4,version=version+1,updated_at=$4 WHERE organization_id=$1 AND id=$2`,
          [inv.organization_id, membership.id, inv.admin_role, now],
        );
      else {
        membership = { id: randomUUID() };
        await c.query(
          `INSERT INTO organization_memberships(id,organization_id,user_id,admin_role,status,joined_at,created_at,updated_at) VALUES($1,$2,$3,$4,'ACTIVE',$5,$5,$5)`,
          [membership.id, inv.organization_id, user.id, inv.admin_role, now],
        );
      }
      if (input.failAt === "membership") throw new Error("injected:membership");
      let primary = true;
      for (const roleId of config.roleAssignmentIds ?? []) {
        await c.query(
          `INSERT INTO membership_role_assignments(id,organization_id,membership_id,organization_role_definition_id,is_primary,effective_from,created_at,updated_at) VALUES($1,$2,$3,$4,$5,$6,$6,$6)`,
          [
            randomUUID(),
            inv.organization_id,
            membership.id,
            roleId,
            primary,
            now,
          ],
        );
        primary = false;
      }
      if (input.failAt === "role-assignment")
        throw new Error("injected:role-assignment");
      for (const unitId of config.organizationalUnitIds ?? [])
        await c.query(
          `INSERT INTO membership_organizational_units(id,organization_id,membership_id,organizational_unit_id,is_primary,created_at) VALUES($1,$2,$3,$4,false,$5)`,
          [randomUUID(), inv.organization_id, membership.id, unitId, now],
        );
      if (input.failAt === "unit-assignment")
        throw new Error("injected:unit-assignment");
      const managers = [
        ...(config.primaryManagerMembershipId
          ? [
              {
                id: config.primaryManagerMembershipId,
                type: "REPORTS_TO",
                primary: true,
              },
            ]
          : []),
        ...(config.dottedLineManagerMembershipIds ?? []).map((id: string) => ({
          id,
          type: "DOTTED_LINE_TO",
          primary: false,
        })),
      ];
      for (const m of managers)
        await c.query(
          `INSERT INTO organization_relationships(id,organization_id,source_membership_id,target_membership_id,relationship_type,is_primary,effective_from,created_at,updated_at) VALUES($1,$2,$3,$4,$5,$6,$7,$7,$7)`,
          [
            randomUUID(),
            inv.organization_id,
            membership.id,
            m.id,
            m.type,
            m.primary,
            now,
          ],
        );
      if (input.failAt === "relationship")
        throw new Error("injected:relationship");
      await c.query(
        `UPDATE organization_invitations SET status='ACCEPTED',accepted_at=$2,version=version+1 WHERE id=$1`,
        [inv.id, now],
      );
      if (input.failAt === "audit") throw new Error("injected:audit");
      await this.audit(c, {
        actor: { id: user.id, platformRole: user.platform_role } as User,
        organizationId: inv.organization_id,
        event: "USER_INVITATION_ACCEPTED",
        resourceType: "membership",
        resourceId: membership.id,
        after: { adminRole: inv.admin_role, status: "ACTIVE" },
      });
      return {
        userId: user.id,
        membershipId: membership.id,
        organizationId: inv.organization_id,
      };
    }, true);
  }
}
