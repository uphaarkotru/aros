import { NextResponse } from "next/server";
import {
  getAuthenticatedIdentity,
  getRawSessionUser,
} from "@/auth/session.server";
import { identityRepository } from "@/auth/repository.server";
import { getMembership } from "@/auth/tenant-model";
import { authorizePermission } from "@/auth/authorization";
import { permissions } from "@/auth/permissions";
import { forecastCategories, type ForecastCategory } from "@/forecast/domain";
import { leadershipRepository } from "@/db/leadership-repository";

const actions = [
  "ACCEPT_AROS",
  "REQUEST_MANAGER_REVIEW",
  "KEEP_CURRENT",
  "CHANGE_MANAGER_FORECAST",
  "ESCALATE",
] as const;
export async function POST(
  request: Request,
  { params }: { params: Promise<{ assessmentId: string }> },
) {
  const identity = await getAuthenticatedIdentity(),
    actor = await getRawSessionUser();
  if (!identity || !actor)
    return NextResponse.json({ error: "Unauthenticated" }, { status: 401 });
  if (!leadershipRepository)
    return NextResponse.json(
      { error: "Persistence unavailable" },
      { status: 503 },
    );
  const effective = identityRepository.findUserById(identity.viewUser.id),
    membership = getMembership(
      identityRepository,
      identity.viewUser.id,
      identity.organization.id,
    );
  if (
    !effective ||
    !membership ||
    !authorizePermission(
      effective,
      permissions.leadershipDecision,
      identityRepository,
      identity.organization.id,
    )
  )
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  const body = await request.json(),
    action = actions.find((item) => item === body.action),
    managerCategory = forecastCategories.find(
      (item) => item === body.managerCategory,
    ) as ForecastCategory | undefined;
  if (!action)
    return NextResponse.json(
      { error: "Invalid review action" },
      { status: 400 },
    );
  const { assessmentId } = await params;
  try {
    if (
      !(await leadershipRepository.canAccessAssessment(
        identity.organization.id,
        assessmentId,
        membership.id,
      ))
    )
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    return NextResponse.json(
      await leadershipRepository.reviewForecast({
        organizationId: identity.organization.id,
        assessmentId,
        leaderMembershipId: membership.id,
        actorUserId: actor.id,
        actorMembershipId: identity.membership.id,
        actorRole: identity.effectiveRole!,
        action,
        managerCategory,
        rationale:
          typeof body.rationale === "string" ? body.rationale : undefined,
        idempotencyKey:
          typeof body.idempotencyKey === "string"
            ? body.idempotencyKey
            : `${assessmentId}:${identity.membership.id}:${action}`,
      }),
    );
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Review failed" },
      { status: 400 },
    );
  }
}
