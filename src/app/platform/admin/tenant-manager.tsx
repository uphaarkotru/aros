"use client";
import { useState, type FormEvent } from "react";
import type { Organization } from "@/auth/types";
import { tenantTimezones, timezoneLabel } from "./timezones";
type TenantOwner = {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
};
const months = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
];
export function TenantManager({
  organization,
  administrators,
  owner,
}: {
  organization: Organization;
  administrators: string[];
  owner?: TenantOwner;
}) {
  const [message, setMessage] = useState("");
  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const body = {
      ...Object.fromEntries(new FormData(event.currentTarget)),
      organizationId: organization.id,
      version: organization.version ?? 1,
    },
      response = await fetch("/api/platform/organizations", {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(body),
      }),
      result = await response.json().catch(() => ({}));
    setMessage(
      response.ok
        ? "Tenant updated. Refreshing…"
        : (result.error ?? "Unable to update tenant."),
    );
    if (response.ok) location.reload();
  }
  const timezoneOptions = tenantTimezones.includes(
    organization.timezone as (typeof tenantTimezones)[number],
  )
    ? tenantTimezones
    : [organization.timezone, ...tenantTimezones];
  return (
    <section className="platform-tenant-manager">
      <header>
        <div>
          <span className="eyebrow">EDIT TENANT</span>
          <h2>{organization.name}</h2>
        </div>
        <a href={`/t/${organization.slug}`} target="_blank" rel="noreferrer">
          Open tenant landing page
        </a>
      </header>
      <form className="admin-inline-form" onSubmit={save}>
        <label>
          Name
          <input name="name" defaultValue={organization.name} required />
        </label>
        <label>
          Slug
          <input
            name="slug"
            defaultValue={organization.slug}
            pattern="[a-z0-9-]{2,80}"
            required
          />
        </label>
        <label>
          Primary domain
          <input
            name="primaryDomain"
            defaultValue={organization.primaryDomain ?? ""}
          />
        </label>
        <label>
          Timezone
          <select name="timezone" defaultValue={organization.timezone}>
            {timezoneOptions.map((timezone) => (
              <option value={timezone} key={timezone}>
                {timezoneLabel(timezone)}
              </option>
            ))}
          </select>
        </label>
        <label>
          Fiscal year start month
          <select
            name="fiscalYearStartMonth"
            defaultValue={organization.fiscalYearStartMonth ?? 1}
          >
            {months.map((month, index) => (
              <option value={index + 1} key={month}>
                {month}
              </option>
            ))}
          </select>
        </label>
        <label>
          Environment
          <select name="environment" defaultValue={organization.environment}>
            <option>DEMO</option>
            <option>SANDBOX</option>
            <option>PRODUCTION</option>
          </select>
        </label>
        <label>
          Status
          <select name="status" defaultValue={organization.status}>
            <option>PROVISIONING</option>
            <option>ACTIVE</option>
            <option>SUSPENDED</option>
            <option>ARCHIVED</option>
          </select>
        </label>
        {owner && (
          <>
            <label>
              Owner email
              <input
                name="ownerEmail"
                type="email"
                defaultValue={owner.email}
                required
              />
            </label>
            <label>
              Owner first name
              <input
                name="ownerFirstName"
                defaultValue={owner.firstName}
                required
              />
            </label>
            <label>
              Owner last name
              <input
                name="ownerLastName"
                defaultValue={owner.lastName}
                required
              />
            </label>
          </>
        )}
        <button>Save tenant</button>
      </form>
      {!owner && (
        <p role="status">
          No tenant owner is configured. Add an ORG_OWNER before editing owner
          details.
        </p>
      )}
      <p>
        <strong>Owners/admins:</strong>{" "}
        {administrators.join(", ") || "None configured"}
      </p>
      {message && <p role="status">{message}</p>}
      <small>
        Platform authority manages tenant lifecycle and metadata. Opening the
        tenant Admin console requires a separate ORG_OWNER or ORG_ADMIN
        membership.
      </small>
    </section>
  );
}
