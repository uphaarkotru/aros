import Link from "next/link";
import type { ReactNode } from "react";
import { IdentityControls } from "./identity-controls";
import { roleDisplay } from "@/auth/permissions";
import type { RevenueRole } from "@/auth/types";
const nav: Partial<Record<RevenueRole, string[]>> = {
  SDR: [
    "Accounts / Prospects",
    "Prospecting",
    "Actions",
    "Cadences",
    "Meetings",
    "Performance",
  ],
  AE: [
    "AI Workforce",
    "Accounts",
    "Cadences",
    "Decisions",
    "Signals",
    "Forecast",
    "Executive",
    "Settings",
  ],
  RSM: [
    "Accounts",
    "Opportunities",
    "Actions",
    "Cadences",
    "Forecast",
    "Performance",
    "Management",
  ],
  SALES_ENGINEER: [
    "Accounts",
    "Opportunities",
    "Technical Work",
    "Cadences",
    "Commitments",
  ],
  SALES_ENGINEER_MANAGER: [
    "Technical Portfolio",
    "Capacity",
    "Team",
    "Cadences",
    "Commitments",
  ],
  PARTNER_SALES: [
    "Accounts",
    "Opportunities",
    "Partners",
    "Actions",
    "Cadences",
    "Meetings",
  ],
  VP_SALES: [
    "Accounts",
    "Opportunities",
    "Cadences",
    "Forecast",
    "Performance",
    "Management",
    "Learning",
  ],
  CRO: ["Forecast", "Cadences", "Executive", "Learning", "Governance"],
};
export function TodayShell({
  role,
  isViewingAs,
  activeSection = "today",
  children,
}: {
  role: RevenueRole;
  isViewingAs: boolean;
  activeSection?: "today" | "cadences" | "forecast";
  children: ReactNode;
}) {
  const homeLabel = role === "AE" ? "AI Command Center" : "Today";

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
            href="/today"
          >
            {homeLabel}
          </Link>
          {(
            nav[role] ?? [
              "Accounts",
              "Opportunities",
              "Actions",
              "Cadences",
              "Commitments",
            ]
          ).map((item) =>
            item === "Cadences" ||
            item === "Accounts" ||
            item === "Forecast" ? (
              <Link
                className={`nav-item ${(activeSection === "cadences" && item === "Cadences") || (activeSection === "forecast" && item === "Forecast") ? "active" : ""}`}
                href={
                  item === "Cadences"
                    ? "/cadences"
                    : item === "Forecast"
                      ? "/forecast"
                      : "/accounts"
                }
                key={item}
              >
                {item}
              </Link>
            ) : (
              <span className="nav-item" key={item}>
                {item}
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
          <div>
            <span className="eyebrow">
              {roleDisplay[role]} OPERATING EXPERIENCE
            </span>
          </div>
          <IdentityControls />
        </header>
        {children}
      </div>
    </div>
  );
}
