import { createHash, randomBytes, randomUUID } from "node:crypto";
import { cookies } from "next/headers";
import {
  flushIdentityRepository,
  identityRepository,
} from "./repository.server";
import { getUserScope } from "./hierarchy";
import { toPublicUser, type RevenueRole, type User } from "./types";
import { getApplicationMode, isDemoApplication } from "./application-mode";
import { getMembership, primaryRoleContext } from "./tenant-model";
import { resolvePermissions } from "./authorization";
export const SESSION_COOKIE = "aros_session";
const SESSION_SECONDS = 60 * 60 * 12;
const simulationPriority = [
  "user-ae-sarah",
  "user-rsm-mark",
  "user-vp-jennifer",
  "user-cro-michael",
];
const tokenHash = (token: string) =>
  createHash("sha256").update(token).digest("hex");
export async function createSession(
  user: User,
  organizationId = user.organizationId,
) {
  const token = randomBytes(32).toString("base64url"),
    now = new Date(),
    expires = new Date(now.getTime() + SESSION_SECONDS * 1000);
  identityRepository.saveSession({
    id: randomUUID(),
    tokenHash: tokenHash(token),
    userId: user.id,
    organizationId,
    viewAsRole: null,
    viewAsUserId: null,
    createdAt: now.toISOString(),
    lastSeenAt: now.toISOString(),
    expiresAt: expires.toISOString(),
  });
  await flushIdentityRepository();
  const jar = await cookies();
  jar.set(SESSION_COOKIE, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: SESSION_SECONDS,
  });
  return token;
}
export async function destroySession() {
  const jar = await cookies(),
    token = jar.get(SESSION_COOKIE)?.value;
  if (token) {
    const session = identityRepository.findSessionByTokenHash(tokenHash(token));
    if (session) {
      identityRepository.deleteSession(session.id);
      await flushIdentityRepository();
    }
  }
  jar.delete(SESSION_COOKIE);
}
export async function getAuthenticatedIdentity() {
  await identityRepository.refresh?.();
  const token = (await cookies()).get(SESSION_COOKIE)?.value;
  if (!token) return null;
  const session = identityRepository.findSessionByTokenHash(tokenHash(token));
  if (!session || Date.parse(session.expiresAt) <= Date.now()) {
    if (session) {
      identityRepository.deleteSession(session.id);
      await flushIdentityRepository();
    }
    return null;
  }
  const user = identityRepository.findUserById(session.userId),
    organization = identityRepository
      .read()
      .organizations.find((item) => item.id === session.organizationId),
    membership =
      user && session.organizationId
        ? getMembership(identityRepository, user.id, session.organizationId)
        : undefined;
  if (
    !user ||
    user.status !== "ACTIVE" ||
    !organization ||
    organization.status !== "ACTIVE" ||
    membership?.status !== "ACTIVE"
  )
    return null;
  const activeViewAsRole = isDemoApplication() ? session.viewAsRole : null,
    viewUser = activeViewAsRole
      ? identityRepository
          .read()
          .users.find(
            (candidate) =>
              (!session.viewAsUserId ||
                candidate.id === session.viewAsUserId) &&
              getMembership(identityRepository, candidate.id, organization.id)
                ?.status === "ACTIVE" &&
              primaryRoleContext(
                identityRepository,
                getMembership(
                  identityRepository,
                  candidate.id,
                  organization.id,
                )!.id,
              ).template?.code === activeViewAsRole &&
              candidate.isDemoUser &&
              candidate.status === "ACTIVE",
          )
      : user,
    viewMembership = getMembership(
      identityRepository,
      viewUser?.id ?? user.id,
      organization.id,
    ),
    primary = primaryRoleContext(
      identityRepository,
      viewMembership?.id ?? membership.id,
    ),
    effectiveRole: RevenueRole | null =
      activeViewAsRole ?? primary.template?.code ?? null;
  return {
    user: toPublicUser(user),
    membership,
    organization,
    permissions: [
      ...resolvePermissions(
        identityRepository,
        viewUser ?? user,
        viewMembership ?? membership,
      ),
    ],
    scope: getUserScope(
      identityRepository,
      (viewUser ?? user).id,
      organization.id,
    ),
    applicationMode: getApplicationMode(),
    isViewingAs: Boolean(activeViewAsRole),
    viewAsRole: activeViewAsRole,
    viewAsUserId: activeViewAsRole ? (viewUser?.id ?? null) : null,
    simulatableUsers: identityRepository
      .read()
      .users.flatMap((candidate) => {
        const candidateMembership = getMembership(
          identityRepository,
          candidate.id,
          organization.id,
        );
        const candidateRole = candidateMembership
          ? primaryRoleContext(identityRepository, candidateMembership.id)
              .template?.code
          : null;
        return candidate.isDemoUser &&
          candidate.status === "ACTIVE" &&
          candidateMembership?.status === "ACTIVE" &&
          candidateRole
          ? [
              {
                id: candidate.id,
                displayName: candidate.displayName,
                role: candidateRole,
              },
            ]
          : [];
      })
      .sort((a, b) => {
        const aPriority = simulationPriority.indexOf(a.id);
        const bPriority = simulationPriority.indexOf(b.id);
        if (aPriority !== -1 || bPriority !== -1) {
          if (aPriority === -1) return 1;
          if (bPriority === -1) return -1;
          if (aPriority !== bPriority) return aPriority - bPriority;
        }
        return a.displayName.localeCompare(b.displayName);
      }),
    effectiveRole,
    viewUser: toPublicUser(viewUser ?? user),
    primaryRole: primary.definition ?? null,
  };
}
export async function setViewAsRole(
  role: RevenueRole | null,
  viewAsUserId: string | null = null,
) {
  if (!isDemoApplication()) return false;
  await identityRepository.refresh?.();
  const jar = await cookies(),
    token = jar.get(SESSION_COOKIE)?.value;
  if (!token) return false;
  const session = identityRepository.findSessionByTokenHash(tokenHash(token));
  if (!session?.organizationId) return false;
  const user = identityRepository.findUserById(session.userId),
    membership = user
      ? getMembership(identityRepository, user.id, session.organizationId)
      : undefined;
  if (
    !user ||
    !user.isDemoUser ||
    !membership ||
    !["ORG_OWNER", "ORG_ADMIN"].includes(membership.adminRole)
  )
    return false;
  if (
    role &&
    !identityRepository
      .read()
      .systemRoleTemplates.some(
        (template) => template.code === role && template.isActive,
      )
  )
    return false;
  if (role && viewAsUserId) {
    const candidate = identityRepository.findUserById(viewAsUserId),
      candidateMembership = candidate
        ? getMembership(
            identityRepository,
            candidate.id,
            session.organizationId,
          )
        : undefined,
      candidateRole = candidateMembership
        ? primaryRoleContext(identityRepository, candidateMembership.id)
            .template?.code
        : null;
    if (
      !candidate ||
      !candidate.isDemoUser ||
      candidate.status !== "ACTIVE" ||
      candidateMembership?.status !== "ACTIVE" ||
      candidateRole !== role
    )
      return false;
  }
  identityRepository.saveSession({
    ...session,
    viewAsRole: role,
    viewAsUserId: role ? viewAsUserId : null,
    lastSeenAt: new Date().toISOString(),
  });
  await flushIdentityRepository();
  return true;
}
export async function getRawSessionUser() {
  await identityRepository.refresh?.();
  const token = (await cookies()).get(SESSION_COOKIE)?.value;
  if (!token) return null;
  const session = identityRepository.findSessionByTokenHash(tokenHash(token));
  if (!session || Date.parse(session.expiresAt) <= Date.now()) return null;
  const user = identityRepository.findUserById(session.userId);
  return user?.status === "ACTIVE" ? user : null;
}
