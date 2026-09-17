import type { Organization, OrganizationMembership, User } from "./types";

export function canAdministerDemo(
  organization: Pick<Organization, "id" | "environment">,
  membership: Pick<OrganizationMembership, "adminRole">,
  actor: Pick<User, "platformRole">,
) {
  return (
    organization.environment === "DEMO" &&
    (membership.adminRole === "ORG_OWNER" ||
      membership.adminRole === "ORG_ADMIN" ||
      actor.platformRole === "SUPER_ADMIN")
  );
}

export function isProductionDemoFeatureEnabled(flag: string | undefined) {
  return process.env.NODE_ENV !== "production" || flag === "true";
}
