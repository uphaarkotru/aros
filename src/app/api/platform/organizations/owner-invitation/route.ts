import { NextResponse } from "next/server";
import {identityCommands,identityRepository} from "@/auth/repository.server";
import { getRawSessionUser } from "@/auth/session.server";

export async function POST(request: Request) {
  const actor = await getRawSessionUser();
  if (actor?.platformRole !== "SUPER_ADMIN")
    return NextResponse.json(
      { error: "Platform administrator access is required." },
      { status: 403 },
    );
  const body = (await request.json().catch(() => null)) as {
    organizationId?: unknown;
  } | null;
  if(!identityCommands)return NextResponse.json({error:"Database command repository is unavailable."},{status:503});
  try{const result=await identityCommands.rotateOwnerInvitation({organizationId:String(body?.organizationId??""),actor});await identityRepository.refresh?.();return NextResponse.json({acceptancePath:`/accept-invitation?token=${encodeURIComponent(result.token)}`})}catch(error){return NextResponse.json({error:error instanceof Error?error.message:"Unable to rotate invitation."},{status:400})}
}
