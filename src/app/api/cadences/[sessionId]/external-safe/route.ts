import { NextResponse } from "next/server";
import { getAuthenticatedIdentity } from "@/auth/session.server";
import { cadenceRepository } from "@/db/cadence-repository";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ sessionId: string }> },
) {
  const identity = await getAuthenticatedIdentity();
  if (!identity)
    return NextResponse.json({ error: "Unauthenticated" }, { status: 401 });
  if (!cadenceRepository)
    return NextResponse.json({ error: "Unavailable" }, { status: 503 });
  const { sessionId } = await params;
  if (
    !(await cadenceRepository.getCadence(
      identity.organization.id,
      sessionId,
      identity.membership.id,
    ))
  )
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  const safe = await cadenceRepository.getExternalSafeCadence(
    identity.organization.id,
    sessionId,
  );
  return safe
    ? NextResponse.json(safe)
    : NextResponse.json({ error: "Not found" }, { status: 404 });
}
