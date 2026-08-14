import { NextResponse } from "next/server";
import {
  getAuthenticatedIdentity,
  getRawSessionUser,
} from "@/auth/session.server";
import {flushIdentityRepository,identityCommands,identityRepository} from "@/auth/repository.server";
import {ConcurrencyConflictError} from "@/db/identity-commands";
import {
  assignMembershipToUnit,
  assignRevenueTeam,
  assignRole,
  changeMembershipAdminRole,
  createOrganizationRole,
  createOrganizationalUnit,
  createRelationship,
  moveOrganizationalUnit,
  removeMembershipFromUnit,
  removeRelationship,
  removeRole,
  updateOrganizationalUnit,
  updateOrganizationRole,
  type ServiceResult,
} from "@/auth/tenant-model";
import { recordAudit } from "@/auth/audit.server";
import type {
  AdminRole,
  OrganizationalUnitType,
  ParticipationType,
  RelationshipType,
  RoleCategory,
} from "@/auth/types";
export async function POST(request: Request) {
  const identity = await getAuthenticatedIdentity(),
    actor = await getRawSessionUser();
  if (
    !identity ||
    !actor ||
    !["ORG_OWNER", "ORG_ADMIN"].includes(identity.membership.adminRole)
  )
    return NextResponse.json(
      { error: "Organization administrator access is required." },
      { status: 403 },
    );
  let body: Record<string, unknown>;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid request." }, { status: 400 });
  }
  let result: ServiceResult<{ id: string }>;
  let event = "";
  const action = String(body.action ?? "");
  if(identityCommands){
    const organizationId=identity.organization.id;
    const audit=(eventName:string,resourceType=action,resourceId=String(body.id??body.assignmentId??body.membershipId??"pending"))=>({actor,organizationId,event:eventName,resourceType,resourceId,after:{...body}});
    try{
      let value:{id:string};
      if(action==="role")value=await identityCommands.createRole({organizationId,name:String(body.name??"").trim(),code:String(body.code??"").trim().toUpperCase(),category:"CUSTOM",description:null,systemTemplateId:body.systemTemplateId?String(body.systemTemplateId):null,defaultExperienceKey:body.defaultExperienceKey?String(body.defaultExperienceKey):null,permissions:Array.isArray(body.permissions)?body.permissions.map(String):[],audit:audit("CUSTOM_ROLE_CREATED")});
      else if(action==="role-update")value=await identityCommands.updateRole({organizationId,roleId:String(body.id),expectedVersion:Number(body.version),patch:{name:String(body.name??""),systemTemplateId:body.systemTemplateId?String(body.systemTemplateId):null,defaultExperienceKey:body.defaultExperienceKey?String(body.defaultExperienceKey):null,isActive:body.isActive===true||body.isActive==="true"},audit:audit("ROLE_UPDATED")});
      else if(action==="role-assign")value=await identityCommands.assignRole({organizationId,membershipId:String(body.membershipId),roleId:String(body.roleId),isPrimary:body.isPrimary===true||body.isPrimary==="true",audit:audit("ROLE_ASSIGNED")});
      else if(action==="role-remove")value=await identityCommands.removeRole({organizationId,assignmentId:String(body.assignmentId),audit:audit("ROLE_ASSIGNMENT_REMOVED")});
      else if(action==="unit")value=await identityCommands.createUnit({organizationId,name:String(body.name??"").trim(),type:String(body.type),parentUnitId:body.parentUnitId?String(body.parentUnitId):null,leaderMembershipId:body.leaderMembershipId?String(body.leaderMembershipId):null,audit:audit("ORG_UNIT_CREATED")});
      else if(action==="unit-update")value=await identityCommands.updateUnit({organizationId,unitId:String(body.id),name:String(body.name??""),parentUnitId:body.parentUnitId?String(body.parentUnitId):null,leaderMembershipId:body.leaderMembershipId?String(body.leaderMembershipId):null,status:body.status==="INACTIVE"?"INACTIVE":"ACTIVE",audit:audit("ORG_UNIT_UPDATED")});
      else if(action==="unit-member-assign")value=await identityCommands.assignUnit({organizationId,membershipId:String(body.membershipId),unitId:String(body.unitId),isPrimary:body.isPrimary===true||body.isPrimary==="true",audit:audit("ORG_UNIT_MEMBER_ASSIGNED")});
      else if(action==="unit-member-remove")value=await identityCommands.removeUnitAssignment({organizationId,assignmentId:String(body.assignmentId),audit:audit("ORG_UNIT_MEMBER_REMOVED")});
      else if(action==="relationship")value=body.relationshipType==="DOTTED_LINE_TO"?await identityCommands.createDottedLine({organizationId,sourceMembershipId:String(body.sourceMembershipId),targetMembershipId:String(body.targetMembershipId),audit:audit("DOTTED_LINE_CREATED")}):await identityCommands.setPrimaryManager({organizationId,sourceMembershipId:String(body.sourceMembershipId),targetMembershipId:String(body.targetMembershipId),audit:audit("REPORTING_RELATIONSHIP_CREATED")});
      else if(action==="relationship-remove")value=await identityCommands.removeRelationship({organizationId,relationshipId:String(body.id),audit:audit("RELATIONSHIP_REMOVED")});
      else if(action==="revenue-team")value=await identityCommands.assignRevenueTeam({organizationId,accountId:body.accountId?String(body.accountId):null,opportunityId:body.opportunityId?String(body.opportunityId):null,membershipId:String(body.membershipId),roleId:body.roleId?String(body.roleId):null,participationType:String(body.participationType),isPrimaryOwner:body.participationType==="PRIMARY_SELLER"||body.participationType==="OWNER",audit:audit("REVENUE_TEAM_ASSIGNMENT_CREATED")});
      else if(action==="admin-role")value=await identityCommands.changeAdminRole({organizationId,membershipId:String(body.membershipId),adminRole:String(body.adminRole) as AdminRole,status:body.status?String(body.status):"ACTIVE",audit:audit("MEMBERSHIP_ADMIN_ROLE_CHANGED")});
      else return NextResponse.json({error:"Unsupported action."},{status:400});
      await identityRepository.refresh?.();
      return NextResponse.json(value,{status:201});
    }catch(error){return NextResponse.json({error:error instanceof ConcurrencyConflictError?error.message:error instanceof Error?error.message:"Administrative change failed."},{status:error instanceof ConcurrencyConflictError?409:400})}
  }
  if (action === "role") {
    result = createOrganizationRole(identityRepository, identity.membership, {
      name: String(body.name ?? "").trim(),
      code: String(body.code ?? "")
        .trim()
        .toUpperCase(),
      category: "CUSTOM" as RoleCategory,
      description: null,
      systemTemplateId: body.systemTemplateId
        ? String(body.systemTemplateId)
        : null,
      defaultExperienceKey: body.defaultExperienceKey
        ? String(body.defaultExperienceKey)
        : null,
      permissions: Array.isArray(body.permissions)
        ? body.permissions.map(String)
        : [],
    });
    event = "CUSTOM_ROLE_CREATED";
  } else if (action === "role-update") {
    result = updateOrganizationRole(
      identityRepository,
      identity.membership,
      String(body.id),
      {
        name: String(body.name ?? ""),
        systemTemplateId: body.systemTemplateId
          ? String(body.systemTemplateId)
          : null,
        defaultExperienceKey: body.defaultExperienceKey
          ? String(body.defaultExperienceKey)
          : null,
        isActive: body.isActive === true || body.isActive === "true",
        permissions: Array.isArray(body.permissions)
          ? body.permissions.map(String)
          : undefined,
      },
    );
    event = "ROLE_UPDATED";
  } else if (action === "role-assign") {
    result = assignRole(
      identityRepository,
      identity.membership,
      String(body.membershipId),
      String(body.roleId),
      body.isPrimary === true || body.isPrimary === "true",
    );
    event = "ROLE_ASSIGNED";
  } else if (action === "role-remove") {
    result = removeRole(
      identityRepository,
      identity.membership,
      String(body.assignmentId),
    );
    event = "ROLE_ASSIGNMENT_REMOVED";
  } else if (action === "unit") {
    result = createOrganizationalUnit(identityRepository, identity.membership, {
      name: String(body.name ?? "").trim(),
      type: String(body.type) as OrganizationalUnitType,
      parentUnitId: body.parentUnitId ? String(body.parentUnitId) : null,
      leaderMembershipId: body.leaderMembershipId
        ? String(body.leaderMembershipId)
        : null,
    });
    event = "ORG_UNIT_CREATED";
  } else if (action === "unit-update") {
    const updated = updateOrganizationalUnit(
      identityRepository,
      identity.membership,
      String(body.id),
      {
        name: String(body.name ?? ""),
        leaderMembershipId: body.leaderMembershipId
          ? String(body.leaderMembershipId)
          : null,
        status: body.status === "INACTIVE" ? "INACTIVE" : "ACTIVE",
      },
    );
    result =
      updated.ok && Object.hasOwn(body, "parentUnitId")
        ? moveOrganizationalUnit(
            identityRepository,
            identity.membership,
            String(body.id),
            body.parentUnitId ? String(body.parentUnitId) : null,
          )
        : updated;
    event = "ORG_UNIT_UPDATED";
  } else if (action === "unit-member-assign") {
    result = assignMembershipToUnit(
      identityRepository,
      identity.membership,
      String(body.membershipId),
      String(body.unitId),
      body.isPrimary === true || body.isPrimary === "true",
    );
    event = "ORG_UNIT_MEMBER_ASSIGNED";
  } else if (action === "unit-member-remove") {
    result = removeMembershipFromUnit(
      identityRepository,
      identity.membership,
      String(body.assignmentId),
    );
    event = "ORG_UNIT_MEMBER_REMOVED";
  } else if (action === "relationship") {
    result = createRelationship(identityRepository, identity.membership, {
      sourceMembershipId: String(body.sourceMembershipId),
      targetMembershipId: String(body.targetMembershipId),
      relationshipType: String(body.relationshipType) as RelationshipType,
      isPrimary: body.relationshipType === "REPORTS_TO",
      metadata: null,
    });
    event =
      body.relationshipType === "DOTTED_LINE_TO"
        ? "DOTTED_LINE_CREATED"
        : "REPORTING_RELATIONSHIP_CREATED";
  } else if (action === "relationship-remove") {
    result = removeRelationship(
      identityRepository,
      identity.membership,
      String(body.id),
    );
    event = "RELATIONSHIP_REMOVED";
  } else if (action === "revenue-team") {
    result = assignRevenueTeam(identityRepository, identity.membership, {
      accountId: body.accountId ? String(body.accountId) : null,
      opportunityId: body.opportunityId ? String(body.opportunityId) : null,
      membershipId: String(body.membershipId),
      organizationRoleDefinitionId: body.roleId ? String(body.roleId) : null,
      participationType: String(body.participationType) as ParticipationType,
      isPrimaryOwner: body.participationType === "OWNER",
    });
    event = "REVENUE_TEAM_ASSIGNMENT_CREATED";
  } else if (action === "admin-role") {
    result = changeMembershipAdminRole(
      identityRepository,
      identity.membership,
      String(body.membershipId),
      String(body.adminRole) as AdminRole,
      body.status ? (String(body.status) as never) : undefined,
    );
    event = "MEMBERSHIP_ADMIN_ROLE_CHANGED";
  } else
    return NextResponse.json({ error: "Unsupported action." }, { status: 400 });
  if (!result.ok)
    return NextResponse.json({ error: result.error }, { status: 400 });
  recordAudit(
    actor,
    {
      event,
      resourceType: action,
      resourceId: result.value.id,
      after: { ...result.value },
    },
    identity.organization.id,
  );
  await flushIdentityRepository();
  return NextResponse.json(result.value, { status: 201 });
}
