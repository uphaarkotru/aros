import type { RevenueRole } from "@/auth/types";

export type NavigationEntry = {
  label: string;
  href: string;
};

/** Canonical links shared by the AE Today and account experiences. */
export const aeNavigation: NavigationEntry[] = [
  { label: "Accounts", href: "/accounts" },
  { label: "Opportunities", href: "/opportunities" },
  { label: "Cadences", href: "/cadences" },
  { label: "Performance", href: "/performance" },
];

/** Canonical navigation for each revenue role. Keep this shared by every shell. */
export const roleNavigation: Partial<Record<RevenueRole, NavigationEntry[]>> = {
  SDR: [
    { label: "Accounts / Prospects", href: "/accounts" },
    { label: "Prospecting", href: "/today" },
    { label: "Cadences", href: "/cadences" },
    { label: "Performance", href: "/performance" },
  ],
  AE: aeNavigation,
  RSM: [
    { label: "Accounts", href: "/accounts" },
    { label: "Opportunities", href: "/opportunities" },
    { label: "Cadences", href: "/cadences" },
    { label: "Performance", href: "/performance" },
  ],
  SALES_ENGINEER: [
    { label: "Accounts", href: "/accounts" },
    { label: "Opportunities", href: "/opportunities" },
    { label: "Technical Work", href: "/today" },
    { label: "Cadences", href: "/cadences" },
    { label: "Commitments", href: "/cadences" },
  ],
  SALES_ENGINEER_MANAGER: [
    { label: "Technical Portfolio", href: "/accounts" },
    { label: "Capacity", href: "/today" },
    { label: "Team", href: "/today" },
    { label: "Cadences", href: "/cadences" },
    { label: "Commitments", href: "/cadences" },
  ],
  PARTNER_SALES: [
    { label: "Accounts", href: "/accounts" },
    { label: "Opportunities", href: "/opportunities" },
    { label: "Partners", href: "/accounts" },
    { label: "Cadences", href: "/cadences" },
  ],
  VP_SALES: [
    { label: "Accounts", href: "/accounts" },
    { label: "Opportunities", href: "/opportunities" },
    { label: "Cadences", href: "/cadences" },
    { label: "Performance", href: "/performance" },
  ],
  CRO: [
    { label: "Accounts", href: "/accounts" },
    { label: "Opportunities", href: "/opportunities" },
    { label: "Cadences", href: "/cadences" },
    { label: "Performance", href: "/performance" },
  ],
};

export const navigationForRole = (role: RevenueRole): NavigationEntry[] =>
  roleNavigation[role] ?? aeNavigation;
