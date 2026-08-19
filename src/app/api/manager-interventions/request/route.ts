import { NextResponse } from "next/server";
import { getAuthenticatedIdentity, getRawSessionUser } from "@/auth/session.server";
import { cadenceRepository } from "@/db/cadence-repository";
import { getMembership } from "@/auth/tenant-model";
import { identityRepository } from "@/auth/repository.server";

export async function POST(request: Request) {
  const identity = await getAuthenticatedIdentity();
  const actor = await getRawSessionUser();
  if (!identity || !actor) return NextResponse.json({ error: "Unauthenticated" }, { status: 401 });
  if (identity.effectiveRole !== "AE" || !cadenceRepository)
    return NextResponse.json({ error: "Only an account executive can request manager intervention." }, { status: 403 });
  let body: Record<string, unknown>;
  try { body = await request.json(); } catch { return NextResponse.json({ error: "Invalid request" }, { status: 400 }); }
  const membership = getMembership(identityRepository, identity.viewUser.id, identity.organization.id);
  if (!membership) return NextResponse.json({ error: "Seller membership unavailable." }, { status: 403 });
  if (body.accountId && !identity.scope?.accountIds.includes(String(body.accountId))) return NextResponse.json({ error: "Account outside scope." }, { status: 403 });
  if (body.opportunityId && !identity.scope?.opportunityIds.includes(String(body.opportunityId))) return NextResponse.json({ error: "Opportunity outside scope." }, { status: 403 });
  const summary = String(body.summary ?? "").trim(), rationale = String(body.rationale ?? "").trim();
  if (!summary || !rationale) return NextResponse.json({ error: "Summary and rationale are required." }, { status: 400 });
  try {
    const item = await cadenceRepository.requestManagerIntervention({ organizationId: identity.organization.id, sellerMembershipId: membership.id, accountId: body.accountId ? String(body.accountId) : undefined, opportunityId: body.opportunityId ? String(body.opportunityId) : undefined, summary, rationale, evidence: Array.isArray(body.evidence) ? body.evidence.map(String).slice(0, 8) : [], recommendedAction: String(body.recommendedAction ?? "Review with the seller"), actorUserId: actor.id });
    return NextResponse.json({ item }, { status: 201 });
  } catch (error) { return NextResponse.json({ error: error instanceof Error ? error.message : "Unable to request manager intervention." }, { status: 400 }); }
}
