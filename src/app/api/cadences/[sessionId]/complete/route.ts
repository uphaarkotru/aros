import { NextResponse } from "next/server";
import {
  getAuthenticatedIdentity,
  getRawSessionUser,
} from "@/auth/session.server";
import {
  cadenceRepository,
  CadenceConflictError,
} from "@/db/cadence-repository";
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
  let body: {
    expectedVersion?: number;
    internalSummary?: string;
    externalSafeSummary?: string;
    decisions?: Parameters<
      NonNullable<typeof cadenceRepository>["completeCadence"]
    >[0]["decisions"];
    commitments?: Parameters<
      NonNullable<typeof cadenceRepository>["completeCadence"]
    >[0]["commitments"];
    outcomes?: Parameters<
      NonNullable<typeof cadenceRepository>["completeCadence"]
    >[0]["outcomes"];
  };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  }
  const { sessionId } = await params;
  try {
    const result = await cadenceRepository.completeCadence({
      organizationId: identity.organization.id,
      sessionId,
      expectedVersion: Number(body.expectedVersion),
      actorUserId: actor.id,
      actorMembershipId: identity.membership.id,
      internalSummary: String(body.internalSummary ?? ""),
      externalSafeSummary: String(body.externalSafeSummary ?? ""),
      decisions: Array.isArray(body.decisions) ? body.decisions : [],
      commitments: Array.isArray(body.commitments) ? body.commitments : [],
      outcomes: Array.isArray(body.outcomes) ? body.outcomes : [],
    });
    return NextResponse.json(result);
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Cadence could not be completed",
      },
      { status: error instanceof CadenceConflictError ? 409 : 400 },
    );
  }
}
