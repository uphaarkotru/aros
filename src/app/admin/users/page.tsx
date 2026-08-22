import { redirect } from "next/navigation";
import { requireIdentity } from "@/auth/guards.server";
import { identityRepository } from "@/auth/repository.server";
import { toOrganizationAdminUser } from "@/auth/user-administration";
import { UserAdmin } from "./user-admin";

export default async function UsersAdminPage() {
  const identity = await requireIdentity();
  if (!["ORG_OWNER", "ORG_ADMIN"].includes(identity.membership.adminRole))
    redirect("/access-denied");
  const membershipUserIds = new Set(
      identityRepository
        .read()
        .memberships.filter(
          (item) => item.organizationId === identity.organization.id,
        )
        .map((item) => item.userId),
    ),
    users = identityRepository
      .read()
      .users.filter((user) => membershipUserIds.has(user.id))
      .map((user) =>
        toOrganizationAdminUser(
          identityRepository,
          user,
          identity.organization.id,
        ),
      );
  return (
    <UserAdmin
      initialUsers={users}
      organizationName={identity.organization.name}
      actorId={identity.user.id}
    />
  );
}
