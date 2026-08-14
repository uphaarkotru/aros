import type {
  IdentityStore,
  Organization,
  RevenueRole,
  SecurityAuditEvent,
  User,
} from "./types";
import { defaultRoleNames, systemRoleTemplates } from "./system-role-templates";

const now = "2026-08-12T16:00:00.000Z";
const roleId = (organizationId: string, role: RevenueRole) =>
  `role-${organizationId}-${role.toLowerCase().replaceAll("_", "-")}`;
const membershipId = (organizationId: string, userId: string) =>
  `membership-${organizationId}-${userId}`;
export function migrateIdentityStore(
  input: Partial<IdentityStore> & {
    organizations?: Partial<Organization>[];
    users?: User[];
  },
): IdentityStore {
  const organizations = (input.organizations ?? []).map(
    (item) =>
      ({
        ...item,
        primaryDomain: item.primaryDomain ?? null,
        environment:
          item.environment ??
          (item.slug?.includes("demo") ? "DEMO" : "SANDBOX"),
        timezone: item.timezone ?? "America/Los_Angeles",
        fiscalYearStartMonth: item.fiscalYearStartMonth ?? 1,
        defaultMethodology: item.defaultMethodology ?? "MEDDPICC",
      }) as Organization,
  );
  const users = input.users ?? [];
  const memberships =
    input.memberships ??
    users.map((user) => ({
      id: membershipId(user.organizationId, user.id),
      organizationId: user.organizationId,
      userId: user.id,
      adminRole: user.isAdmin ? "ORG_OWNER" : "MEMBER",
      status: user.status === "ACTIVE" ? "ACTIVE" : "DEACTIVATED",
      joinedAt: user.createdAt,
      createdAt: user.createdAt,
      updatedAt: user.updatedAt,
    }));
  const organizationRoles =
    input.organizationRoles ??
    organizations.flatMap((org) =>
      systemRoleTemplates.map((template) => ({
        id: roleId(org.id, template.code),
        organizationId: org.id,
        name: defaultRoleNames[template.code],
        code: template.code,
        systemTemplateId: template.id,
        category: template.category,
        description: template.description,
        defaultExperienceKey: template.defaultExperienceKey,
        permissions: [],
        isSystemSeeded: true,
        isActive: true,
        createdAt: org.createdAt,
        updatedAt: org.updatedAt,
      })),
    );
  const roleAssignments =
    input.roleAssignments ??
    users.map((user) => ({
      id: `assignment-${user.organizationId}-${user.id}-${user.role}`,
      organizationId: user.organizationId,
      membershipId: membershipId(user.organizationId, user.id),
      organizationRoleDefinitionId: roleId(user.organizationId, user.role),
      isPrimary: true,
      effectiveFrom: user.createdAt,
      effectiveTo: null,
      createdAt: user.createdAt,
      updatedAt: user.updatedAt,
    }));
  const units =
    input.organizationalUnits ??
    (input.teams ?? []).map((team) => ({
      id: `unit-${team.id}`,
      organizationId: team.organizationId,
      name: team.name,
      type: "TEAM" as const,
      parentUnitId: team.parentTeamId ? `unit-${team.parentTeamId}` : null,
      leaderMembershipId: team.managerUserId
        ? membershipId(team.organizationId, team.managerUserId)
        : null,
      status: "ACTIVE" as const,
      createdAt: team.createdAt,
      updatedAt: team.updatedAt,
    }));
  const unitMemberships =
    input.unitMemberships ??
    users
      .filter((user) => user.teamId)
      .map((user) => ({
        id: `unit-membership-${user.id}`,
        organizationId: user.organizationId,
        membershipId: membershipId(user.organizationId, user.id),
        organizationalUnitId: `unit-${user.teamId}`,
        membershipType: null,
        isPrimary: true,
        createdAt: user.createdAt,
      }));
  const relationships =
    input.relationships ??
    users
      .filter((user) => user.managerUserId)
      .map((user) => ({
        id: `relationship-${user.id}-manager`,
        organizationId: user.organizationId,
        sourceMembershipId: membershipId(user.organizationId, user.id),
        targetMembershipId: membershipId(
          user.organizationId,
          user.managerUserId!,
        ),
        relationshipType: "REPORTS_TO" as const,
        isPrimary: true,
        effectiveFrom: user.createdAt,
        effectiveTo: null,
        metadata: null,
        createdAt: user.createdAt,
        updatedAt: user.updatedAt,
      }));
  const revenueTeamAssignments =
    input.revenueTeamAssignments ??
    (input.assignments ?? []).flatMap((assignment, index) => {
      const ids = [
        assignment.userId,
        ...(assignment.sharedWithUserIds ?? []),
        assignment.partnerUserId,
      ].filter(Boolean) as string[];
      return ids.flatMap((userId, memberIndex) => {
        const user = users.find((item) => item.id === userId),types = user?.role === "FIELD_CTO" ? ["TECHNICAL_EXECUTIVE","EXECUTIVE_SPONSOR"] as const : [user?.role === "PARTNER_SALES" ? "PARTNER" : user?.role === "SDR" ? "PROSPECTING" : user?.role === "SALES_ENGINEER" ? "SALES_ENGINEERING" : user?.role === "CUSTOMER_SUCCESS" ? "CUSTOMER_SUCCESS" : user?.role === "VALUE_ENGINEERING" ? "VALUE_ENGINEERING" : "PRIMARY_SELLER"] as const;
        return types.map((type,typeIndex)=>({
          id: `revenue-team-${index}-${memberIndex}${typeIndex?`-${typeIndex}`:""}`,
          organizationId: assignment.organizationId,
          accountId:
            assignment.resourceType === "account"
              ? assignment.resourceId
              : null,
          opportunityId:
            assignment.resourceType === "opportunity"
              ? assignment.resourceId
              : null,
          membershipId: membershipId(assignment.organizationId, userId),
          organizationRoleDefinitionId: user
            ? roleId(assignment.organizationId, user.role)
            : null,
          participationType: type,
          isPrimaryOwner: type === "PRIMARY_SELLER",
          createdAt: now,
        }));
      });
    });
  const auditEvents = (input.auditEvents ?? []).map(
    (event) =>
      ({
        ...event,
        actorAdminRole: event.actorAdminRole ?? null,
        actorPlatformRole: event.actorPlatformRole ?? null,
      }) as SecurityAuditEvent,
  );
  return {
    schemaVersion: 2,
    organizations,
    users: users.map((user) => ({
      ...user,
      platformRole: user.platformRole ?? null,
    })),
    memberships,
    systemRoleTemplates: input.systemRoleTemplates ?? systemRoleTemplates,
    organizationRoles,
    roleAssignments,
    organizationalUnits: units,
    unitMemberships,
    relationships,
    revenueTeamAssignments,
    invitations: input.invitations ?? [],
    integrations: input.integrations ?? [],
    governanceConfigurations:
      input.governanceConfigurations ??
      organizations.map((org) => ({
        organizationId: org.id,
        autonomyDefault: "RECOMMEND",
        requireHumanApproval: true,
        managerApprovalCategories: ["forecast", "customer-commitment"],
        demoModeAllowed: org.environment === "DEMO",
        auditRetentionDays: 365,
        updatedAt: org.updatedAt,
      })),
    teams: input.teams ?? [],
    regions: input.regions ?? [],
    sessions: input.sessions ?? [],
    assignments: input.assignments ?? [],
    auditEvents,
  };
}
export const legacyMembershipId = membershipId;
export const legacyRoleId = roleId;
