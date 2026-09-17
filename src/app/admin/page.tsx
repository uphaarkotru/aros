import { requireOrganizationAdmin } from "@/auth/admin-guards.server";
import { identityRepository } from "@/auth/repository.server";
import { isDemoOrganization } from "@/auth/application-mode";
import { DemoRoleSwitcher } from "./users/demo-role-switcher";

export default async function AdminOverview() {
  const identity = await requireOrganizationAdmin();
  const store = identityRepository.read();
  const organizationId = identity.organization.id;
  const checks = [
    [
      "Users configured",
      store.memberships.some(
        (item) =>
          item.organizationId === organizationId && item.status === "ACTIVE",
      ),
    ],
    [
      "Roles configured",
      store.organizationRoles.some(
        (item) => item.organizationId === organizationId && item.isActive,
      ),
    ],
    [
      "Organization structure configured",
      store.organizationalUnits.some(
        (item) => item.organizationId === organizationId,
      ),
    ],
    [
      "Reporting relationships configured",
      store.relationships.some(
        (item) =>
          item.organizationId === organizationId &&
          item.relationshipType === "REPORTS_TO",
      ),
    ],
    [
      "Revenue teams configured",
      store.revenueTeamAssignments.some(
        (item) => item.organizationId === organizationId,
      ),
    ],
    ["Methodology selected", Boolean(identity.organization.defaultMethodology)],
    [
      "CRM configured",
      store.integrations.some(
        (item) =>
          item.organizationId === organizationId &&
          item.category === "CRM" &&
          item.status === "CONNECTED",
      ),
    ],
    [
      "Governance reviewed",
      store.governanceConfigurations.some(
        (item) => item.organizationId === organizationId,
      ),
    ],
  ] as const;
  return (
    <main className="admin-workspace">
      <span className="eyebrow">ORGANIZATION ADMINISTRATION</span>
      <h1>Configuration overview</h1>
      <p>Deterministic readiness checks for {identity.organization.name}.</p>
      <section className="admin-overview-controls" aria-label="Demo controls">
        <div className="admin-overview-control-card">
          <span className="eyebrow">DEMO CONTROLS</span>
          <h2>Role simulation</h2>
          <p>
            These controls are available from Overview so revenue screens stay
            focused on the active role experience.
          </p>
          {isDemoOrganization(identity.organization) && (
            <DemoRoleSwitcher people={identity.simulatableUsers} />
          )}
          {!isDemoOrganization(identity.organization) && (
            <p>Role simulation is disabled for this tenant environment.</p>
          )}
        </div>
      </section>
      <section className="readiness-checklist">
        {checks.map(([label, ready]) => (
          <article key={label}>
            <i className={ready ? "ready" : ""} />
            <strong>{label}</strong>
            <span>{ready ? "Ready" : "Needs configuration"}</span>
          </article>
        ))}
      </section>
    </main>
  );
}
