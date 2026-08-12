import { requireIdentity } from "@/auth/guards.server";import { MorningBriefingDashboard } from "@/features/morning-briefing/morning-briefing-dashboard";import { redirect } from "next/navigation";
export default async function Page(){const identity=await requireIdentity();if(identity.effectiveRole!=="AE")redirect("/access-denied");return <MorningBriefingDashboard/>}
