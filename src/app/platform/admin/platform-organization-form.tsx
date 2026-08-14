"use client";
import { useState, type FormEvent } from "react";
import { tenantTimezones, timezoneLabel } from "./timezones";

const months = ["January","February","March","April","May","June","July","August","September","October","November","December"];

export function PlatformOrganizationForm() {
  const [message, setMessage] = useState("");
  const [acceptancePath, setAcceptancePath] = useState("");
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const body = Object.fromEntries(new FormData(event.currentTarget));
    body.useStandardOrgTemplate = "true";
    const response = await fetch("/api/platform/organizations", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) });
    const result = await response.json().catch(() => ({}));
    if (!response.ok) return setMessage(result.error ?? "Unable to create tenant.");
    const invitation = await fetch("/api/platform/organizations/owner-invitation", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ organizationId: result.organization.id }) });
    const invitationResult = await invitation.json().catch(() => ({}));
    setMessage(invitation.ok ? "Organization created. Share the one-time owner link below." : "Organization created, but the owner link could not be generated.");
    setAcceptancePath(invitationResult.acceptancePath ?? "");
  }
  return <form className="admin-inline-form" onSubmit={submit}>
    <input name="name" placeholder="Organization name" required/><input name="slug" placeholder="slug" required/><input name="primaryDomain" placeholder="domain.com"/>
    <label>Timezone<select name="timezone" defaultValue="America/Los_Angeles">{tenantTimezones.map((timezone) => <option value={timezone} key={timezone}>{timezoneLabel(timezone)}</option>)}</select></label>
    <label>Fiscal year start month<select name="fiscalYearStartMonth" defaultValue="1">{months.map((month,index) => <option value={index + 1} key={month}>{month}</option>)}</select></label>
    <select name="environment"><option>SANDBOX</option><option>PRODUCTION</option><option>DEMO</option></select>
    <input name="ownerEmail" type="email" placeholder="owner@company.com" required/><input name="ownerFirstName" placeholder="Owner first name" required/><input name="ownerLastName" placeholder="Owner last name" required/>
    <button>Create tenant</button>{message && <span role="status">{message}</span>}{acceptancePath && <a href={acceptancePath}>{location.origin}{acceptancePath}</a>}
  </form>;
}
