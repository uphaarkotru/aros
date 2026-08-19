import type { ReactNode } from "react";
import { redirect } from "next/navigation";
import { requireIdentity } from "@/auth/guards.server";
import { SessionProvider } from "@/auth/session-context";
import { TodayShell } from "@/components/today-shell";

export default async function ForecastLayout({
  children,
}: {
  children: ReactNode;
}) {
  const identity = await requireIdentity();
  if (identity.effectiveRole !== "VP_SALES" && identity.effectiveRole !== "CRO")
    redirect("/access-denied");
  return (
    <SessionProvider value={identity}>
      <TodayShell
        role={identity.effectiveRole}
        isViewingAs={identity.isViewingAs}
        organization={identity.organization.name}
        scope={identity.scope?.accountIds.length ? `${identity.scope.accountIds.length} accounts in scope` : "Organization scope"}
        signedInAs={identity.user.displayName}
        viewingAs={identity.isViewingAs ? identity.viewUser.displayName : undefined}
        activeSection="forecast"
      >
        {children}
      </TodayShell>
    </SessionProvider>
  );
}
