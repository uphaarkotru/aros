"use client";
import Link from "next/link";
import { useEffect, useState } from "react";
import { revenueRoles, type RevenueRole } from "@/auth/types";
import { roleDisplay, todayPath } from "@/auth/permissions";
import {
  useOptionalSession,
  type SessionContextValue,
} from "@/auth/session-context";

type IdentityControlsSession = Pick<
  SessionContextValue,
  | "user"
  | "viewUser"
  | "membership"
  | "applicationMode"
  | "isViewingAs"
  | "viewAsRole"
  | "viewAsUserId"
  | "simulatableUsers"
  | "effectiveRole"
>;
const defaultSimulationPeople: Partial<Record<RevenueRole, string>> = {
  AE: "user-ae-sarah",
  RSM: "user-rsm-mark",
  VP_SALES: "user-vp-jennifer",
  CRO: "user-cro-michael",
};

export function IdentityControls() {
  const sessionContext = useOptionalSession(),
    [remoteSession, setRemoteSession] =
      useState<IdentityControlsSession | null>(null),
    session = sessionContext ?? remoteSession,
    [selectedRoleState, setSelectedRole] = useState<RevenueRole | "" | null>(
      null,
    ),
    selectedRole = selectedRoleState ?? session?.viewAsRole ?? "",
    people =
      session?.simulatableUsers.filter(
        (person) => !selectedRole || person.role === selectedRole,
      ) ?? [];
  useEffect(() => {
    if (sessionContext) return;
    let active = true;
    void fetch("/api/auth/me")
      .then((response) => (response.ok ? response.json() : null))
      .then((value: IdentityControlsSession | null) => {
        if (active) setRemoteSession(value);
      })
      .catch(() => {
        if (active) setRemoteSession(null);
      });
    return () => {
      active = false;
    };
  }, [sessionContext]);
  async function viewAs(role: RevenueRole | null, userId: string | null) {
    const response = await fetch("/api/auth/view-as", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ role, userId }),
    });
    if (response.ok) {
      window.location.assign(
        role
          ? todayPath[role]
          : session?.effectiveRole
            ? todayPath[session.effectiveRole]
            : "/admin",
      );
    }
  }
  async function returnToAdmin() {
    const response = await fetch("/api/auth/view-as", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ role: null, userId: null }),
    });
    if (response.ok) {
      window.location.assign("/admin");
    }
  }
  async function logout() {
    await fetch("/api/auth/logout", { method: "POST" });
    window.location.assign("/login");
  }
  if (!session) return null;
  const admin = ["ORG_OWNER", "ORG_ADMIN"].includes(
    session.membership.adminRole,
  );
  return (
    <div className="identity-controls">
      <div className="simulation-controls">
        {session.isViewingAs && (
          <span className="identity-name simulation-identity">
            {session.viewUser.displayName}
            <small>Simulated · {roleDisplay[session.viewUser.role]}</small>
          </span>
        )}
        {session.applicationMode === "DEMO" && admin && (
          <>
            <label>
              Simulate role
              <select
                aria-label="Simulate revenue role"
                value={selectedRole}
                onChange={(event) => {
                  const role = (event.target.value ||
                    null) as RevenueRole | null;
                  setSelectedRole(role ?? "");
                  if (!role) void viewAs(null, null);
                  else if (defaultSimulationPeople[role])
                    void viewAs(role, defaultSimulationPeople[role]!);
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
                  value={session.viewAsUserId ?? people[0]?.id ?? ""}
                  onChange={(event) =>
                    void viewAs(
                      selectedRole as RevenueRole,
                      event.target.value || null,
                    )
                  }
                >
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
      </div>
      <div className="signed-in-controls">
        <span className="identity-name">
          {session.user.displayName}
          <small>Signed in · {roleDisplay[session.user.role]}</small>
        </span>
        {admin &&
          (session.isViewingAs ? (
            <button className="admin-link" onClick={() => void returnToAdmin()}>
              Back to admin experience
            </button>
          ) : (
            <Link className="admin-link" href="/admin">
              Administration
            </Link>
          ))}
        <button onClick={logout}>Log out</button>
      </div>
    </div>
  );
}
