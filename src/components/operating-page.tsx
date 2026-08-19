import type { ReactNode } from "react";
import { requireIdentity } from "@/auth/guards.server";
import { SessionProvider } from "@/auth/session-context";
import { TodayShell } from "@/components/today-shell";

export async function OperatingPage({
  children,
  activeSection = "today",
}: {
  children: ReactNode;
  activeSection?:
    | "today"
    | "accounts"
    | "opportunities"
    | "cadences"
    | "forecast"
    | "performance";
}) {
  const identity = await requireIdentity();
  return (
    <SessionProvider value={identity}>
      <TodayShell
        role={identity.effectiveRole!}
        isViewingAs={identity.isViewingAs}
        organization={identity.organization.name}
        scope={
          identity.scope?.accountIds.length
            ? `${identity.scope.accountIds.length} accounts in scope`
            : "Organization scope"
        }
        signedInAs={identity.user.displayName}
        viewingAs={
          identity.isViewingAs ? identity.viewUser.displayName : undefined
        }
        activeSection={activeSection}
      >
        {children}
      </TodayShell>
    </SessionProvider>
  );
}
