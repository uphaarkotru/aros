import { redirect } from "next/navigation";
import { requireIdentity } from "@/auth/guards.server";
import { todayPath } from "@/auth/permissions";
export default async function TodayPage(){const identity=await requireIdentity();if(!identity.effectiveRole)redirect(["ORG_OWNER","ORG_ADMIN"].includes(identity.membership.adminRole)?"/admin":"/access-denied");redirect(todayPath[identity.effectiveRole])}
