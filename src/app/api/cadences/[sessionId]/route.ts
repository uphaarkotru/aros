import { NextResponse } from "next/server";
import { getAuthenticatedIdentity } from "@/auth/session.server";
import { cadenceRepository } from "@/db/cadence-repository";
import { identityRepository } from "@/auth/repository.server";
import { getMembership } from "@/auth/tenant-model";
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ sessionId: string }> },
) {
  const identity = await getAuthenticatedIdentity();
  if (!identity)
    return NextResponse.json({ error: "Unauthenticated" }, { status: 401 });
  if (!cadenceRepository)
    return NextResponse.json({ error: "Unavailable" }, { status: 503 });
  const effectiveMembership = getMembership(
      identityRepository,
      identity.viewUser.id,
      identity.organization.id,
    ),
    { sessionId } = await params,
    result = await cadenceRepository.getCadence(
      identity.organization.id,
      sessionId,
      effectiveMembership?.id ?? identity.membership.id,
    );
  return result
    ? NextResponse.json(result)
    : NextResponse.json({ error: "Not found" }, { status: 404 });
}
