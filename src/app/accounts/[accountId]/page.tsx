import Link from "next/link";
import { redirect } from "next/navigation";
import { ApplicationShell } from "@/components/application-shell";
import { ReconciledAccountDetail } from "@/features/accounts/reconciled-account-detail";
import { requireIdentity } from "@/auth/guards.server";
import { revenueRepository } from "@/db/revenue-repository";
import type { AccountDigitalTwin } from "@/domain/accounts/account-digital-twin";
import { leadingIndicatorRepository } from "@/db/leading-indicator-repository";
import { identityRepository } from "@/auth/repository.server";
import { getMembership } from "@/auth/tenant-model";
const missing = () => (
  <ApplicationShell active="accounts">
    <section className="not-found">
      <h1>Account not found</h1>
      <p>The requested Account Digital Twin is unavailable.</p>
      <Link className="primary-button" href="/accounts">
        Return to accounts
      </Link>
    </section>
  </ApplicationShell>
);
export default async function AccountPage({
  params,
}: {
  params: Promise<{ accountId: string }>;
}) {
  const { accountId } = await params;
  if (
    process.env.NODE_ENV === "test" &&
    !process.env.TEST_DATABASE_URL &&
    !(
      await import("@/data/synthetic/final-account-digital-twins")
    ).getAccountDigitalTwin(accountId)
  )
    return missing();
  const identity = await requireIdentity();
  if (!identity.scope?.accountIds.includes(accountId))
    redirect("/access-denied");
  const account = await revenueRepository.getAccount(
      identity.organization.id,
      accountId,
    ),
    twin = account
      ? await revenueRepository.getTwinByAccount(
          identity.organization.id,
          accountId,
        )
      : null;
  if (!account || !twin) return missing();
  const membership = getMembership(
      identityRepository,
      identity.viewUser.id,
      identity.organization.id,
    ),
    leadingIndicators =
      leadingIndicatorRepository && membership
        ? await leadingIndicatorRepository.listForViewer({
            organizationId: identity.organization.id,
            membershipId: membership.id,
            accountId,
          })
        : [],
    coachingInsights =
      leadingIndicatorRepository && membership
        ? await leadingIndicatorRepository.listCoachingInsights({
            organizationId: identity.organization.id,
            membershipId: membership.id,
            accountId,
          })
        : [],
    timeline =
      leadingIndicatorRepository && membership
        ? await leadingIndicatorRepository.getIndicatorTimeline({
            organizationId: identity.organization.id,
            membershipId: membership.id,
            accountId,
          })
        : [];
  return (
    <ApplicationShell active="accounts">
      <ReconciledAccountDetail
        twin={twin.state as unknown as AccountDigitalTwin}
        leadingIndicators={leadingIndicators}
        coachingInsights={coachingInsights}
        timeline={timeline}
      />
    </ApplicationShell>
  );
}
