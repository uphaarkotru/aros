import { createHash, randomBytes } from "node:crypto";
import type { IdentityRepository } from "./repository";
import type { User } from "./types";

export function rotateOwnerInvitation(repository: IdentityRepository, actor: User, organizationId: string) {
  if (actor.platformRole !== "SUPER_ADMIN") return { ok: false as const, error: "Platform administrator access is required." };
  const store = repository.read();
  const owner = store.memberships.find((item) => item.organizationId === organizationId && item.adminRole === "ORG_OWNER");
  const user = owner ? store.users.find((item) => item.id === owner.userId) : undefined;
  const pending = store.invitations.find((item) => item.organizationId === organizationId && item.adminRole === "ORG_OWNER" && item.status === "PENDING");
  if (!user || !pending) return { ok: false as const, error: "Pending owner invitation not found." };
  const token = randomBytes(32).toString("base64url");
  repository.update((data) => {
    data.invitations = data.invitations.map((item) => item.id === pending.id ? {
      ...item,
      email: user.email,
      tokenHash: createHash("sha256").update(token).digest("hex"),
      expiresAt: new Date(Date.now() + 7 * 86_400_000).toISOString(),
    } : item);
  });
  return { ok: true as const, value: { token } };
}
