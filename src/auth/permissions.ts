import type { RevenueRole } from "./types";

export const permissions = {
  platformOrganizationCreate:"platform.organization.create",platformOrganizationRead:"platform.organization.read",platformOrganizationManage:"platform.organization.manage",platformOrganizationSuspend:"platform.organization.suspend",
  organizationSettingsRead:"organization.settings.read",organizationSettingsUpdate:"organization.settings.update",userInvite:"user.invite",userRead:"user.read",userUpdate:"user.update",userDeactivate:"user.deactivate",roleRead:"role.read",roleCreate:"role.create",roleUpdate:"role.update",roleAssign:"role.assign",orgUnitRead:"org_unit.read",orgUnitCreate:"org_unit.create",orgUnitUpdate:"org_unit.update",relationshipRead:"relationship.read",relationshipCreate:"relationship.create",relationshipUpdate:"relationship.update",integrationConfigure:"integration.configure",methodologyConfigure:"methodology.configure",governanceConfigure:"governance.configure",auditRead:"audit.read",
  accountRead:"account.read", accountUpdate:"account.update", opportunityRead:"opportunity.read", opportunityUpdate:"opportunity.update",
  sellerRead:"seller.read", sellerCoach:"seller.coach", commitmentCreate:"commitment.create", commitmentUpdate:"commitment.update",
  managerDecisionApprove:"manager_decision.approve", forecastRead:"forecast.read", forecastManage:"forecast.manage",
  partnerRead:"partner.read", partnerManage:"partner.manage", organizationRead:"organization.read", governanceRead:"governance.read",
  prospectingManage:"prospecting.manage", activityCreate:"activity.create", recommendationApprove:"recommendation.approve",
  leadershipDecision:"leadership_decision.manage", demoViewAs:"demo.view_as",
} as const;
export type Permission = (typeof permissions)[keyof typeof permissions];

const commonSeller:Permission[]=[permissions.accountRead,permissions.opportunityRead,permissions.commitmentCreate,permissions.commitmentUpdate,permissions.activityCreate];
export const rolePermissions:Record<RevenueRole,ReadonlySet<Permission>>={
  SDR:new Set([...commonSeller,permissions.prospectingManage]),
  AE:new Set([...commonSeller,permissions.accountUpdate,permissions.opportunityUpdate,permissions.recommendationApprove]),
  RSM:new Set([...commonSeller,permissions.accountUpdate,permissions.opportunityUpdate,permissions.sellerRead,permissions.sellerCoach,permissions.managerDecisionApprove,permissions.forecastRead]),
  SALES_ENGINEER:new Set([permissions.accountRead,permissions.opportunityRead,permissions.commitmentCreate,permissions.commitmentUpdate,permissions.activityCreate]),
  SALES_ENGINEER_MANAGER:new Set([permissions.accountRead,permissions.opportunityRead,permissions.sellerRead,permissions.sellerCoach,permissions.commitmentCreate,permissions.commitmentUpdate]),
  PARTNER_SALES:new Set([...commonSeller,permissions.partnerRead,permissions.partnerManage]),
  VP_SALES:new Set([...commonSeller,permissions.accountUpdate,permissions.opportunityUpdate,permissions.sellerRead,permissions.sellerCoach,permissions.managerDecisionApprove,permissions.forecastRead,permissions.forecastManage,permissions.organizationRead]),
  CRO:new Set([...commonSeller,permissions.accountUpdate,permissions.opportunityUpdate,permissions.sellerRead,permissions.sellerCoach,permissions.managerDecisionApprove,permissions.forecastRead,permissions.forecastManage,permissions.partnerRead,permissions.organizationRead,permissions.governanceRead,permissions.recommendationApprove,permissions.leadershipDecision]),
};
export function hasPermission(role:RevenueRole,permission:Permission){return rolePermissions[role].has(permission)}

export const roleDisplay:Record<RevenueRole,string>={SDR:"SDR",AE:"AE",RSM:"RSM",SALES_ENGINEER:"Sales Engineer",SALES_ENGINEER_MANAGER:"SE Manager",PARTNER_SALES:"Partner Sales",VP_SALES:"VP Sales",CRO:"CRO"};
export const todayPath:Record<RevenueRole,string>={SDR:"/today/sdr",AE:"/today/ae",RSM:"/today/rsm",SALES_ENGINEER:"/today/shared",SALES_ENGINEER_MANAGER:"/today/shared",PARTNER_SALES:"/today/partner",VP_SALES:"/today/vp-sales",CRO:"/today/cro"};
