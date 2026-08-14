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
    "Meetings",
    "Performance",
  ],
  AE: ["Accounts", "Opportunities", "Actions", "Meetings", "Performance"],
  RSM: [
    "Accounts",
    "Opportunities",
    "Actions",
    "Forecast",
    "Performance",
    "Management",
  ],
  SALES_ENGINEER: [
    "Accounts",
    "Opportunities",
    "Technical Work",
    "Commitments",
  ],
  SALES_ENGINEER_MANAGER: [
    "Technical Portfolio",
    "Capacity",
    "Team",
    "Commitments",
  ],
  PARTNER_SALES: [
    "Accounts",
    "Opportunities",
    "Partners",
    "Actions",
    "Meetings",
  ],
  VP_SALES: [
    "Accounts",
    "Opportunities",
    "Forecast",
    "Performance",
    "Management",
    "Learning",
  ],
  CRO: ["Forecast", "Executive", "Learning", "Governance"],
};
export function TodayShell({
  role,
  isViewingAs,
  children,
}: {
  role: RevenueRole;
  isViewingAs: boolean;
  children: ReactNode;
}) {
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
          <Link className="nav-item active" href="/today">
            Today
          </Link>
          {(nav[role]??["Accounts","Opportunities","Actions","Commitments"]).map((item) => (
            <span className="nav-item" key={item}>
              {item}
            </span>
          ))}
        </nav>
      </aside>
      <div className="role-main">
        {isViewingAs && (
          <div className="view-as-banner">
            Role simulation active · {roleDisplay[role]} experience · actions
            remain attributed to the signed-in user
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
