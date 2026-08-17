import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";
import { Pool } from "pg";
import type { User } from "@/auth/types";
import {
  ConcurrencyConflictError,
  IdentityCommandRepository,
} from "./identity-commands";

const connectionString = process.env.TEST_DATABASE_URL;
describe.skipIf(!connectionString)(
  "PostgreSQL identity concurrency and atomicity",
  () => {
    let pool: Pool,
      a: IdentityCommandRepository,
      b: IdentityCommandRepository,
      actor: User;
    beforeAll(async () => {
      pool = new Pool({ connectionString });
      a = new IdentityCommandRepository(connectionString!);
      b = new IdentityCommandRepository(connectionString!);
      const row = (
        await pool.query(
          `SELECT * FROM users WHERE platform_role='SUPER_ADMIN' LIMIT 1`,
        )
      ).rows[0];
      actor = {
        id: row.id,
        email: row.email,
        firstName: row.first_name,
        lastName: row.last_name,
        displayName: row.display_name,
        organizationId: row.organization_id,
        role: row.role,
        status: row.status,
        platformRole: row.platform_role,
        managerUserId: null,
        teamId: null,
        regionId: null,
        timezone: null,
        avatarUrl: null,
        isDemoUser: false,
        isAdmin: true,
        passwordHash: row.password_hash,
        createdAt: String(row.created_at),
        updatedAt: String(row.updated_at),
        lastLoginAt: null,
      };
    });
    afterAll(async () => {
      await Promise.all([a.close(), b.close(), pool.end()]);
    });
    afterEach(async () => {
      const memberships = await pool.query(
        `SELECT m.id,m.user_id FROM organization_memberships m JOIN users u ON u.id=m.user_id WHERE m.organization_id='org-cognivit-demo' AND u.email LIKE '%@example.test'`,
      );
      const membershipIds = memberships.rows.map((row) => row.id);
      const userIds = memberships.rows.map((row) => row.user_id);
      if (membershipIds.length) {
        await pool.query(
          `DELETE FROM membership_role_assignments WHERE membership_id=ANY($1::text[])`,
          [membershipIds],
        );
        await pool.query(
          `DELETE FROM membership_organizational_units WHERE membership_id=ANY($1::text[])`,
          [membershipIds],
        );
        await pool.query(
          `DELETE FROM organization_relationships WHERE source_membership_id=ANY($1::text[]) OR target_membership_id=ANY($1::text[])`,
          [membershipIds],
        );
        await pool.query(
          `DELETE FROM organization_memberships WHERE id=ANY($1::text[])`,
          [membershipIds],
        );
        await pool.query(`DELETE FROM users WHERE id=ANY($1::text[])`, [
          userIds,
        ]);
      }
    });
    const audit = (
      organizationId: string,
      event: string,
      resourceId: string,
    ) => ({ actor, organizationId, event, resourceType: "test", resourceId });

    it("detects a same-record stale role update without overwriting", async () => {
      const organizationId = "org-cognivit-demo",
        role = (
          await pool.query(
            `SELECT id,version,name FROM organization_role_definitions WHERE organization_id=$1 ORDER BY id LIMIT 1`,
            [organizationId],
          )
        ).rows[0];
      const first = a.updateRole({
        organizationId,
        roleId: role.id,
        expectedVersion: role.version,
        patch: { description: "concurrency winner" },
        audit: audit(organizationId, "ROLE_UPDATED", role.id),
      });
      const second = b.updateRole({
        organizationId,
        roleId: role.id,
        expectedVersion: role.version,
        patch: { description: "stale loser" },
        audit: audit(organizationId, "ROLE_UPDATED", role.id),
      });
      const results = await Promise.allSettled([first, second]);
      expect(results.filter((x) => x.status === "fulfilled")).toHaveLength(1);
      const rejected = results.find((x) => x.status === "rejected");
      expect(
        rejected && rejected.status === "rejected" && rejected.reason,
      ).toBeInstanceOf(ConcurrencyConflictError);
    });

    it("preserves unrelated edits from independent repository instances", async () => {
      const organizationId = "org-cognivit-demo",
        roles = (
          await pool.query(
            `SELECT id FROM organization_role_definitions WHERE organization_id=$1 ORDER BY id LIMIT 2`,
            [organizationId],
          )
        ).rows,
        units = (
          await pool.query(
            `SELECT id FROM organizational_units WHERE organization_id=$1 LIMIT 1`,
            [organizationId],
          )
        ).rows,
        members = (
          await pool.query(
            `SELECT id FROM organization_memberships WHERE organization_id=$1 ORDER BY id LIMIT 2`,
            [organizationId],
          )
        ).rows;
      await Promise.all([
        a.setPrimaryRole({
          organizationId,
          membershipId: members[0].id,
          roleId: roles[0].id,
          audit: audit(organizationId, "ROLE_ASSIGNED", members[0].id),
        }),
        b.assignUnit({
          organizationId,
          membershipId: members[1].id,
          unitId: units[0].id,
          isPrimary: true,
          audit: audit(
            organizationId,
            "ORG_UNIT_MEMBER_ASSIGNED",
            members[1].id,
          ),
        }),
      ]);
      const fresh = new Pool({ connectionString });
      const [role, unit] = await Promise.all([
        fresh.query(
          `SELECT 1 FROM membership_role_assignments WHERE organization_id=$1 AND membership_id=$2 AND organization_role_definition_id=$3 AND is_primary AND effective_to IS NULL`,
          [organizationId, members[0].id, roles[0].id],
        ),
        fresh.query(
          `SELECT 1 FROM membership_organizational_units WHERE organization_id=$1 AND membership_id=$2 AND organizational_unit_id=$3 AND is_primary`,
          [organizationId, members[1].id, units[0].id],
        ),
      ]);
      await fresh.end();
      expect(role.rowCount).toBe(1);
      expect(unit.rowCount).toBe(1);
    });

    it("rolls back every bootstrap row when a required audit step fails", async () => {
      const slug = `rollback-${crypto.randomUUID()}`;
      await expect(
        a.bootstrap({
          actor,
          name: "Rollback Tenant",
          slug,
          primaryDomain: null,
          timezone: "UTC",
          fiscalYearStartMonth: 1,
          environment: "PRODUCTION",
          ownerEmail: `${slug}@example.test`,
          ownerFirstName: "Rollback",
          ownerLastName: "Owner",
          useStandardOrgTemplate: true,
          idempotencyKey: slug,
          failAt: "audit",
        }),
      ).rejects.toThrow("injected:audit");
      expect(
        Number(
          (
            await pool.query(
              `SELECT count(*) FROM organizations WHERE slug=$1`,
              [slug],
            )
          ).rows[0].count,
        ),
      ).toBe(0);
    });

    it("allows exactly one concurrent invitation acceptance", async () => {
      const slug = `accept-${crypto.randomUUID()}`,
        boot = await a.bootstrap({
          actor,
          name: "Accept Tenant",
          slug,
          primaryDomain: null,
          timezone: "UTC",
          fiscalYearStartMonth: 1,
          environment: "PRODUCTION",
          ownerEmail: `${slug}@example.test`,
          ownerFirstName: "Invite",
          ownerLastName: "Owner",
          useStandardOrgTemplate: false,
          idempotencyKey: slug,
        });
      expect(boot.token).toBeTruthy();
      expect(
        Number(
          (
            await pool.query(
              `SELECT count(*) FROM cadence_templates WHERE organization_id=$1`,
              [boot.organizationId],
            )
          ).rows[0].count,
        ),
      ).toBeGreaterThanOrEqual(15);
      const results = await Promise.allSettled([
        a.acceptInvitation({
          token: boot.token!,
          firstName: "Invite",
          lastName: "Owner",
          password: "SecurePass!1",
        }),
        b.acceptInvitation({
          token: boot.token!,
          firstName: "Invite",
          lastName: "Owner",
          password: "SecurePass!1",
        }),
      ]);
      expect(results.filter((x) => x.status === "fulfilled")).toHaveLength(1);
      expect(
        Number(
          (
            await pool.query(
              `SELECT count(*) FROM organization_invitations WHERE organization_id=$1 AND status='ACCEPTED'`,
              [boot.organizationId],
            )
          ).rows[0].count,
        ),
      ).toBe(1);
      expect(
        Number(
          (
            await pool.query(
              `SELECT count(*) FROM security_audit_events WHERE organization_id=$1 AND event='USER_INVITATION_ACCEPTED'`,
              [boot.organizationId],
            )
          ).rows[0].count,
        ),
      ).toBe(1);
    });

    it("serializes concurrent owner demotions and retains one active owner", async () => {
      const slug = `owners-${crypto.randomUUID()}`,
        boot = await a.bootstrap({
          actor,
          name: "Owner Tenant",
          slug,
          primaryDomain: null,
          timezone: "UTC",
          fiscalYearStartMonth: 1,
          environment: "PRODUCTION",
          ownerEmail: `${slug}@example.test`,
          ownerFirstName: "First",
          ownerLastName: "Owner",
          useStandardOrgTemplate: false,
          idempotencyKey: slug,
        }),
        first = (
          await pool.query(
            `SELECT id FROM organization_memberships WHERE organization_id=$1`,
            [boot.organizationId],
          )
        ).rows[0].id,
        userId = crypto.randomUUID(),
        second = crypto.randomUUID();
      await pool.query(
        `INSERT INTO users(id,organization_id,email,first_name,last_name,display_name,role,status,is_demo_user,is_admin,password_hash,created_at,updated_at) VALUES($1,$2,$3,'Second','Owner','Second Owner','AE','ACTIVE',false,true,'x',now(),now())`,
        [userId, boot.organizationId, `${userId}@example.test`],
      );
      await pool.query(
        `INSERT INTO organization_memberships(id,organization_id,user_id,admin_role,status,created_at,updated_at) VALUES($1,$2,$3,'ORG_OWNER','ACTIVE',now(),now())`,
        [second, boot.organizationId, userId],
      );
      const results = await Promise.allSettled([
        a.changeAdminRole({
          organizationId: boot.organizationId,
          membershipId: first,
          adminRole: "MEMBER",
          status: "ACTIVE",
          audit: audit(
            boot.organizationId,
            "MEMBERSHIP_ADMIN_ROLE_CHANGED",
            first,
          ),
        }),
        b.changeAdminRole({
          organizationId: boot.organizationId,
          membershipId: second,
          adminRole: "MEMBER",
          status: "ACTIVE",
          audit: audit(
            boot.organizationId,
            "MEMBERSHIP_ADMIN_ROLE_CHANGED",
            second,
          ),
        }),
      ]);
      expect(results.filter((x) => x.status === "fulfilled")).toHaveLength(1);
      expect(
        Number(
          (
            await pool.query(
              `SELECT count(*) FROM organization_memberships WHERE organization_id=$1 AND admin_role='ORG_OWNER' AND status='ACTIVE'`,
              [boot.organizationId],
            )
          ).rows[0].count,
        ),
      ).toBe(1);
    });

    it("enforces one primary role and one primary manager under concurrent requests", async () => {
      const organizationId = "org-cognivit-demo",
        members = (
          await pool.query(
            `SELECT id FROM organization_memberships WHERE organization_id=$1 AND status='ACTIVE' ORDER BY id LIMIT 3`,
            [organizationId],
          )
        ).rows,
        roles = (
          await pool.query(
            `SELECT id FROM organization_role_definitions WHERE organization_id=$1 ORDER BY id LIMIT 2`,
            [organizationId],
          )
        ).rows;
      await Promise.all([
        a.setPrimaryRole({
          organizationId,
          membershipId: members[0].id,
          roleId: roles[0].id,
          audit: audit(organizationId, "ROLE_ASSIGNED", members[0].id),
        }),
        b.setPrimaryRole({
          organizationId,
          membershipId: members[0].id,
          roleId: roles[1].id,
          audit: audit(organizationId, "ROLE_ASSIGNED", members[0].id),
        }),
      ]);
      expect(
        Number(
          (
            await pool.query(
              `SELECT count(*) FROM membership_role_assignments WHERE organization_id=$1 AND membership_id=$2 AND is_primary AND effective_to IS NULL`,
              [organizationId, members[0].id],
            )
          ).rows[0].count,
        ),
      ).toBe(1);
      await Promise.all([
        a.setPrimaryManager({
          organizationId,
          sourceMembershipId: members[0].id,
          targetMembershipId: members[1].id,
          audit: audit(
            organizationId,
            "REPORTING_RELATIONSHIP_CREATED",
            members[0].id,
          ),
        }),
        b.setPrimaryManager({
          organizationId,
          sourceMembershipId: members[0].id,
          targetMembershipId: members[2].id,
          audit: audit(
            organizationId,
            "REPORTING_RELATIONSHIP_CREATED",
            members[0].id,
          ),
        }),
      ]);
      expect(
        Number(
          (
            await pool.query(
              `SELECT count(*) FROM organization_relationships WHERE organization_id=$1 AND source_membership_id=$2 AND relationship_type='REPORTS_TO' AND is_primary AND effective_to IS NULL`,
              [organizationId, members[0].id],
            )
          ).rows[0].count,
        ),
      ).toBe(1);
    });

    it("rolls invitation setup and audit back together on injected failure", async () => {
      const organizationId = "org-cognivit-demo",
        email = `rollback-invite-${crypto.randomUUID()}@example.test`,
        invitation = await a.createInvitation({
          organizationId,
          actor,
          email,
          adminRole: "MEMBER",
          roleAssignmentIds: [],
          organizationalUnitIds: [],
          primaryManagerMembershipId: null,
          dottedLineManagerMembershipIds: [],
        });
      await expect(
        a.acceptInvitation({
          token: invitation.token,
          firstName: "Rollback",
          lastName: "Invite",
          password: "SecurePass!1",
          failAt: "audit",
        }),
      ).rejects.toThrow("injected:audit");
      expect(
        Number(
          (
            await pool.query(`SELECT count(*) FROM users WHERE email=$1`, [
              email,
            ])
          ).rows[0].count,
        ),
      ).toBe(0);
      expect(
        (
          await pool.query(
            `SELECT status,accepted_at FROM organization_invitations WHERE id=$1`,
            [invitation.invitationId],
          )
        ).rows[0],
      ).toMatchObject({ status: "PENDING", accepted_at: null });
    });

    it("creates users atomically and rejects cross-tenant manager IDs", async () => {
      const email = `targeted-${crypto.randomUUID()}@example.test`;
      await expect(
        a.createOrganizationUser({
          organizationId: "org-cognivit-demo",
          actor,
          email,
          firstName: "Atomic",
          lastName: "Rollback",
          password: "SecurePass!1",
          roleCode: "AE",
          status: "ACTIVE",
          managerUserId: null,
          failAt: "audit",
        }),
      ).rejects.toThrow("injected:audit");
      expect(
        Number(
          (
            await pool.query(`SELECT count(*) FROM users WHERE email=$1`, [
              email,
            ])
          ).rows[0].count,
        ),
      ).toBe(0);
      const foreignManager = (
        await pool.query(
          `SELECT user_id FROM organization_memberships WHERE organization_id='org-globex' LIMIT 1`,
        )
      ).rows[0].user_id;
      await expect(
        a.createOrganizationUser({
          organizationId: "org-cognivit-demo",
          actor,
          email,
          firstName: "Wrong",
          lastName: "Tenant",
          password: "SecurePass!1",
          roleCode: "AE",
          status: "ACTIVE",
          managerUserId: foreignManager,
        }),
      ).rejects.toThrow("Select an active manager");
      await expect(
        a.createOrganizationUser({
          organizationId: "org-cognivit-demo",
          actor,
          email,
          firstName: "Invalid",
          lastName: "Reporting Line",
          password: "SecurePass!1",
          roleCode: "AE",
          status: "ACTIVE",
          managerUserId: "user-ae-sarah",
        }),
      ).rejects.toThrow("active management role");
      expect(
        Number(
          (
            await pool.query(`SELECT count(*) FROM users WHERE email=$1`, [
              email,
            ])
          ).rows[0].count,
        ),
      ).toBe(0);
    });

    it("conflicts stale organization metadata and rolls lifecycle back with audit", async () => {
      const slug = `metadata-${crypto.randomUUID()}`,
        boot = await a.bootstrap({
          actor,
          name: "Metadata Tenant",
          slug,
          primaryDomain: null,
          timezone: "UTC",
          fiscalYearStartMonth: 1,
          environment: "PRODUCTION",
          ownerEmail: `${slug}@example.test`,
          ownerFirstName: "Meta",
          ownerLastName: "Owner",
          useStandardOrgTemplate: false,
          idempotencyKey: slug,
        });
      const changes = await Promise.allSettled([
        a.updateOrganization({
          organizationId: boot.organizationId,
          actor,
          expectedVersion: 1,
          patch: { name: "Winner A" },
        }),
        b.updateOrganization({
          organizationId: boot.organizationId,
          actor,
          expectedVersion: 1,
          patch: { timezone: "America/New_York" },
        }),
      ]);
      expect(changes.filter((x) => x.status === "fulfilled")).toHaveLength(1);
      const current = (
        await pool.query(
          `SELECT status,version FROM organizations WHERE id=$1`,
          [boot.organizationId],
        )
      ).rows[0];
      await expect(
        a.updateOrganization({
          organizationId: boot.organizationId,
          actor,
          expectedVersion: current.version,
          patch: { status: "SUSPENDED" },
          failAt: "audit",
        }),
      ).rejects.toThrow("injected:audit");
      expect(
        (
          await pool.query(`SELECT status FROM organizations WHERE id=$1`, [
            boot.organizationId,
          ])
        ).rows[0].status,
      ).toBe("ACTIVE");
    });

    it("rotates owner invitations atomically and invalidates prior tokens", async () => {
      const slug = `rotate-${crypto.randomUUID()}`,
        boot = await a.bootstrap({
          actor,
          name: "Rotate Tenant",
          slug,
          primaryDomain: null,
          timezone: "UTC",
          fiscalYearStartMonth: 1,
          environment: "PRODUCTION",
          ownerEmail: `${slug}@example.test`,
          ownerFirstName: "Rotate",
          ownerLastName: "Owner",
          useStandardOrgTemplate: false,
          idempotencyKey: slug,
        }),
        before = (
          await pool.query(
            `SELECT token_hash FROM organization_invitations WHERE organization_id=$1`,
            [boot.organizationId],
          )
        ).rows[0].token_hash;
      await expect(
        a.rotateOwnerInvitation({
          organizationId: boot.organizationId,
          actor,
          failAt: "audit",
        }),
      ).rejects.toThrow("injected:audit");
      expect(
        (
          await pool.query(
            `SELECT token_hash FROM organization_invitations WHERE organization_id=$1`,
            [boot.organizationId],
          )
        ).rows[0].token_hash,
      ).toBe(before);
      const rotations = await Promise.all([
        a.rotateOwnerInvitation({ organizationId: boot.organizationId, actor }),
        b.rotateOwnerInvitation({ organizationId: boot.organizationId, actor }),
      ]);
      expect(
        Number(
          (
            await pool.query(
              `SELECT count(*) FROM organization_invitations WHERE organization_id=$1 AND admin_role='ORG_OWNER' AND status='PENDING'`,
              [boot.organizationId],
            )
          ).rows[0].count,
        ),
      ).toBe(1);
      await expect(
        a.acceptInvitation({
          token: boot.token!,
          firstName: "Old",
          lastName: "Token",
          password: "SecurePass!1",
        }),
      ).rejects.toThrow("invalid");
      const accepted = await Promise.allSettled(
        rotations.map((item) =>
          a.acceptInvitation({
            token: item.token,
            firstName: "New",
            lastName: "Token",
            password: "SecurePass!1",
          }),
        ),
      );
      expect(
        accepted.filter((item) => item.status === "fulfilled"),
      ).toHaveLength(1);
    });

    it("detects stale user profile updates while independent user creations survive", async () => {
      const suffix = crypto.randomUUID(),
        [one, two] = await Promise.all([
          a.createOrganizationUser({
            organizationId: "org-cognivit-demo",
            actor,
            email: `one-${suffix}@example.test`,
            firstName: "User",
            lastName: "One",
            password: "SecurePass!1",
            roleCode: "AE",
            status: "ACTIVE",
            managerUserId: null,
          }),
          b.createOrganizationUser({
            organizationId: "org-cognivit-demo",
            actor,
            email: `two-${suffix}@example.test`,
            firstName: "User",
            lastName: "Two",
            password: "SecurePass!1",
            roleCode: "AE",
            status: "ACTIVE",
            managerUserId: null,
          }),
        ]);
      expect(
        (
          await pool.query(
            `SELECT count(*) FROM users WHERE id=ANY($1::text[])`,
            [[one.userId, two.userId]],
          )
        ).rows[0].count,
      ).toBe("2");
      const version = (
          await pool.query(`SELECT version FROM users WHERE id=$1`, [
            one.userId,
          ])
        ).rows[0].version,
        edits = await Promise.allSettled([
          a.updateOrganizationUser({
            organizationId: "org-cognivit-demo",
            actor,
            userId: one.userId,
            expectedVersion: version,
            email: `one-a-${suffix}@example.test`,
            firstName: "A",
            lastName: "Winner",
            roleCode: "AE",
            status: "ACTIVE",
            managerUserId: null,
          }),
          b.updateOrganizationUser({
            organizationId: "org-cognivit-demo",
            actor,
            userId: one.userId,
            expectedVersion: version,
            email: `one-b-${suffix}@example.test`,
            firstName: "B",
            lastName: "Stale",
            roleCode: "AE",
            status: "ACTIVE",
            managerUserId: null,
          }),
        ]);
      expect(edits.filter((x) => x.status === "fulfilled")).toHaveLength(1);
    });

    it("serializes ownership transfer and rolls back transfer when audit fails", async () => {
      const slug = `transfer-${crypto.randomUUID()}`,
        boot = await a.bootstrap({
          actor,
          name: "Transfer Tenant",
          slug,
          primaryDomain: null,
          timezone: "UTC",
          fiscalYearStartMonth: 1,
          environment: "PRODUCTION",
          ownerEmail: `${slug}@example.test`,
          ownerFirstName: "Current",
          ownerLastName: "Owner",
          useStandardOrgTemplate: false,
          idempotencyKey: slug,
        });
      await a.acceptInvitation({
        token: boot.token!,
        firstName: "Current",
        lastName: "Owner",
        password: "SecurePass!1",
      });
      const owner = (
          await pool.query(
            `SELECT id FROM organization_memberships WHERE organization_id=$1 AND admin_role='ORG_OWNER'`,
            [boot.organizationId],
          )
        ).rows[0].id,
        targets = [] as string[];
      for (let i = 0; i < 2; i++) {
        const user = crypto.randomUUID(),
          membership = crypto.randomUUID();
        await pool.query(
          `INSERT INTO users(id,organization_id,email,first_name,last_name,display_name,role,status,is_demo_user,is_admin,password_hash,created_at,updated_at) VALUES($1,$2,$3,'Target',$4,'Target Owner','AE','ACTIVE',false,false,'x',now(),now())`,
          [user, boot.organizationId, `${user}@example.test`, String(i)],
        );
        await pool.query(
          `INSERT INTO organization_memberships(id,organization_id,user_id,admin_role,status,created_at,updated_at) VALUES($1,$2,$3,'MEMBER','ACTIVE',now(),now())`,
          [membership, boot.organizationId, user],
        );
        targets.push(membership);
      }
      await expect(
        a.transferOwnership({
          organizationId: boot.organizationId,
          actor,
          fromMembershipId: owner,
          toMembershipId: targets[0],
          demotePrevious: true,
          failAt: "audit",
        }),
      ).rejects.toThrow("injected:audit");
      expect(
        (
          await pool.query(
            `SELECT admin_role FROM organization_memberships WHERE id=$1`,
            [owner],
          )
        ).rows[0].admin_role,
      ).toBe("ORG_OWNER");
      const transfers = await Promise.allSettled([
        a.transferOwnership({
          organizationId: boot.organizationId,
          actor,
          fromMembershipId: owner,
          toMembershipId: targets[0],
          demotePrevious: true,
        }),
        b.transferOwnership({
          organizationId: boot.organizationId,
          actor,
          fromMembershipId: owner,
          toMembershipId: targets[1],
          demotePrevious: true,
        }),
      ]);
      expect(transfers.filter((x) => x.status === "fulfilled")).toHaveLength(1);
      expect(
        Number(
          (
            await pool.query(
              `SELECT count(*) FROM organization_memberships WHERE organization_id=$1 AND admin_role='ORG_OWNER' AND status='ACTIVE'`,
              [boot.organizationId],
            )
          ).rows[0].count,
        ),
      ).toBe(1);
    });
  },
);
