import { NextResponse } from "next/server";
import { parseRole } from "@/auth/input";
import { getRawSessionUser, setViewAsRole } from "@/auth/session.server";
import { recordAudit } from "@/auth/audit.server";
import { isDemoApplication } from "@/auth/application-mode";
export async function POST(request: Request) {
  const actor = await getRawSessionUser();
  if (!actor)
    return NextResponse.json({ error: "Unauthenticated" }, { status: 401 });
  if (!isDemoApplication())
    return NextResponse.json(
      { error: "Role simulation is only available in Demo mode." },
      { status: 403 },
    );
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  }
  const role = parseRole((body as Record<string, unknown>)?.role);
  if (role === undefined)
    return NextResponse.json({ error: "Invalid role" }, { status: 400 });
  if (!(await setViewAsRole(role)))
    return NextResponse.json(
      { error: "View As is unavailable" },
      { status: 403 },
    );
  recordAudit(actor, {
    event: role ? "demo.view_as.started" : "demo.view_as.ended",
    resourceType: "user",
    resourceId: actor.id,
    payload: { viewAsRole: role },
  });
  return NextResponse.json({ ok: true });
}
