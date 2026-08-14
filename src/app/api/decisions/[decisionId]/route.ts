import { NextResponse } from "next/server";
import {
  getAuthenticatedIdentity,
  getRawSessionUser,
} from "@/auth/session.server";
import { identityRepository } from "@/auth/repository.server";
import { authorizePermission } from "@/auth/authorization";
import { permissions } from "@/auth/permissions";
import { recordAudit } from "@/auth/audit.server";
import { revenueRepository } from "@/db/revenue-repository";
const actions = ["approve", "dismiss", "edit", "execute", "snooze"] as const;
type Action = (typeof actions)[number];
export async function POST(
  request: Request,
  { params }: { params: Promise<{ decisionId: string }> },
) {
  const identity = await getAuthenticatedIdentity(),
    actor = await getRawSessionUser();
  if (!identity || !actor)
    return NextResponse.json({ error: "Unauthenticated" }, { status: 401 });
  const body = (await request.json().catch(() => null)) as Record<
      string,
      unknown
    > | null,
    action = body?.action;
  if (typeof action !== "string" || !actions.includes(action as Action))
    return NextResponse.json({ error: "Invalid action" }, { status: 400 });
  const { decisionId } = await params,
    decision = await revenueRepository.getAction(
      identity.organization.id,
      decisionId,
    );
  if (!decision)
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (
    !decision.accountId ||
    !identity.scope?.accountIds.includes(decision.accountId)
  )
    return NextResponse.json(
      { error: "Resource outside scope" },
      { status: 403 },
    );
  const effective = identityRepository.findUserById(identity.viewUser.id)!;
  if (
    !authorizePermission(
      effective,
      permissions.recommendationApprove,
      identityRepository,
      identity.organization.id,
    ) &&
    !authorizePermission(
      effective,
      permissions.managerDecisionApprove,
      identityRepository,
      identity.organization.id,
    )
  )
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  const recommendation = body?.recommendation;
  if (
    action === "edit" &&
    (typeof recommendation !== "string" ||
      !recommendation.trim() ||
      recommendation.length > 4000)
  )
    return NextResponse.json(
      { error: "Invalid recommendation" },
      { status: 400 },
    );
  const status = {
      approve: "APPROVED",
      dismiss: "DISMISSED",
      edit: undefined,
      execute: "EXECUTED",
      snooze: "SNOOZED",
    }[action as Action],
    updated = await revenueRepository.updateAction(
      identity.organization.id,
      decisionId,
      {
        status,
        recommendation: action === "edit" ? String(recommendation) : undefined,
      },
      identity.membership.id,
    );
  if (!updated)
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  const event = recordAudit(
    actor,
    {
      event: `decision.${action}`,
      resourceType: "decision",
      resourceId: decisionId,
      payload: {
        accountId: decision.accountId,
        viewAsRole: identity.viewAsRole,
      },
    },
    identity.organization.id,
  );
  return NextResponse.json({ ok: true, decision: updated, auditEvent: event });
}
