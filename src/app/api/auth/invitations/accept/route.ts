import { NextResponse } from "next/server";
import { acceptOrganizationInvitation } from "@/auth/tenant-model";
import {flushIdentityRepository,identityCommands,identityRepository} from "@/auth/repository.server";
import { recordAudit } from "@/auth/audit.server";
export async function POST(request: Request) {
  let body: Record<string, unknown>;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid request." }, { status: 400 });
  }
  if(identityCommands){try{const result=await identityCommands.acceptInvitation({token:String(body.token??""),firstName:String(body.firstName??""),lastName:String(body.lastName??""),password:String(body.password??"")});await identityRepository.refresh?.();return NextResponse.json({ok:true,organizationId:result.organizationId})}catch(error){return NextResponse.json({error:error instanceof Error?error.message:"Unable to accept invitation."},{status:409})}}
  const result = acceptOrganizationInvitation(identityRepository, {
    token: String(body.token ?? ""),
    firstName: String(body.firstName ?? ""),
    lastName: String(body.lastName ?? ""),
    password: String(body.password ?? ""),
  });
  if (!result.ok)
    return NextResponse.json({ error: result.error }, { status: 400 });
  recordAudit(
    result.value.user,
    {
      event: "USER_INVITATION_ACCEPTED",
      resourceType: "membership",
      resourceId: result.value.membership.id,
      after: {
        adminRole: result.value.membership.adminRole,
        status: result.value.membership.status,
      },
    },
    result.value.membership.organizationId,
  );
  await flushIdentityRepository();
  return NextResponse.json({
    ok: true,
    organizationId: result.value.membership.organizationId,
  });
}
