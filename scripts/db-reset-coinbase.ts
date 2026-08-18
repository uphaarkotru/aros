import { query } from "../src/db/client";
import { demoScenarioRepository } from "../src/db/demo-scenario-repository";

async function main() {
  const membership = (
    await query<{ id: string }>(
      `SELECT id FROM organization_memberships WHERE organization_id='org-cognivit-demo' AND user_id='user-platform-admin' LIMIT 1`,
    )
  ).rows[0];
  if (!membership) throw new Error("Demo platform administrator membership is missing; run db:seed first.");
  const result = await demoScenarioRepository.resetCoinbase({
    organizationId: "org-cognivit-demo",
    userId: "user-platform-admin",
    membershipId: membership.id,
  });
  console.log(`Reset ${result.scenarioKey} to ${result.state}.`);
}
main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
