import { requireOrganizationAdmin } from "@/auth/admin-guards.server";
import { identityRepository } from "@/auth/repository.server";
import { AccessManagement } from "./access-management";
export default async function AccessPage() {
  const identity = await requireOrganizationAdmin(), store = identityRepository.read();
  const members = store.memberships.filter((item) => item.organizationId === identity.organization.id).map((item) => ({ id: item.id, label: store.users.find((user) => user.id === item.userId)?.displayName ?? item.userId, adminRole: item.adminRole, status: item.status }));
  return <main className="admin-workspace"><span className="eyebrow">ADMINISTRATIVE ACCESS</span><h1>Owners and administrators</h1><p>Administrative authority is independent of revenue roles. Promote another active owner before transferring or removing the last owner.</p><AccessManagement members={members}/></main>;
}
