import { redirect } from "next/navigation";
import { requireIdentity } from "@/auth/guards.server";
import { identityRepository } from "@/auth/repository.server";
import { getMembership } from "@/auth/tenant-model";
import { leadershipRepository } from "@/db/leadership-repository";
import { LeadershipBriefing } from "@/features/leadership/leadership-briefing";
import "../today/leadership.css";

export default async function ForecastPage() {
  const identity = await requireIdentity();
  if (identity.effectiveRole !== "VP_SALES" && identity.effectiveRole !== "CRO")
    redirect("/access-denied");
  const membership = getMembership(
    identityRepository,
    identity.viewUser.id,
    identity.organization.id,
  );
  if (!membership || !leadershipRepository) redirect("/access-denied");
  const level = identity.effectiveRole === "CRO" ? "CRO" : "VP",
    brief = await leadershipRepository.getLeadershipBrief(
      identity.organization.id,
      membership.id,
      level,
    );
  return (
    <LeadershipBriefing name={identity.viewUser.firstName} brief={brief} />
  );
}
