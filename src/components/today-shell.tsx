import Link from "next/link";
import type { ReactNode } from "react";
import { IdentityControls } from "./identity-controls";
import { roleDisplay, todayPath } from "@/auth/permissions";
import type { RevenueRole } from "@/auth/types";
import { navigationForRole } from "./navigation-config";
export function TodayShell({
  role,
  isViewingAs,
  activeSection = "today",
  children,
}: {
  role: RevenueRole;
  isViewingAs: boolean;
  organization?: string;
  scope?: string;
  signedInAs?: string;
  viewingAs?: string;
  activeSection?:
    | "today"
    | "accounts"
    | "opportunities"
    | "cadences"
    | "forecast"
    | "performance";
  children: ReactNode;
}) {
  const homeLabel = "Today";

  return (
    <div className="role-shell">
      <aside className="role-sidebar">
        <div className="brand">
          <strong>
            CogniVit<span>.ai</span>
          </strong>
          <small>AROS · AUTONOMOUS REVENUE OS</small>
        </div>
        <nav>
          <Link
            className={`nav-item ${activeSection === "today" ? "active" : ""}`}
            href={todayPath[role]}
          >
            {homeLabel}
          </Link>
          {navigationForRole(role).map((item) =>
            item.href ? (
              <Link
                className={`nav-item ${(activeSection === "cadences" && item.label === "Cadences") || (activeSection === "forecast" && item.label === "Forecast") || (activeSection === "performance" && item.label === "Performance") || (activeSection === "accounts" && item.label.includes("Account")) || (activeSection === "opportunities" && item.label === "Opportunities") ? "active" : ""}`}
                href={item.href}
                key={item.label}
              >
                {item.label}
              </Link>
            ) : (
              <span className="nav-item" key={item.label}>
                {item.label}
              </span>
            ),
          )}
        </nav>
      </aside>
      <div className="role-main">
        {isViewingAs && (
          <div className="view-as-banner">
            Role simulation active · {roleDisplay[role]} experience · scope and
            jurisdiction match the selected demo person · actions remain
            attributed to the signed-in user
          </div>
        )}
        <header className="role-header">
          <IdentityControls />
        </header>
        {children}
      </div>
    </div>
  );
}
