import Link from "next/link";
import { requireIdentity } from "@/auth/guards.server";
import { demoScenarioRepository } from "@/db/demo-scenario-repository";
import { StoryControls } from "./story-controls";
import { OperatingPage } from "@/components/operating-page";

export default async function DemoStoryPage() {
  const identity = await requireIdentity();
  if (identity.organization.id !== "org-cognivit-demo")
    return (
      <OperatingPage>
        <main className="rsm-today">
          <h1>Story mode unavailable</h1>
          <p>Story mode is limited to the demo tenant.</p>
        </main>
      </OperatingPage>
    );
  const current = await demoScenarioRepository.getState(
    identity.organization.id,
  );
  return (
    <OperatingPage>
      <main className="rsm-today">
        <header className="rsm-hero">
          <div>
            <span className="eyebrow">
              GUIDED DEMO · COINBASE RENEWAL RECOVERY
            </span>
            <h1>AROS Revenue Story Mode</h1>
            <p>
              Walk the same revenue motion from risk detection through executive
              outcome and institutional memory.
            </p>
          </div>
          <Link
            className="secondary-button"
            href="/accounts/acct-coinbase/timeline"
          >
            Open Coinbase timeline →
          </Link>
        </header>
        <section className="rsm-section">
          <h2>Coinbase Enterprise Renewal</h2>
          <p>Signal → insight → decision → action → ownership → outcome.</p>
          <StoryControls
            state={current?.state ?? "RISK_DETECTED"}
            version={Number(current?.version ?? 1)}
          />
          <ol className="operating-list">
            <li>
              <strong>1 · Risk detected</strong> Security milestone and
              commitment health deteriorate.
            </li>
            <li>
              <strong>2 · AE priority</strong> The AE reviews evidence and
              requests manager support.
            </li>
            <li>
              <strong>3 · AE–RSM 1:1</strong> Coaching and ownership are
              recorded.
            </li>
            <li>
              <strong>4 · Strategic 2x2</strong> Cross-functional blocker is
              resolved.
            </li>
            <li>
              <strong>5 · RSM–VP review</strong> Regional resource decision is
              made.
            </li>
            <li>
              <strong>6 · VP–CRO review</strong> Executive sponsor decision is
              approved.
            </li>
            <li>
              <strong>7 · Outcome</strong> Revenue Digital Twin records the
              result.
            </li>
          </ol>
        </section>
      </main>
    </OperatingPage>
  );
}
