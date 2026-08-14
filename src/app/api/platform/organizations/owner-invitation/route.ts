import { NextResponse } from "next/server";
import { rotateOwnerInvitation } from "@/auth/platform-invitations";
import { identityRepository } from "@/auth/repository.server";
import { getRawSessionUser } from "@/auth/session.server";

export async function POST(request: Request) {
  const actor = await getRawSessionUser();
  if (actor?.platformRole !== "SUPER_ADMIN") return NextResponse.json({ error: "Platform administrator access is required." }, { status: 403 });
  const body = await request.json().catch(() => null) as { organizationId?: unknown } | null;
  const result = rotateOwnerInvitation(identityRepository, actor, String(body?.organizationId ?? ""));
  if (!result.ok) return NextResponse.json({ error: result.error }, { status: 400 });
  return NextResponse.json({ acceptancePath: `/accept-invitation?token=${encodeURIComponent(result.value.token)}` });
}
