import { getAuthenticatedIdentity } from "@/auth/session.server";

export async function ApplicationModeBadge() {
  const identity = await getAuthenticatedIdentity();
  const mode = identity?.applicationMode ?? "PRODUCTION";
  return (
    <div
      className={`application-mode ${mode.toLowerCase()}`}
      title={
        mode === "DEMO"
          ? "Demo data and role simulation are enabled for this tenant."
          : "Production-safe tenant behavior; role simulation is disabled."
      }
    >
      <i />
      {mode === "DEMO" ? "Demo tenant" : "Production-safe tenant"}
    </div>
  );
}
