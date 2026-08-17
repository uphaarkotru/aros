import { NextResponse } from "next/server";
import {
  getAuthenticatedIdentity,
  getRawSessionUser,
} from "@/auth/session.server";
import { identityRepository } from "@/auth/repository.server";
import { getMembership } from "@/auth/tenant-model";
import {
  cadenceRepository,
  CadenceConflictError,
} from "@/db/cadence-repository";

const visibilities = new Set(["INTERNAL_ONLY", "EXTERNAL_SHAREABLE"]),
  impacts = new Set(["LOW", "MEDIUM", "HIGH", "CRITICAL"]);

export async function POST(
  request: Request,
  { params }: { params: Promise<{ sessionId: string }> },
) {
  const identity = await getAuthenticatedIdentity(),
    actor = await getRawSessionUser();
  if (!identity || !actor)
    return NextResponse.json({ error: "Unauthenticated" }, { status: 401 });
  if (!cadenceRepository)
    return NextResponse.json({ error: "Unavailable" }, { status: 503 });
  let body: Record<string, unknown>;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  }
  const description = String(body.description ?? "").trim(),
    ownerMembershipId = String(body.ownerMembershipId ?? ""),
    dueAt = body.dueAt ? String(body.dueAt) : null,
    expectedOutcome = String(body.expectedOutcome ?? "").trim() || null,
    visibility = String(body.visibility ?? "INTERNAL_ONLY"),
    impact = String(body.impact ?? "MEDIUM"),
    effectiveMembership = getMembership(
      identityRepository,
      identity.viewUser.id,
      identity.organization.id,
    );
  if (!description || description.length > 500 || !ownerMembershipId)
    return NextResponse.json(
      { error: "Enter an action and select its owner." },
      { status: 400 },
    );
  if (dueAt && Number.isNaN(Date.parse(dueAt)))
    return NextResponse.json(
      { error: "Enter a valid due date." },
      { status: 400 },
    );
  if (!visibilities.has(visibility) || !impacts.has(impact))
    return NextResponse.json(
      { error: "Invalid action metadata." },
      { status: 400 },
    );
  const { sessionId } = await params;
  try {
    const result = await cadenceRepository.createCommitment({
      organizationId: identity.organization.id,
      sessionId,
      actorMembershipId: effectiveMembership?.id ?? identity.membership.id,
      actorUserId: actor.id,
      ownerMembershipId,
      description,
      dueAt,
      expectedOutcome,
      visibility,
      impact,
      idempotencyKey: String(body.idempotencyKey ?? crypto.randomUUID()),
    });
    return NextResponse.json(result, { status: 201 });
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error ? error.message : "Action could not be saved.",
      },
      { status: error instanceof CadenceConflictError ? 409 : 400 },
    );
  }
}
