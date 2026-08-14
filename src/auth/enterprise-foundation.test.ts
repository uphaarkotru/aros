import { describe, expect, it } from "vitest";
import { createDemoIdentityStore } from "./seed";
import { MemoryIdentityRepository } from "./repository";
import {
  activeRoleAssignments,
  assignRevenueTeam,
  assignRole,
  changeMembershipAdminRole,
  createOrganizationRole,
  createOrganizationalUnit,
  createRelationship,
  moveOrganizationalUnit,
  provisionOrganization,
  updateOrganizationMetadata,
  updateOrganizationOwner,
  updateOrganizationRole,
} from "./tenant-model";
import { systemRoleTemplates } from "./system-role-templates";
import { getMembership, primaryRoleContext } from "./tenant-model";
import { getRevenueTeamMembers, getUserScope } from "./hierarchy";
import { permissions } from "./permissions";
import { resolvePermissions } from "./authorization";
const setup = () => {
  const repository = new MemoryIdentityRepository(createDemoIdentityStore()),
    store = repository.read(),
    owner = store.memberships.find((x) => x.userId === "user-org-admin")!,
    admin = store.users.find((x) => x.id === "user-org-admin")!;
  return { repository, owner, admin, store };
};
describe("enterprise multi-tenant foundation", () => {
  it("contains every system template including independent SE roles", () =>
    expect(systemRoleTemplates.map((x) => x.code)).toEqual([
      "SDR",
      "AE",
      "RSM",
      "SALES_ENGINEER",
      "SALES_ENGINEER_MANAGER",
      "PARTNER_SALES",
      "VP_SALES",
      "CRO",
      "FIELD_CTO",
      "CUSTOMER_SUCCESS",
      "VALUE_ENGINEERING",
      "PRODUCT_SPECIALIST",
      "SERVICES",
      "REVOPS",
      "COMMERCIAL",
      "FIELD_MARKETING",
    ]));
  it("creates a tenant with owner, roles, invitation, and optional standard graph", () => {
    const { repository } = setup(),
      actor = repository.findUserById("user-platform-admin")!,
      result = provisionOrganization(repository, actor, {
        name: "Acme",
        slug: "acme",
        primaryDomain: "acme.test",
        timezone: "UTC",
        environment: "PRODUCTION",
        ownerEmail: "owner@acme.test",
        ownerFirstName: "Ada",
        ownerLastName: "Owner",
        useStandardOrgTemplate: true,
      });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    const s = repository.read();
    expect(
      s.organizationRoles.filter(
        (x) => x.organizationId === result.value.organization.id,
      ),
    ).toHaveLength(systemRoleTemplates.length);
    expect(
      s.organizationalUnits.filter(
        (x) => x.organizationId === result.value.organization.id,
      ).length,
    ).toBeGreaterThan(1);
    expect(result.value.membership.adminRole).toBe("ORG_OWNER");
    expect(result.value.membership.status).toBe("INVITED");
    expect(
      s.users.filter((x) => x.organizationId === result.value.organization.id),
    ).toHaveLength(1);
  });
  it("rejects tenant provisioning by non-super-admin", () => {
    const { repository, admin } = setup();
    expect(
      provisionOrganization(repository, admin, {
        name: "Nope",
        slug: "nope",
        primaryDomain: null,
        timezone: "UTC",
        environment: "SANDBOX",
        ownerEmail: "x@y.test",
        ownerFirstName: "X",
        ownerLastName: "Y",
        useStandardOrgTemplate: true,
      }).ok,
    ).toBe(false);
  });
  it("lets platform admins update a tenant slug while preserving slug uniqueness", () => {
    const { repository } = setup(),
      actor = repository.findUserById("user-platform-admin")!,
      organization = repository.read().organizations[0],
      other = repository
        .read()
        .organizations.find((item) => item.id !== organization.id)!;
    const updated = updateOrganizationMetadata(
      repository,
      actor,
      organization.id,
      { slug: "Updated-Slug" },
    );
    expect(updated.ok && updated.value.slug).toBe("updated-slug");
    expect(
      updateOrganizationMetadata(repository, actor, organization.id, {
        slug: other.slug,
      }),
    ).toEqual({ ok: false, error: "Organization slug already exists." });
    expect(
      updateOrganizationMetadata(repository, actor, organization.id, {
        slug: "not valid",
      }).ok,
    ).toBe(false);
  });
  it("lets platform admins update the primary owner and pending invitation", () => {
    const { repository } = setup(),
      actor = repository.findUserById("user-platform-admin")!,
      organization = repository
        .read()
        .organizations.find((item) => item.id === "org-cognivit-demo")!,
      membership = repository
        .read()
        .memberships.find(
          (item) =>
            item.organizationId === organization.id &&
            item.adminRole === "ORG_OWNER",
        )!,
      owner = repository.findUserById(membership.userId)!;
    repository.update((store) =>
      store.invitations.push({
        id: "pending-owner-edit",
        organizationId: organization.id,
        email: owner.email,
        adminRole: "ORG_OWNER",
        roleAssignmentIds: [],
        organizationalUnitIds: [],
        primaryManagerMembershipId: null,
        dottedLineManagerMembershipIds: [],
        tokenHash: "test",
        expiresAt: new Date(Date.now() + 10000).toISOString(),
        acceptedAt: null,
        invitedByUserId: actor.id,
        status: "PENDING",
        createdAt: new Date().toISOString(),
      }),
    );
    const updated = updateOrganizationOwner(
      repository,
      actor,
      organization.id,
      { email: "new.owner@example.com", firstName: "New", lastName: "Owner" },
    );
    expect(updated.ok && updated.value.displayName).toBe("New Owner");
    expect(
      repository
        .read()
        .invitations.find((item) => item.id === "pending-owner-edit")?.email,
    ).toBe("new.owner@example.com");
    expect(
      updateOrganizationOwner(repository, actor, organization.id, {
        email: "michael.roberts@demo.cognivit.ai",
        firstName: "Duplicate",
        lastName: "Email",
      }).ok,
    ).toBe(false);
  });
  it("creates, renames, maps, and deactivates custom roles without title guessing", () => {
    const { repository, owner } = setup(),
      created = createOrganizationRole(repository, owner, {
        name: "Solutions Architect",
        code: "SOLUTIONS_ARCHITECT",
        category: "CUSTOM",
        description: null,
        systemTemplateId: null,
        defaultExperienceKey: null,
        permissions: [],
      });
    expect(created.ok).toBe(true);
    if (!created.ok) return;
    expect(created.value.systemTemplateId).toBeNull();
    const template = systemRoleTemplates.find(
        (x) => x.code === "SALES_ENGINEER",
      )!,
      updated = updateOrganizationRole(repository, owner, created.value.id, {
        name: "Field Solutions Architect",
        systemTemplateId: template.id,
        isActive: false,
      });
    expect(updated.ok && updated.value.name).toBe("Field Solutions Architect");
    expect(updated.ok && updated.value.systemTemplateId).toBe(template.id);
  });
  it("supports multiple assignments, one primary, and pure admins with none", () => {
    const { repository, owner } = setup(),
      membership = getMembership(
        repository,
        "user-ae-sarah",
        owner.organizationId,
      )!,
      partner = repository
        .read()
        .organizationRoles.find(
          (x) =>
            x.organizationId === owner.organizationId &&
            x.code === "PARTNER_SALES",
        )!,
      result = assignRole(repository, owner, membership.id, partner.id, true);
    expect(result.ok).toBe(true);
    expect(activeRoleAssignments(repository, membership.id)).toHaveLength(2);
    expect(
      activeRoleAssignments(repository, membership.id).filter(
        (x) => x.isPrimary,
      ),
    ).toHaveLength(1);
    expect(primaryRoleContext(repository, membership.id).template?.code).toBe(
      "PARTNER_SALES",
    );
    expect(activeRoleAssignments(repository, owner.id)).toHaveLength(1);
  });
  it("supports nested units and prevents direct and indirect unit cycles", () => {
    const { repository, owner } = setup(),
      a = createOrganizationalUnit(repository, owner, {
        name: "Marketing",
        type: "FUNCTION",
        parentUnitId: null,
        leaderMembershipId: null,
      }),
      b = a.ok
        ? createOrganizationalUnit(repository, owner, {
            name: "Demand Gen",
            type: "TEAM",
            parentUnitId: a.value.id,
            leaderMembershipId: null,
          })
        : a;
    expect(a.ok && b.ok).toBe(true);
    if (!a.ok || !b.ok) return;
    expect(
      moveOrganizationalUnit(repository, owner, a.value.id, b.value.id).ok,
    ).toBe(false);
  });
  it("allows parallel and dotted reporting but rejects self, direct, indirect, and cross-tenant cycles", () => {
    const { repository, owner } = setup(),
      s = repository.read(),
      sarah = getMembership(repository, "user-ae-sarah", owner.organizationId)!,
      raj = getMembership(repository, "user-se-raj", owner.organizationId)!,
      anita = getMembership(
        repository,
        "user-se-manager-anita",
        owner.organizationId,
      )!,
      other = s.memberships.find(
        (x) => x.organizationId === "org-isolation-test",
      )!;
    expect(
      createRelationship(repository, owner, {
        sourceMembershipId: raj.id,
        targetMembershipId: sarah.id,
        relationshipType: "DOTTED_LINE_TO",
        isPrimary: false,
        metadata: null,
      }).ok,
    ).toBe(true);
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
        sourceMembershipId: sarah.id,
        targetMembershipId: other.id,
        relationshipType: "DOTTED_LINE_TO",
        isPrimary: false,
        metadata: null,
      }).ok,
    ).toBe(false);
  });
  it("keeps reporting and Coinbase collaboration independent", () => {
    const { repository } = setup(),
      team = getRevenueTeamMembers(repository, "org-cognivit-demo", {
        opportunityId: "opp-coinbase-renewal",
      });
    expect(team.map((x) => x.user?.id)).toEqual(
      expect.arrayContaining([
        "user-ae-sarah",
        "user-se-raj",
        "user-sdr-alex",
        "user-partner-priya",
      ]),
    );
    expect(getUserScope(repository, "user-se-raj")?.opportunityIds).toContain(
      "opp-coinbase-renewal",
    );
    expect(getUserScope(repository, "user-sdr-alex")?.opportunityIds).toContain(
      "opp-coinbase-renewal",
    );
  });
  it("isolates role, relationship, revenue-team, and resource IDs by tenant", () => {
    const { repository, owner } = setup(),
      otherRole = repository
        .read()
        .organizationRoles.find(
          (x) => x.organizationId === "org-isolation-test",
        )!,
      otherMember = repository
        .read()
        .memberships.find((x) => x.organizationId === "org-isolation-test")!;
    expect(
      assignRole(repository, owner, owner.id, otherRole.id, false).ok,
    ).toBe(false);
    expect(
      assignRevenueTeam(repository, owner, {
        accountId: "acct-other-tenant",
        opportunityId: null,
        membershipId: otherMember.id,
        organizationRoleDefinitionId: null,
        participationType: "OWNER",
        isPrimaryOwner: true,
      }).ok,
    ).toBe(false);
  });
  it("keeps admin authority separate from revenue authority", () => {
    const { repository, owner } = setup(),
      permissionsForAdmin = resolvePermissions(
        repository,
        repository.findUserById("user-org-admin")!,
        owner,
      );
    expect(permissionsForAdmin.has(permissions.userInvite)).toBe(true);
    repository.update(
      (s) =>
        (s.roleAssignments = s.roleAssignments.filter(
          (x) => x.membershipId !== owner.id,
        )),
    );
    const resolved = resolvePermissions(
      repository,
      repository.findUserById("user-org-admin")!,
      owner,
    );
    expect(resolved.has(permissions.managerDecisionApprove)).toBe(false);
    expect(resolved.has(permissions.userInvite)).toBe(true);
  });
  it("protects the last active owner and prevents admins assigning owners", () => {
    const { repository, owner } = setup();
    expect(
      changeMembershipAdminRole(repository, owner, owner.id, "ORG_ADMIN").ok,
    ).toBe(false);
    const adminMembership = repository
      .read()
      .memberships.find((x) => x.userId === "user-ae-sarah")!;
    repository.update(
      (s) =>
        (s.memberships = s.memberships.map((x) =>
          x.id === adminMembership.id ? { ...x, adminRole: "ORG_ADMIN" } : x,
        )),
    );
    expect(
      changeMembershipAdminRole(
        repository,
        { ...adminMembership, adminRole: "ORG_ADMIN" },
        adminMembership.id,
        "ORG_OWNER",
      ).ok,
    ).toBe(false);
  });
});
