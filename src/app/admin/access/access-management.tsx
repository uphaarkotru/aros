"use client";
import { useState, type FormEvent } from "react";
type Member = { id: string; label: string; adminRole: string; status: string };
export function AccessManagement({ members }: { members: Member[] }) {
  const [message, setMessage] = useState("");
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const response = await fetch("/api/admin/foundation", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(Object.fromEntries(new FormData(event.currentTarget))) });
    const result = await response.json().catch(() => ({}));
    if (!response.ok) return setMessage(result.error ?? "Unable to update access.");
    setMessage("Administrative access updated. Refreshing…"); location.reload();
  }
  return <>{members.map((member) => <form className="table-edit-form" onSubmit={submit} key={member.id}><input type="hidden" name="action" value="admin-role"/><input type="hidden" name="membershipId" value={member.id}/><strong>{member.label}</strong><label>Administrative authority<select name="adminRole" defaultValue={member.adminRole}><option>MEMBER</option><option>ORG_ADMIN</option><option>ORG_OWNER</option></select></label><label>Membership status<select name="status" defaultValue={member.status}><option>ACTIVE</option><option>SUSPENDED</option><option>DEACTIVATED</option></select></label><button>Save</button></form>)}{!members.length && <p>No memberships exist yet. Invite the first user from Invitations.</p>}{message && <p role="status">{message}</p>}</>;
}
