import { NextResponse } from "next/server";
import {
  getAuthenticatedIdentity,
  getRawSessionUser,
} from "@/auth/session.server";
import {
  demoScenarioRepository,
  COINBASE_STATES,
  type CoinbaseScenarioState,
} from "@/db/demo-scenario-repository";
import {
  canAdministerDemo,
  isProductionDemoFeatureEnabled,
} from "@/auth/demo-access";

export async function POST(request: Request) {
  const identity = await getAuthenticatedIdentity(),
    actor = await getRawSessionUser();
  if (!identity || !actor)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!isProductionDemoFeatureEnabled(process.env.DEMO_STORY_ENABLED))
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (identity.organization.id !== "org-cognivit-demo")
    return NextResponse.json({ error: "Demo tenant only" }, { status: 403 });
  if (!canAdministerDemo(identity.organization, identity.membership, actor))
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  let body: { state?: string; expectedVersion?: number };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  }
  if (
    !body.state ||
    !COINBASE_STATES.includes(body.state as CoinbaseScenarioState)
  )
    return NextResponse.json({ error: "Invalid story state" }, { status: 400 });
  try {
    return NextResponse.json(
      await demoScenarioRepository.transition(
        identity.organization.id,
        body.state as CoinbaseScenarioState,
        body.expectedVersion,
      ),
    );
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Unable to advance demo story",
      },
      { status: 409 },
    );
  }
}
