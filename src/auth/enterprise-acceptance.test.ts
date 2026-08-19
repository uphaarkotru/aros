import { describe, expect, it } from "vitest";
import { createDemoIdentityStore, DEMO_PASSWORD } from "./seed";
import { MemoryIdentityRepository } from "./repository";
import {
  assignMembershipToUnit,
  assignRevenueTeam,
  assignRole,
  changeMembershipAdminRole,
  changeOrganizationLifecycle,
  createOrganizationRole,
  createOrganizationalUnit,
  createRelationship,
  getMembership,
  inviteOrganizationUser,
  moveOrganizationalUnit,
  primaryRoleContext,
  removeMembershipFromUnit,
  removeRelationship,
  removeRole,
  updateOrganizationalUnit,
  updateOrganizationRole,
  acceptOrganizationInvitation,
} from "./tenant-model";
import { authorizeResource, resolvePermissions } from "./authorization";
import { permissions, todayPath } from "./permissions";
import {
  getAllDescendants,
  getDottedLineRelationships,
  getManagerChain,
  getRevenueTeamMembers,
  getSESupportedOpportunitiesForManager,
  getUserScope,
} from "./hierarchy";
import { authenticateTenantCredentials } from "./authenticate";
import { buildAuditEvent } from "./audit.server";
import type { RevenueRole, User } from "./types";

function setup() {
  const store = createDemoIdentityStore();
  store.organizations = store.organizations.map((item) =>
    item.id === "org-cognivit-demo"
      ? { ...item, name: "Acme Software", slug: "acme-software" }
      : { ...item, name: "Globex Technologies", slug: "globex-technologies" },
  );
  const repository = new MemoryIdentityRepository(store),
    owner = getMembership(repository, "user-org-admin", "org-cognivit-demo")!,
    platform = repository.findUserById("user-platform-admin")!;
  return {
    repository,
    owner,
    platform,
    user: (id: string) => repository.findUserById(id)!,
  };
}
const role = (
  repository: MemoryIdentityRepository,
  organizationId: string,
  code: RevenueRole,
) =>
  repository
    .read()
    .organizationRoles.find(
      (item) => item.organizationId === organizationId && item.code === code,
    )!;

describe("enterprise foundation acceptance gate", () => {
  it("rejects adversarial cross-tenant IDs across every tenant-owned graph", () => {
    const { repository, owner, user } = setup(),
      otherMembership = repository
        .read()
        .memberships.find(
          (item) => item.organizationId === "org-isolation-test",
        )!,
      otherRole = repository
        .read()
        .organizationRoles.find(
          (item) => item.organizationId === "org-isolation-test",
        )!,
      otherUnit = repository
        .read()
        .organizationalUnits.find(
          (item) => item.organizationId === "org-isolation-test",
        );
    expect(
      assignRole(repository, owner, otherMembership.id, otherRole.id, true).ok,
    ).toBe(false);
    if (otherUnit)
      expect(
        assignMembershipToUnit(repository, owner, owner.id, otherUnit.id).ok,
      ).toBe(false);
    expect(
      createRelationship(repository, owner, {
        sourceMembershipId: owner.id,
        targetMembershipId: otherMembership.id,
        relationshipType: "REPORTS_TO",
        isPrimary: true,
        metadata: null,
      }).ok,
    ).toBe(false);
    expect(
      assignRevenueTeam(repository, owner, {
        accountId: "acct-other-tenant",
        opportunityId: null,
        membershipId: owner.id,
        organizationRoleDefinitionId: null,
        participationType: "OWNER",
        isPrimaryOwner: true,
      }).ok,
    ).toBe(false);
    expect(
      authorizeResource(
        repository,
        user("user-ae-sarah"),
        permissions.accountRead,
        "account",
        "acct-other-tenant",
        "org-isolation-test",
      ),
    ).toBe(false);
    expect(
      getRevenueTeamMembers(repository, "org-cognivit-demo", {
        accountId: "acct-other-tenant",
      }),
    ).toHaveLength(0);
  });
  it("keeps platform authority, tenant admin, and revenue authority separate", () => {
    const { repository, platform, owner, user } = setup();
    const platformAccess = resolvePermissions(
      repository,
      platform,
      getMembership(repository, platform.id, "org-cognivit-demo"),
    );
    expect(platformAccess.has(permissions.platformOrganizationManage)).toBe(
      true,
    );
    expect(platformAccess.has(permissions.forecastManage)).toBe(false);
    const croMembership = getMembership(
        repository,
        "user-cro-michael",
        owner.organizationId,
      )!,
      croAccess = resolvePermissions(
        repository,
        user("user-cro-michael"),
        croMembership,
      );
    expect(croAccess.has(permissions.forecastManage)).toBe(true);
    expect(croAccess.has(permissions.platformOrganizationManage)).toBe(false);
    expect(croAccess.has(permissions.userInvite)).toBe(false);
    repository.update(
      (store) =>
        (store.roleAssignments = store.roleAssignments.filter(
          (item) => item.membershipId !== owner.id,
        )),
    );
    const adminAccess = resolvePermissions(
      repository,
      user("user-org-admin"),
      owner,
    );
    expect(adminAccess.has(permissions.userInvite)).toBe(true);
    expect(adminAccess.has(permissions.managerDecisionApprove)).toBe(false);
    expect(adminAccess.has(permissions.sellerCoach)).toBe(false);
  });
  it("protects the last owner and permits explicit two-owner transfer", () => {
    const { repository, owner } = setup(),
      target = getMembership(
        repository,
        "user-ae-sarah",
        owner.organizationId,
      )!;
    expect(
      changeMembershipAdminRole(repository, owner, owner.id, "ORG_ADMIN").ok,
    ).toBe(false);
    expect(
      changeMembershipAdminRole(repository, owner, target.id, "ORG_OWNER").ok,
    ).toBe(true);
    expect(
      changeMembershipAdminRole(repository, owner, owner.id, "ORG_ADMIN").ok,
    ).toBe(true);
    const promoted = getMembership(
      repository,
      target.userId,
      owner.organizationId,
    )!;
    expect(
      changeMembershipAdminRole(
        repository,
        promoted,
        owner.id,
        "MEMBER",
        "DEACTIVATED",
      ).ok,
    ).toBe(true);
  });
  it("supports custom roles, stable rename mapping, multiple roles, explicit permissions, and one primary", () => {
    const { repository, owner } = setup(),
      sarah = getMembership(repository, "user-ae-sarah", owner.organizationId)!,
      strategic = createOrganizationRole(repository, owner, {
        name: "Strategic Account Director",
        code: "STRATEGIC_ACCOUNT_DIRECTOR",
        category: "CUSTOM",
        description: null,
        systemTemplateId: repository
          .read()
          .systemRoleTemplates.find((item) => item.code === "AE")!.id,
        defaultExperienceKey: "/today/ae",
        permissions: [],
      }),
      fieldCto = createOrganizationRole(repository, owner, {
        name: "Field CTO",
        code: "FIELD_CTO_ADVISOR",
        category: "CUSTOM",
        description: null,
        systemTemplateId: null,
        defaultExperienceKey: "/today/shared",
        permissions: [permissions.accountRead],
      });
    expect(strategic.ok && fieldCto.ok).toBe(true);
    if (!strategic.ok || !fieldCto.ok) return;
    const assigned = assignRole(
        repository,
        owner,
        sarah.id,
        strategic.value.id,
        true,
      ),
      secondary = assignRole(
        repository,
        owner,
        sarah.id,
        fieldCto.value.id,
        false,
      );
    expect(assigned.ok && secondary.ok).toBe(true);
    expect(
      repository
        .read()
        .roleAssignments.filter(
          (item) =>
            item.membershipId === sarah.id &&
            item.effectiveTo === null &&
            item.isPrimary,
        ),
    ).toHaveLength(1);
    const beforeId = strategic.value.id,
      renamed = updateOrganizationRole(repository, owner, beforeId, {
        name: "Enterprise Director",
      });
    expect(renamed.ok && renamed.value.id).toBe(beforeId);
    expect(primaryRoleContext(repository, sarah.id).template?.code).toBe("AE");
    expect(
      resolvePermissions(
        repository,
        repository.findUserById(sarah.userId)!,
        sarah,
      ).has(permissions.accountRead),
    ).toBe(true);
    expect(
      removeRole(repository, owner, secondary.ok ? secondary.value.id : "").ok,
    ).toBe(true);
    expect(primaryRoleContext(repository, sarah.id).template?.code).toBe("AE");
  });
  it("supports flexible units, membership assignment, updates, moves, deactivation, and cycle rejection", () => {
    const { repository, owner } = setup(),
      company = createOrganizationalUnit(repository, owner, {
        name: "Acme Software",
        type: "COMPANY",
        parentUnitId: null,
        leaderMembershipId: owner.id,
      });
    if (!company.ok) return;
    const sales = createOrganizationalUnit(repository, owner, {
      name: "Sales",
      type: "FUNCTION",
      parentUnitId: company.value.id,
      leaderMembershipId: null,
    });
    if (!sales.ok) return;
    const enterprise = createOrganizationalUnit(repository, owner, {
      name: "Enterprise",
      type: "BUSINESS_UNIT",
      parentUnitId: sales.value.id,
      leaderMembershipId: null,
    });
    if (!enterprise.ok) return;
    const west = createOrganizationalUnit(repository, owner, {
      name: "West",
      type: "REGION",
      parentUnitId: enterprise.value.id,
      leaderMembershipId: null,
    });
    if (!west.ok) return;
    expect(
      moveOrganizationalUnit(
        repository,
        owner,
        enterprise.value.id,
        west.value.id,
      ).ok,
    ).toBe(false);
    const sarah = getMembership(
        repository,
        "user-ae-sarah",
        owner.organizationId,
      )!,
      unitAssignment = assignMembershipToUnit(
        repository,
        owner,
        sarah.id,
        west.value.id,
        true,
      );
    expect(unitAssignment.ok).toBe(true);
    expect(
      updateOrganizationalUnit(repository, owner, west.value.id, {
        name: "Western Region",
        leaderMembershipId: sarah.id,
        status: "INACTIVE",
      }).ok,
    ).toBe(true);
    expect(
      unitAssignment.ok &&
        removeMembershipFromUnit(repository, owner, unitAssignment.value.id).ok,
    ).toBe(true);
  });
  it("supports parallel reporting, dotted lines, and blocks self, direct, and indirect cycles", () => {
    const { repository, owner } = setup(),
      raj = getMembership(repository, "user-se-raj", owner.organizationId)!,
      anita = getMembership(
        repository,
        "user-se-manager-anita",
        owner.organizationId,
      )!,
      mark = getMembership(repository, "user-rsm-mark", owner.organizationId)!,
      sarah = getMembership(repository, "user-ae-sarah", owner.organizationId)!;
    expect(
      getManagerChain(repository, "user-se-raj", owner.organizationId).map(
        (item) => item.id,
      ),
    ).toEqual(["user-se-manager-anita", "user-cro-michael"]);
    const dotted = createRelationship(repository, owner, {
      sourceMembershipId: raj.id,
      targetMembershipId: mark.id,
      relationshipType: "DOTTED_LINE_TO",
      isPrimary: false,
      metadata: null,
    });
    expect(dotted.ok).toBe(true);
    expect(
      getDottedLineRelationships(
        repository,
        "user-se-raj",
        owner.organizationId,
      ),
    ).toHaveLength(1);
    expect(
      createRelationship(repository, owner, {
        sourceMembershipId: raj.id,
        targetMembershipId: raj.id,
        relationshipType: "REPORTS_TO",
        isPrimary: true,
        metadata: null,
      }).ok,
    ).toBe(false);
    expect(
      createRelationship(repository, owner, {
        sourceMembershipId: anita.id,
        targetMembershipId: raj.id,
        relationshipType: "REPORTS_TO",
        isPrimary: false,
        metadata: null,
      }).ok,
    ).toBe(false);
    expect(
      createRelationship(repository, owner, {
        sourceMembershipId: mark.id,
        targetMembershipId: sarah.id,
        relationshipType: "REPORTS_TO",
        isPrimary: false,
        metadata: null,
      }).ok,
    ).toBe(false);
  });
  it("keeps cross-functional Coinbase collaboration independent from reporting", () => {
    const { repository, owner } = setup(),
      raj = getMembership(repository, "user-se-raj", owner.organizationId)!,
      mark = getMembership(repository, "user-rsm-mark", owner.organizationId)!;
    const dotted = createRelationship(repository, owner, {
      sourceMembershipId: raj.id,
      targetMembershipId: mark.id,
      relationshipType: "DOTTED_LINE_TO",
      isPrimary: false,
      metadata: null,
    });
    expect(dotted.ok).toBe(true);
    expect(
      getUserScope(repository, "user-se-raj", owner.organizationId)?.accountIds,
    ).toContain("acct-coinbase");
    if (dotted.ok)
      expect(removeRelationship(repository, owner, dotted.value.id).ok).toBe(
        true,
      );
    expect(
      getUserScope(repository, "user-se-raj", owner.organizationId)?.accountIds,
    ).toContain("acct-coinbase");
    expect(
      getRevenueTeamMembers(repository, owner.organizationId, {
        opportunityId: "opp-coinbase-renewal",
      }).map((item) => item.user?.id),
    ).toEqual(
      expect.arrayContaining([
        "user-ae-sarah",
        "user-se-raj",
        "user-sdr-alex",
        "user-partner-priya",
      ]),
    );
    expect(
      getSESupportedOpportunitiesForManager(
        repository,
        "user-se-manager-anita",
        owner.organizationId,
      ),
    ).toContain("opp-coinbase-renewal");
    expect(
      resolvePermissions(
        repository,
        repository.findUserById(raj.userId)!,
        raj,
      ).has(permissions.forecastManage),
    ).toBe(false);
  });
  it("keeps SDR semantics and access while SDR reports through Marketing", () => {
    const { repository, owner } = setup(),
      alex = getMembership(repository, "user-sdr-alex", owner.organizationId)!;
    expect(primaryRoleContext(repository, alex.id).template?.code).toBe("SDR");
    expect(todayPath.SDR).toBe("/today/sdr");
    expect(
      getManagerChain(repository, "user-sdr-alex", owner.organizationId)[0]?.id,
    ).toBe("user-sdr-manager-david");
    expect(
      getUserScope(repository, "user-sdr-alex", owner.organizationId)
        ?.accountIds,
    ).toContain("acct-coinbase");
  });
  it("completes minimal and rich invitations without cross-tenant configuration", () => {
    const { repository, owner, user } = setup(),
      minimal = inviteOrganizationUser(
        repository,
        user("user-org-admin"),
        owner,
        {
          email: "minimal@acme.test",
          adminRole: "MEMBER",
          roleAssignmentIds: [],
          organizationalUnitIds: [],
          primaryManagerMembershipId: null,
          dottedLineManagerMembershipIds: [],
        },
      );
    expect(minimal.ok).toBe(true);
    if (!minimal.ok) return;
    const accepted = acceptOrganizationInvitation(repository, {
      token: minimal.value.token,
      firstName: "Minimal",
      lastName: "Member",
      password: "SecurePass!1",
    });
    expect(accepted.ok && accepted.value.membership.status).toBe("ACTIVE");
    if (accepted.ok)
      expect(
        primaryRoleContext(repository, accepted.value.membership.id).definition,
      ).toBeUndefined();
    const aeRole = role(repository, owner.organizationId, "AE"),
      unit = repository
        .read()
        .organizationalUnits.find(
          (item) => item.organizationId === owner.organizationId,
        )!,
      manager = getMembership(
        repository,
        "user-rsm-mark",
        owner.organizationId,
      )!,
      rich = inviteOrganizationUser(repository, user("user-org-admin"), owner, {
        email: "rich@acme.test",
        adminRole: "MEMBER",
        roleAssignmentIds: [aeRole.id],
        organizationalUnitIds: [unit.id],
        primaryManagerMembershipId: manager.id,
        dottedLineManagerMembershipIds: [],
      });
    expect(rich.ok).toBe(true);
    if (!rich.ok) return;
    const richAccepted = acceptOrganizationInvitation(repository, {
      token: rich.value.token,
      firstName: "Rich",
      lastName: "Member",
      password: "SecurePass!1",
    });
    expect(richAccepted.ok).toBe(true);
    if (richAccepted.ok) {
      expect(
        primaryRoleContext(repository, richAccepted.value.membership.id)
          .template?.code,
      ).toBe("AE");
      expect(
        repository
          .read()
          .unitMemberships.some(
            (item) =>
              item.membershipId === richAccepted.value.membership.id &&
              item.organizationalUnitId === unit.id,
          ),
      ).toBe(true);
      expect(
        getManagerChain(
          repository,
          richAccepted.value.user.id,
          owner.organizationId,
        )[0]?.id,
      ).toBe("user-rsm-mark");
    }
  });
  it("rejects suspended organizations without deleting data while preserving platform recovery", () => {
    const { repository, platform } = setup(),
      before = repository.read().revenueTeamAssignments.length;
    expect(
      authenticateTenantCredentials(
        repository,
        "sarah.chen@demo.cognivit.ai",
        DEMO_PASSWORD,
        "acme-software",
      ),
    ).not.toBeNull();
    expect(
      changeOrganizationLifecycle(
        repository,
        platform,
        "org-cognivit-demo",
        "SUSPENDED",
      ).ok,
    ).toBe(true);
    expect(
      authenticateTenantCredentials(
        repository,
        "sarah.chen@demo.cognivit.ai",
        DEMO_PASSWORD,
        "acme-software",
      ),
    ).toBeNull();
    expect(
      authenticateTenantCredentials(
        repository,
        "platform.admin@cognivit.ai",
        DEMO_PASSWORD,
        "acme-software",
      ),
    ).toBeNull();
    expect(repository.read().revenueTeamAssignments).toHaveLength(before);
    expect(
      changeOrganizationLifecycle(
        repository,
        platform,
        "org-cognivit-demo",
        "ACTIVE",
      ).ok,
    ).toBe(true);
    expect(
      authenticateTenantCredentials(
        repository,
        "sarah.chen@demo.cognivit.ai",
        DEMO_PASSWORD,
        "acme-software",
      ),
    ).not.toBeNull();
  });
  it("creates tenant-context audit snapshots with semantic and administrative authority", () => {
    const { repository, owner, user } = setup(),
      event = buildAuditEvent(
        repository,
        user("user-org-admin"),
        owner.organizationId,
        {
          event: "ROLE_RENAMED",
          resourceType: "role",
          resourceId: "role-1",
          before: { name: "Regional Sales Manager" },
          after: { name: "Regional Director" },
        },
      );
    expect(event.organizationId).toBe(owner.organizationId);
    expect(event.actorAdminRole).toBe("ORG_OWNER");
    expect(event.actorRole).toBe("REVOPS");
    expect(event.before).toEqual({ name: "Regional Sales Manager" });
    expect(event.timestamp).toBeTruthy();
  });
  it("traverses a large hierarchy in one in-memory graph pass", () => {
    const { repository, owner } = setup(),
      now = new Date().toISOString(),
      root = getMembership(
        repository,
        "user-cro-michael",
        owner.organizationId,
      )!;
    let parent = root.id;
    repository.update((store) => {
      for (let index = 0; index < 1000; index++) {
        const userId = `synthetic-${index}`,
          membershipId = `synthetic-membership-${index}`;
        store.users.push({
          ...(store.users[0] as User),
          id: userId,
          email: `${userId}@acme.test`,
          displayName: userId,
          platformRole: null,
          organizationId: owner.organizationId,
          isDemoUser: false,
        });
        store.memberships.push({
          id: membershipId,
          organizationId: owner.organizationId,
          userId,
          adminRole: "MEMBER",
          status: "ACTIVE",
          joinedAt: now,
          createdAt: now,
          updatedAt: now,
        });
        store.relationships.push({
          id: `synthetic-edge-${index}`,
          organizationId: owner.organizationId,
          sourceMembershipId: membershipId,
          targetMembershipId: parent,
          relationshipType: "REPORTS_TO",
          isPrimary: true,
          effectiveFrom: now,
          effectiveTo: null,
          metadata: null,
          createdAt: now,
          updatedAt: now,
        });
        parent = membershipId;
      }
    });
    const started = performance.now(),
      descendants = getAllDescendants(
        repository,
        "user-cro-michael",
        owner.organizationId,
      ),
      elapsed = performance.now() - started;
    expect(descendants.length).toBeGreaterThanOrEqual(1000);
    expect(elapsed).toBeLessThan(500);
  });
});
