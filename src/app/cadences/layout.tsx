import type { ReactNode } from "react";
import { redirect } from "next/navigation";
import { requireIdentity } from "@/auth/guards.server";
import { SessionProvider } from "@/auth/session-context";
import { TodayShell } from "@/components/today-shell";

export default async function CadenceLayout({
  children,
}: {
  children: ReactNode;
}) {
  const identity = await requireIdentity();
  if (!identity.effectiveRole && !identity.isViewingAs)
    redirect(
      ["ORG_OWNER", "ORG_ADMIN"].includes(identity.membership.adminRole)
        ? "/admin"
        : "/access-denied",
    );
  return (
    <SessionProvider value={identity}>
      <TodayShell
        role={identity.effectiveRole!}
        isViewingAs={identity.isViewingAs}
        activeSection="cadences"
      >
        {children}
      </TodayShell>
    </SessionProvider>
  );
}
