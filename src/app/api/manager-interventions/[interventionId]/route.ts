import { NextResponse } from "next/server";
import {
  getAuthenticatedIdentity,
  getRawSessionUser,
} from "@/auth/session.server";
import {
  cadenceRepository,
  CadenceConflictError,
} from "@/db/cadence-repository";
export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ interventionId: string }> },
) {
  const identity = await getAuthenticatedIdentity(),
    actor = await getRawSessionUser();
  if (!identity || !actor)
    return NextResponse.json({ error: "Unauthenticated" }, { status: 401 });
  if (identity.effectiveRole !== "RSM" || !cadenceRepository)
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  let body: { expectedVersion?: number; status?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  }
  const { interventionId } = await params;
  try {
    return NextResponse.json(
      await cadenceRepository.updateIntervention({
        organizationId: identity.organization.id,
        interventionId,
        managerMembershipId: identity.membership.id,
        actorUserId: actor.id,
        expectedVersion: Number(body.expectedVersion),
        status: String(body.status),
      }),
    );
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Intervention could not be updated",
      },
      { status: error instanceof CadenceConflictError ? 409 : 400 },
    );
  }
}
