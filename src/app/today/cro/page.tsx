import { requireIdentity } from "@/auth/guards.server";
import { identityRepository } from "@/auth/repository.server";
import { getMembership, primaryRoleContext } from "@/auth/tenant-model";
import { getAllDescendants } from "@/auth/hierarchy";
import { leadershipRepository } from "@/db/leadership-repository";
import {
  averageTeamSellingScores,
  getTeamSellingScores,
} from "@/db/operating-repository";
import { LeadershipBriefing } from "@/features/leadership/leadership-briefing";
import { redirect } from "next/navigation";
import "../leadership.css";

export default async function Page() {
  const identity = await requireIdentity();
  if (identity.effectiveRole !== "CRO") redirect("/access-denied");
  const membership = getMembership(
    identityRepository,
    identity.viewUser.id,
    identity.organization.id,
  );
  if (!membership || !leadershipRepository) redirect("/access-denied");
  const brief = await leadershipRepository.getLeadershipBrief(
    identity.organization.id,
    membership.id,
    "CRO",
  );
  const aeMembershipIds = getAllDescendants(
    identityRepository,
    identity.viewUser.id,
    identity.organization.id,
  )
    .map((user) =>
      getMembership(identityRepository, user.id, identity.organization.id),
    )
    .filter((item): item is NonNullable<typeof item> => Boolean(item))
    .filter(
      (item) =>
        primaryRoleContext(identityRepository, item.id).template?.code === "AE",
    )
    .map((item) => item.id);
  const teamSellingScores = await getTeamSellingScores(
    identity.organization.id,
    aeMembershipIds,
  );
  const teamSellingHealth = averageTeamSellingScores(
    aeMembershipIds
      .map((membershipId) => teamSellingScores[membershipId])
      .filter((score): score is NonNullable<typeof score> => Boolean(score)),
  );
  return (
    <LeadershipBriefing
      name={identity.viewUser.firstName}
      brief={{ ...brief, teamSellingHealth }}
    />
  );
}
