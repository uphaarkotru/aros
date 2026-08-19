import Link from "next/link";
import type { RevenueRole } from "@/auth/types";
import { navigationForRole } from "./navigation-config";
import { RoleSimulationBanner } from "./role-simulation-banner";
import { IdentityControls } from "./identity-controls";
export function ApplicationShell({
  children,
  active,
  role,
}: {
  children: React.ReactNode;
  active: "accounts" | "opportunities" | "cadences" | "performance";
  role?: RevenueRole;
}) {
  const navigation = navigationForRole(role ?? "AE");
  return (
    <div className="app-shell">
      <aside className="sidebar" aria-label="Main navigation">
        <div className="brand">
          <strong>
            CogniVit<span>.ai</span>
          </strong>
          <small>AROS · AUTONOMOUS REVENUE OS</small>
        </div>
        <nav>
          <Link className="nav-item" href="/today">
            Today
          </Link>
          {navigation.map(({ label, href }) => (
            <Link
              className={`nav-item ${
                (active === "accounts" && label.includes("Account")) ||
                (active === "opportunities" && label === "Opportunities") ||
                (active === "cadences" && label === "Cadences") ||
                (active === "performance" && label === "Performance")
                  ? "active"
                  : ""
              }`}
              href={href}
              key={label}
            >
              {label}
            </Link>
          ))}
        </nav>
      </aside>
      <div className="app-main">
        <RoleSimulationBanner />
        <header className="role-header">
          <IdentityControls />
        </header>
        <main className="main-content accounts-main">{children}</main>
      </div>
    </div>
  );
}
