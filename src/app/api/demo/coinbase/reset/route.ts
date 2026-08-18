import { NextResponse } from "next/server";
import { getAuthenticatedIdentity } from "@/auth/session.server";
import { demoScenarioRepository } from "@/db/demo-scenario-repository";
import { identityRepository } from "@/auth/repository.server";

export async function POST() {
  const identity = await getAuthenticatedIdentity();
  if (!identity)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (
    process.env.NODE_ENV === "production" &&
    process.env.DEMO_RESET_ENABLED !== "true"
  ) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  const membership = identity.membership;
  const actor = identityRepository.findUserById(identity.user.id);
  const allowed =
    actor?.platformRole === "SUPER_ADMIN" ||
    membership.adminRole === "ORG_OWNER";
  if (!allowed || identity.organization.id !== "org-cognivit-demo") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  try {
    const result = await demoScenarioRepository.resetCoinbase({
      organizationId: identity.organization.id,
      userId: identity.user.id,
      membershipId: membership.id,
    });
    return NextResponse.json(result);
  } catch (error) {
    console.error("demo reset failed", error);
    return NextResponse.json({ error: "Demo reset failed" }, { status: 500 });
  }
}
