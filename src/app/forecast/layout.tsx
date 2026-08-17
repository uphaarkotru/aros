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
        activeSection="forecast"
      >
        {children}
      </TodayShell>
    </SessionProvider>
  );
}
