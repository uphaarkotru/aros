import { redirect } from "next/navigation";
import { requireIdentity } from "@/auth/guards.server";
import { todayPath } from "@/auth/permissions";
export default async function TodayPage(){const identity=await requireIdentity();redirect(todayPath[identity.effectiveRole])}
