import { ApplicationShell } from "@/components/application-shell";
import { AccountsList } from "@/features/accounts/accounts-list";
import { requireIdentity } from "@/auth/guards.server";
import { revenueRepository } from "@/db/revenue-repository";
import type { AccountDigitalTwin } from "@/domain/accounts/account-digital-twin";
export default async function AccountsPage() {
  const identity = await requireIdentity(),
    accounts = await revenueRepository.listAccounts(identity.organization.id),
    allowed = new Set(identity.scope?.accountIds ?? []),
    twins = (
      await Promise.all(
        accounts
          .filter((account) => allowed.has(account.id))
          .map((account) =>
            revenueRepository.getTwinByAccount(
              identity.organization.id,
              account.id,
            ),
          ),
      )
    )
      .filter(Boolean)
      .map((twin) => twin!.state as unknown as AccountDigitalTwin);
  return (
    <ApplicationShell
      active="accounts"
      role={identity.effectiveRole ?? undefined}
    >
      <AccountsList twins={twins} />
    </ApplicationShell>
  );
}
