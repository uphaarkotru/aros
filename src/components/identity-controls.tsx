"use client";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { revenueRoles, type RevenueRole } from "@/auth/types";
import { roleDisplay, todayPath } from "@/auth/permissions";
import { useSession } from "@/auth/session-context";

export function IdentityControls() {
  const session = useSession(),
    router = useRouter(),
    [selectedRole, setSelectedRole] = useState<RevenueRole | "">(
      session.viewAsRole ?? "",
    ),
    people = session.simulatableUsers.filter(
      (person) => !selectedRole || person.role === selectedRole,
    );
  async function viewAs(role: RevenueRole | null, userId: string | null) {
    const response = await fetch("/api/auth/view-as", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ role, userId }),
    });
    if (response.ok) {
      router.push(
        role
          ? todayPath[role]
          : session.effectiveRole
            ? todayPath[session.effectiveRole]
            : "/admin",
      );
      router.refresh();
    }
  }
  async function logout() {
    await fetch("/api/auth/logout", { method: "POST" });
    window.location.assign("/login");
  }
  const admin = ["ORG_OWNER", "ORG_ADMIN"].includes(
    session.membership.adminRole,
  );
  return (
    <div className="identity-controls">
      <span className="identity-name">
        {session.isViewingAs
          ? session.viewUser.displayName
          : session.user.displayName}
        <small>
          {session.effectiveRole
            ? roleDisplay[session.effectiveRole]
            : "No revenue role"}
        </small>
      </span>
      {admin && (
        <Link className="admin-link" href="/admin">
          Administration
        </Link>
      )}
      {session.applicationMode === "DEMO" && admin && (
        <>
          <label>
            Simulate role
            <select
              aria-label="Simulate revenue role"
              value={selectedRole}
              onChange={(event) => {
                const role = (event.target.value || null) as RevenueRole | null;
                setSelectedRole(role ?? "");
                if (!role) void viewAs(null, null);
              }}
            >
              <option value="">My role</option>
              {revenueRoles.map((role) => (
                <option value={role} key={role}>
                  {roleDisplay[role]}
                </option>
              ))}
            </select>
          </label>
          {selectedRole && (
            <label>
              Simulate person
              <select
                aria-label="Simulate person"
                value={session.viewAsUserId ?? ""}
                onChange={(event) =>
                  void viewAs(
                    selectedRole as RevenueRole,
                    event.target.value || null,
                  )
                }
              >
                <option value="">Choose a person…</option>
                {people.map((person) => (
                  <option value={person.id} key={person.id}>
                    {person.displayName}
                  </option>
                ))}
              </select>
            </label>
          )}
        </>
      )}
      <button onClick={logout}>Log out</button>
    </div>
  );
}
