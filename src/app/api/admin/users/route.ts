import { NextResponse } from "next/server";
import { identityCommands, identityRepository } from "@/auth/repository.server";
import { ConcurrencyConflictError } from "@/db/identity-commands";
import {
  getAuthenticatedIdentity,
  getRawSessionUser,
} from "@/auth/session.server";
import {
  parseUserAdministrationInput,
  parseUserVersion,
  toOrganizationAdminUser,
} from "@/auth/user-administration";
async function admin() {
  const actor = await getRawSessionUser(),
    identity = await getAuthenticatedIdentity();
  return actor &&
    identity &&
    ["ORG_OWNER", "ORG_ADMIN"].includes(identity.membership.adminRole)
    ? { actor, identity }
    : null;
}
export async function GET() {
  const context = await admin();
  if (!context)
    return NextResponse.json(
      { error: "Organization administrator access is required." },
      { status: 403 },
    );
  const store = identityRepository.read(),
    ids = new Set(
      store.memberships
        .filter(
          (item) => item.organizationId === context.identity.organization.id,
        )
        .map((item) => item.userId),
    ),
    users = store.users
      .filter((user) => ids.has(user.id))
      .map((user) =>
        toOrganizationAdminUser(
          identityRepository,
          user,
          context.identity.organization.id,
        ),
      );
  return NextResponse.json({ users });
}
export async function POST(request: Request) {
  const context = await admin();
  if (!context)
    return NextResponse.json(
      { error: "Organization administrator access is required." },
      { status: 403 },
    );
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid request." }, { status: 400 });
  }
  const input = parseUserAdministrationInput(body, true);
  if (!input)
    return NextResponse.json(
      {
        error:
          "Enter valid user details and a password of at least 8 characters.",
      },
      { status: 400 },
    );
  if (!identityCommands)
    return NextResponse.json(
      { error: "Database command repository is unavailable." },
      { status: 503 },
    );
  try {
    const created = await identityCommands.createOrganizationUser({
      organizationId: context.identity.organization.id,
      actor: context.actor,
      email: input.email,
      firstName: input.firstName,
      lastName: input.lastName,
      password: input.password!,
      roleCode: input.role,
      status: input.status,
      managerUserId: input.managerUserId,
    });
    await identityRepository.refresh?.();
    const user = identityRepository.findUserById(created.userId)!;
    return NextResponse.json(
      {
        user: toOrganizationAdminUser(
          identityRepository,
          user,
          context.identity.organization.id,
        ),
      },
      { status: 201 },
    );
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error ? error.message : "Unable to create user.",
      },
      { status: 400 },
    );
  }
}
export async function PATCH(request: Request) {
  const context = await admin();
  if (!context)
    return NextResponse.json(
      { error: "Organization administrator access is required." },
      { status: 403 },
    );
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid request." }, { status: 400 });
  }
  if (
    !body ||
    typeof body !== "object" ||
    typeof (body as { id?: unknown }).id !== "string"
  )
    return NextResponse.json(
      { error: "A user ID is required." },
      { status: 400 },
    );
  const id = (body as { id: string }).id,
    input = parseUserAdministrationInput(body, false),
    expectedVersion = parseUserVersion(
      (body as Record<string, unknown>).version,
    );
  if (!input)
    return NextResponse.json(
      {
        error:
          "Enter valid user details. New passwords must be at least 8 characters.",
      },
      { status: 400 },
    );
  if (expectedVersion === null)
    return NextResponse.json(
      { error: "This user record is out of date. Refresh and try again." },
      { status: 409 },
    );
  if (!identityCommands)
    return NextResponse.json(
      { error: "Database command repository is unavailable." },
      { status: 503 },
    );
  try {
    await identityCommands.updateOrganizationUser({
      organizationId: context.identity.organization.id,
      actor: context.actor,
      userId: id,
      expectedVersion,
      email: input.email,
      firstName: input.firstName,
      lastName: input.lastName,
      password: input.password,
      roleCode: input.role,
      status: input.status,
      managerUserId: input.managerUserId,
    });
    await identityRepository.refresh?.();
    return NextResponse.json({
      user: toOrganizationAdminUser(
        identityRepository,
        identityRepository.findUserById(id)!,
        context.identity.organization.id,
      ),
    });
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error ? error.message : "Unable to update user.",
      },
      { status: error instanceof ConcurrencyConflictError ? 409 : 400 },
    );
  }
}
