import { NextResponse } from "next/server";
import { getRawSessionUser } from "@/auth/session.server";
import {identityCommands,identityRepository} from "@/auth/repository.server";
import {ConcurrencyConflictError} from "@/db/identity-commands";
import type { OrganizationEnvironment } from "@/auth/types";
const environments = ["DEMO", "SANDBOX", "PRODUCTION"] as const,
  statuses = ["PROVISIONING", "ACTIVE", "SUSPENDED", "ARCHIVED"] as const;
async function platformActor() {
  const actor = await getRawSessionUser();
  return actor?.platformRole === "SUPER_ADMIN" ? actor : null;
}
function validTimezone(value: string) {
  try {
    new Intl.DateTimeFormat("en-US", { timeZone: value });
    return true;
  } catch {
    return false;
  }
}
export async function GET() {
  const actor = await platformActor();
  if (!actor)
    return NextResponse.json(
      { error: "Platform administrator access is required." },
      { status: 403 },
    );
  const store = identityRepository.read();
  return NextResponse.json({
    organizations: store.organizations.map((organization) => ({
      ...organization,
      administrators: store.memberships
        .filter(
          (item) =>
            item.organizationId === organization.id &&
            item.adminRole !== "MEMBER",
        )
        .map((item) => {
          const user = store.users.find(
            (candidate) => candidate.id === item.userId,
          );
          return {
            membershipId: item.id,
            email: user?.email,
            displayName: user?.displayName,
            adminRole: item.adminRole,
            status: item.status,
          };
        }),
    })),
  });
}
export async function POST(request: Request) {
  const actor = await platformActor();
  if (!actor)
    return NextResponse.json(
      { error: "Platform administrator access is required." },
      { status: 403 },
    );
  let body: Record<string, unknown>;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid request." }, { status: 400 });
  }
  const name = String(body.name ?? "").trim(),
    slug = String(body.slug ?? "")
      .trim()
      .toLowerCase(),
    email = String(body.ownerEmail ?? "")
      .trim()
      .toLowerCase(),
    ownerFirstName = String(body.ownerFirstName ?? "").trim(),
    ownerLastName = String(body.ownerLastName ?? "").trim(),
    timezone = String(body.timezone ?? "UTC"),
    environment = String(body.environment ?? "SANDBOX"),
    fiscalYearStartMonth = Number(body.fiscalYearStartMonth ?? 1);
  if (
    !name ||
    !/^[a-z0-9-]{2,80}$/.test(slug) ||
    !/^\S+@\S+\.\S+$/.test(email) ||
    !ownerFirstName ||
    !ownerLastName ||
    !validTimezone(timezone) ||
    !environments.includes(environment as never) ||
    !Number.isInteger(fiscalYearStartMonth) ||
    fiscalYearStartMonth < 1 ||
    fiscalYearStartMonth > 12
  )
    return NextResponse.json(
      { error: "Enter valid organization and owner details." },
      { status: 400 },
    );
  if(!identityCommands)return NextResponse.json({error:"Database command repository is unavailable."},{status:503});
  try{const created=await identityCommands.bootstrap({actor,name,slug,primaryDomain:body.primaryDomain?String(body.primaryDomain):null,timezone,fiscalYearStartMonth,environment:environment as OrganizationEnvironment,ownerEmail:email,ownerFirstName,ownerLastName,useStandardOrgTemplate:body.useStandardOrgTemplate!==false&&body.useStandardOrgTemplate!=="false",idempotencyKey:String(body.idempotencyKey??`tenant:${slug}`)});await identityRepository.refresh?.();const organization=identityRepository.read().organizations.find(item=>item.id===created.organizationId);return NextResponse.json({organization,acceptancePath:created.token?`/accept-invitation?token=${encodeURIComponent(created.token)}`:undefined,replayed:created.replayed},{status:created.replayed?200:201})}catch(error){const message=error instanceof Error?error.message:"Unable to create organization.";return NextResponse.json({error:message},{status:message.includes("duplicate")?409:400})}
}
export async function PATCH(request: Request) {
  const actor = await platformActor();
  if (!actor)
    return NextResponse.json(
      { error: "Platform administrator access is required." },
      { status: 403 },
    );
  let body: Record<string, unknown>;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid request." }, { status: 400 });
  }
  const organizationId = String(body.organizationId ?? ""),
    store = identityRepository.read(),
    before = store.organizations.find((item) => item.id === organizationId);
  if (!before)
    return NextResponse.json(
      { error: "Organization not found." },
      { status: 404 },
    );
  const environment = body.environment ? String(body.environment) : undefined,
    status = body.status ? String(body.status) : undefined,
    timezone = body.timezone ? String(body.timezone) : undefined,
    fiscal = body.fiscalYearStartMonth
      ? Number(body.fiscalYearStartMonth)
      : undefined;
  if (
    (environment && !environments.includes(environment as never)) ||
    (status && !statuses.includes(status as never)) ||
    (timezone && !validTimezone(timezone)) ||
    (fiscal !== undefined &&
      (!Number.isInteger(fiscal) || fiscal < 1 || fiscal > 12))
  )
    return NextResponse.json(
      { error: "Invalid tenant configuration." },
      { status: 400 },
    );
  if(!identityCommands)return NextResponse.json({error:"Database command repository is unavailable."},{status:503});
  try{const changed=await identityCommands.updateOrganization({organizationId,actor,expectedVersion:Number(body.version),patch:{name:body.name?String(body.name).trim():undefined,slug:body.slug?String(body.slug).trim().toLowerCase():undefined,primaryDomain:typeof body.primaryDomain==="string"?body.primaryDomain.trim():undefined,timezone,fiscalYearStartMonth:fiscal,environment,status},owner:body.ownerEmail!==undefined?{email:String(body.ownerEmail).trim().toLowerCase(),firstName:String(body.ownerFirstName??"").trim(),lastName:String(body.ownerLastName??"").trim()}:undefined});await identityRepository.refresh?.();const organization=identityRepository.read().organizations.find(item=>item.id===changed.organizationId);return NextResponse.json({organization,owner:body.ownerEmail!==undefined?identityRepository.read().users.find(user=>identityRepository.read().memberships.some(m=>m.organizationId===organizationId&&m.userId===user.id&&m.adminRole==="ORG_OWNER")):undefined})}catch(error){return NextResponse.json({error:error instanceof Error?error.message:"Unable to update organization."},{status:error instanceof ConcurrencyConflictError?409:400})}
}
