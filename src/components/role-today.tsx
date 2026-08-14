import { roleDisplay } from "@/auth/permissions";
import type { RevenueRole } from "@/auth/types";
const copy: Partial<Record<RevenueRole, { headline: string; items: string[] }>> = {
  SDR: {
    headline: "Turn signals into qualified conversations",
    items: [
      "Prospecting intelligence",
      "Assigned account signals",
      "Today’s approved outreach",
    ],
  },
  AE: {
    headline: "Prioritize the decisions that move revenue",
    items: ["Account intelligence", "Recommended actions", "Commitments due"],
  },
  RSM: {
    headline: "Coach the team where judgment matters",
    items: [
      "Manager decision queue",
      "Seller commitments",
      "Team forecast risk",
    ],
  },
  SALES_ENGINEER: {
    headline: "Advance the technical decision",
    items: [
      "Technical opportunity context",
      "POC and security blockers",
      "Technical commitments",
    ],
  },
  SALES_ENGINEER_MANAGER: {
    headline: "Coordinate technical revenue capacity",
    items: [
      "SE opportunity portfolio",
      "Technical risk",
      "Resource allocation",
    ],
  },
  PARTNER_SALES: {
    headline: "Orchestrate partner-influenced revenue",
    items: ["Partner intelligence", "Co-sell actions", "Shared commitments"],
  },
  VP_SALES: {
    headline: "See execution patterns across your organization",
    items: [
      "Manager and team rollup",
      "Forecast movement",
      "Resource allocation",
    ],
  },
  CRO: {
    headline: "Lead the revenue system",
    items: [
      "Enterprise forecast",
      "Executive intelligence",
      "Governance and learning",
    ],
  },
};
export function RoleToday({ role, name }: { role: RevenueRole; name: string }) {
  const data = copy[role] ?? {headline:"Collaborate on the revenue motions where your expertise matters",items:["Assigned revenue context","Cross-functional actions","Shared commitments"]};
  return (
    <main className="role-today">
      <h1>Good morning, {name}</h1>
      <p>{data.headline}</p>
      <section className="role-cards">
        {data.items.map((item, index) => (
          <article key={item}>
            <span>0{index + 1}</span>
            <h2>{item}</h2>
            <p>
              AI has prepared scoped context for your {roleDisplay[role]}{" "}
              decisions.
            </p>
          </article>
        ))}
      </section>
    </main>
  );
}
