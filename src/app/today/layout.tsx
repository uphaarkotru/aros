import type { ReactNode } from "react";
import { redirect } from "next/navigation";
import { requireIdentity } from "@/auth/guards.server";
import { SessionProvider } from "@/auth/session-context";
import { TodayShell } from "@/components/today-shell";
export default async function TodayLayout({children}:{children:ReactNode}){const identity=await requireIdentity();if(["ORG_OWNER","ORG_ADMIN"].includes(identity.membership.adminRole)&&!identity.primaryRole&&!identity.isViewingAs)redirect("/admin");return <SessionProvider value={identity}><TodayShell role={identity.effectiveRole} isViewingAs={identity.isViewingAs}>{children}</TodayShell></SessionProvider>}
