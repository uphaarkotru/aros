import type { Organization } from "./types";

export type ApplicationMode = "DEMO" | "PRODUCTION";

/** Organization.environment is the only runtime source of demo authority. */
export function isDemoOrganization(
  organization: Pick<Organization, "environment">,
) {
  return organization.environment === "DEMO";
}
