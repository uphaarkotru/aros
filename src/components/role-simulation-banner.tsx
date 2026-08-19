"use client";

import { useEffect, useState } from "react";
import { roleDisplay } from "@/auth/permissions";
import type { RevenueRole } from "@/auth/types";

type SessionSnapshot = {
  isViewingAs: boolean;
  effectiveRole: RevenueRole | null;
};

export function RoleSimulationBanner() {
  const [session, setSession] = useState<SessionSnapshot | null>(null);

  useEffect(() => {
    let active = true;
    void fetch("/api/auth/me")
      .then((response) => (response.ok ? response.json() : null))
      .then((value: SessionSnapshot | null) => {
        if (active) setSession(value);
      })
      .catch(() => {
        if (active) setSession(null);
      });
    return () => {
      active = false;
    };
  }, []);

  if (!session?.isViewingAs) return null;
  return (
    <div className="view-as-banner">
      Role simulation active · {roleDisplay[session.effectiveRole ?? "AE"]}{" "}
      experience · scope and jurisdiction match the selected demo person ·
      actions remain attributed to the signed-in user
    </div>
  );
}
