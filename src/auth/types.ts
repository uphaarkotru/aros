export const revenueRoles=["SDR","AE","RSM","SALES_ENGINEER","SALES_ENGINEER_MANAGER","PARTNER_SALES","VP_SALES","CRO","FIELD_CTO","CUSTOMER_SUCCESS","VALUE_ENGINEERING","PRODUCT_SPECIALIST","SERVICES","REVOPS","COMMERCIAL","FIELD_MARKETING"] as const;
export type RevenueRole=(typeof revenueRoles)[number];
export type UserStatus="ACTIVE"|"SUSPENDED"|"DEACTIVATED"|"INACTIVE";
export type PlatformRole="SUPER_ADMIN";
export type OrganizationStatus="PROVISIONING"|"ACTIVE"|"SUSPENDED"|"ARCHIVED"|"INACTIVE";
export type OrganizationEnvironment="DEMO"|"SANDBOX"|"PRODUCTION";
export type AdminRole="ORG_OWNER"|"ORG_ADMIN"|"MEMBER";
export type MembershipStatus="INVITED"|"ACTIVE"|"SUSPENDED"|"DEACTIVATED";
export type RoleCategory="SALES_DEVELOPMENT"|"SALES"|"SALES_ENGINEERING"|"PARTNERS"|"EXECUTIVE"|"REVENUE_OPERATIONS"|"CUSTOM";
export type OrganizationalUnitType="COMPANY"|"FUNCTION"|"BUSINESS_UNIT"|"REGION"|"SEGMENT"|"TEAM"|"POD"|"CUSTOM";
export type RelationshipType="REPORTS_TO"|"DOTTED_LINE_TO"|"TECHNICAL_SUPPORTS"|"OVERLAY_SUPPORTS"|"PARTNER_SUPPORTS"|"MENTORS";
export const participationTypes=["PRIMARY_SELLER","PROSPECTING","SALES_ENGINEERING","TECHNICAL_EXECUTIVE","CUSTOMER_SUCCESS","VALUE_ENGINEERING","PRODUCT_SPECIALIST","PARTNER","SERVICES","EXECUTIVE_SPONSOR","COMMERCIAL","MARKETING","OVERLAY","CUSTOM","OWNER","SDR_SUPPORT"] as const;
export type ParticipationType=(typeof participationTypes)[number];
export type Methodology="MEDDPICC"|"MEDDIC"|"CHALLENGER"|"SPICED"|"CUSTOM";
export type IntegrationStatus="NOT_CONFIGURED"|"CONFIGURED"|"CONNECTED"|"ERROR";

export interface Organization {id:string;name:string;slug:string;primaryDomain:string|null;status:OrganizationStatus;environment:OrganizationEnvironment;timezone:string;fiscalYearStartMonth:number|null;defaultMethodology:Methodology|null;createdAt:string;updatedAt:string;version?:number}
export interface User {id:string;email:string;firstName:string;lastName:string;displayName:string;avatarUrl:string|null;status:UserStatus;platformRole:PlatformRole|null;lastLoginAt:string|null;createdAt:string;updatedAt:string;passwordHash:string;isDemoUser:boolean;
 // Temporary compatibility projection. New authorization never trusts these fields.
 organizationId:string;role:RevenueRole;managerUserId:string|null;teamId:string|null;regionId:string|null;timezone:string|null;isAdmin:boolean;version?:number}
export interface OrganizationMembership {id:string;organizationId:string;userId:string;adminRole:AdminRole;status:MembershipStatus;joinedAt:string|null;createdAt:string;updatedAt:string;permissionOverrides?:Record<string,boolean>}
export interface SystemRoleTemplate {id:string;code:RevenueRole;name:string;category:RoleCategory;description:string;defaultExperienceKey:string;defaultPermissions:string[];capabilities:string[];isActive:boolean}
export interface OrganizationRoleDefinition {id:string;organizationId:string;name:string;code:string;systemTemplateId:string|null;category:RoleCategory;description:string|null;defaultExperienceKey:string|null;permissions:string[];isSystemSeeded:boolean;isActive:boolean;version?:number;createdAt:string;updatedAt:string}
export interface MembershipRoleAssignment {id:string;organizationId:string;membershipId:string;organizationRoleDefinitionId:string;isPrimary:boolean;effectiveFrom:string|null;effectiveTo:string|null;createdAt:string;updatedAt:string}
export interface OrganizationalUnit {id:string;organizationId:string;name:string;type:OrganizationalUnitType;parentUnitId:string|null;leaderMembershipId:string|null;status:"ACTIVE"|"INACTIVE";createdAt:string;updatedAt:string}
export interface MembershipOrganizationalUnit {id:string;organizationId:string;membershipId:string;organizationalUnitId:string;membershipType:string|null;isPrimary:boolean;createdAt:string}
export interface OrganizationRelationship {id:string;organizationId:string;sourceMembershipId:string;targetMembershipId:string;relationshipType:RelationshipType;isPrimary:boolean;effectiveFrom:string|null;effectiveTo:string|null;metadata:Record<string,unknown>|null;createdAt:string;updatedAt:string}
export interface RevenueTeamAssignment {id:string;organizationId:string;accountId:string|null;opportunityId:string|null;membershipId:string;organizationRoleDefinitionId:string|null;participationType:ParticipationType;isPrimaryOwner:boolean;createdAt:string}
export interface OrganizationInvitation {id:string;organizationId:string;email:string;adminRole:AdminRole;roleAssignmentIds:string[];organizationalUnitIds:string[];primaryManagerMembershipId:string|null;dottedLineManagerMembershipIds:string[];tokenHash:string;expiresAt:string;acceptedAt:string|null;invitedByUserId:string;status:"PENDING"|"ACCEPTED"|"EXPIRED"|"REVOKED";createdAt:string}
export interface TenantIntegration {id:string;organizationId:string;category:"CRM"|"CONVERSATIONS"|"EMAIL"|"CALENDAR"|"SALES_ENGAGEMENT"|"PRODUCT_USAGE"|"SUPPORT"|"PARTNER_ECOSYSTEM";provider:string|null;status:IntegrationStatus;updatedAt:string}
export interface GovernanceConfiguration {organizationId:string;autonomyDefault:"RECOMMEND"|"ASSIST";requireHumanApproval:boolean;managerApprovalCategories:string[];demoModeAllowed:boolean;auditRetentionDays:number;updatedAt:string}
export interface Session {id:string;tokenHash:string;userId:string;organizationId:string|null;viewAsRole:RevenueRole|null;createdAt:string;expiresAt:string;lastSeenAt:string}
export type ResourceType="account"|"opportunity"|"seller"|"partner"|"decision"|"commitment"|"forecast"|"organization"|"governance";
export interface ResourceAssignment {organizationId:string;resourceType:ResourceType;resourceId:string;userId?:string;teamId?:string;partnerUserId?:string;sharedWithUserIds?:string[]}
export interface SecurityAuditEvent {id:string;organizationId:string|null;actorUserId:string;actorRole:RevenueRole|null;actorAdminRole:AdminRole|null;actorPlatformRole:PlatformRole|null;event:string;resourceType:string;resourceId:string;timestamp:string;payload?:Record<string,unknown>;before?:Record<string,unknown>;after?:Record<string,unknown>}
export interface Team {id:string;organizationId:string;name:string;managerUserId:string|null;parentTeamId:string|null;type:string|null;createdAt:string;updatedAt:string}
export interface Region {id:string;organizationId:string;name:string;parentRegionId:string|null}
export interface IdentityStore {schemaVersion:number;organizations:Organization[];users:User[];memberships:OrganizationMembership[];systemRoleTemplates:SystemRoleTemplate[];organizationRoles:OrganizationRoleDefinition[];roleAssignments:MembershipRoleAssignment[];organizationalUnits:OrganizationalUnit[];unitMemberships:MembershipOrganizationalUnit[];relationships:OrganizationRelationship[];revenueTeamAssignments:RevenueTeamAssignment[];invitations:OrganizationInvitation[];integrations:TenantIntegration[];governanceConfigurations:GovernanceConfiguration[];teams:Team[];regions:Region[];sessions:Session[];assignments:ResourceAssignment[];auditEvents:SecurityAuditEvent[]}

export interface PublicUser {id:string;email:string;firstName:string;lastName:string;displayName:string;avatarUrl:string|null;status:UserStatus;platformRole:PlatformRole|null;lastLoginAt:string|null;isDemoUser:boolean;organizationId:string;role:RevenueRole;managerUserId:string|null;teamId:string|null;regionId:string|null;timezone:string|null;isAdmin:boolean;version?:number}
export function toPublicUser(user:User):PublicUser {return{id:user.id,email:user.email,firstName:user.firstName,lastName:user.lastName,displayName:user.displayName,avatarUrl:user.avatarUrl,status:user.status,platformRole:user.platformRole,lastLoginAt:user.lastLoginAt,isDemoUser:user.isDemoUser,organizationId:user.organizationId,role:user.role,managerUserId:user.managerUserId,teamId:user.teamId,regionId:user.regionId,timezone:user.timezone,isAdmin:user.isAdmin,version:user.version}}
