import { requireIdentity } from "@/auth/guards.server";
import { identityRepository } from "@/auth/repository.server";
import { getMembership } from "@/auth/tenant-model";
import { leadershipRepository } from "@/db/leadership-repository";
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
  return (
    <LeadershipBriefing name={identity.viewUser.firstName} brief={brief} />
  );
}
