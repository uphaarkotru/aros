"use client";
import { useState } from "react";
import { revenueRoles, type RevenueRole } from "@/auth/types";
import { roleDisplay, todayPath } from "@/auth/permissions";

const enabledRoles: RevenueRole[] = ["AE", "RSM", "VP_SALES", "CRO"];
const roleOrder: RevenueRole[] = [
  ...enabledRoles,
  ...revenueRoles.filter((role) => !enabledRoles.includes(role)),
];

export function DemoRoleSwitcher({
  people,
}: {
  people: { id: string; displayName: string; role: RevenueRole }[];
}) {
  const [role, setRole] = useState<RevenueRole | "">("");
  async function select(userId: string) {
    if (!role || !userId) return;
    const response = await fetch("/api/auth/view-as", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ role, userId }),
    });
    if (response.ok) window.location.assign(todayPath[role]);
  }
  return (
    <div className="admin-role-switcher">
      <label>
        Demo role
        <select
          aria-label="Simulate revenue role"
          value={role}
          onChange={(event) => setRole(event.target.value as RevenueRole)}
        >
          <option value="" disabled>
            Select experience…
          </option>
          {roleOrder.map((item) => (
            <option
              key={item}
              value={item}
              disabled={!enabledRoles.includes(item)}
            >
              {roleDisplay[item]}
            </option>
          ))}
        </select>
      </label>
      <label>
        Demo person
        <select
          aria-label="Simulate person"
          disabled={!role}
          defaultValue=""
          onChange={(event) => void select(event.target.value)}
        >
          <option value="" disabled>
            Select person…
          </option>
          {people
            .filter((person) => person.role === role)
            .map((person) => (
              <option key={person.id} value={person.id}>
                {person.displayName}
              </option>
            ))}
        </select>
      </label>
    </div>
  );
}
