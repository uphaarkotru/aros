import { NextResponse } from "next/server";
import { parseLoginInput } from "@/auth/input";
import {identityRepository} from "@/auth/repository.server";
import {
  authenticateCredentials,
  authenticateTenantCredentials,
} from "@/auth/authenticate";
import { createSession } from "@/auth/session.server";
import { recordAudit } from "@/auth/audit.server";
export async function POST(request: Request) {
  await identityRepository.refresh?.();
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid request." }, { status: 400 });
  }
  const input = parseLoginInput(body);
  if (!input)
    return NextResponse.json(
      { error: "Enter a valid email and password." },
      { status: 400 },
    );
  const tenantSlug =
      typeof (body as Record<string, unknown>).tenantSlug === "string"
        ? String((body as Record<string, unknown>).tenantSlug)
            .trim()
            .toLowerCase()
        : "",
    tenantAuth = tenantSlug
      ? authenticateTenantCredentials(
          identityRepository,
          input.email,
          input.password,
          tenantSlug,
        )
      : null,
    user =
      tenantAuth?.user ??
      (!tenantSlug
        ? authenticateCredentials(
            identityRepository,
            input.email,
            input.password,
          )
        : null);
  if (!user)
    return NextResponse.json(
      {
        error: tenantSlug
          ? "Invalid credentials or you do not have access to this tenant."
          : "Invalid email or password.",
      },
      { status: 401 },
    );
  const organizationId = tenantAuth?.organization.id ?? user.organizationId,
    membership =
      tenantAuth?.membership ??
      identityRepository
        .read()
        .memberships.find(
          (item) =>
            item.userId === user.id && item.organizationId === organizationId,
        );
  identityRepository.saveUser({
    ...user,
    lastLoginAt: new Date().toISOString(),
  });
  await createSession(user, organizationId);
  recordAudit(
    user,
    {
      event: "auth.login",
      resourceType: "session",
      resourceId: user.id,
      payload: { organizationId, tenantSlug: tenantSlug || undefined },
    },
    organizationId,
  );
  return NextResponse.json({
    ok: true,
    redirectTo:
      user.platformRole === "SUPER_ADMIN" && !tenantSlug
        ? "/platform/admin"
        : membership &&
            ["ORG_OWNER", "ORG_ADMIN"].includes(membership.adminRole)
          ? "/admin"
          : "/today",
  });
}
