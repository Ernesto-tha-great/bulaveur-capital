import { missions } from "../missions/index";

/**
 * Manually trigger a mission (bypassing the scheduler). Useful for testing the
 * full loop on demand: `pnpm mission morning-brief`.
 */
async function main() {
  const name = process.argv[2];
  const mission = name ? missions.get(name) : undefined;
  if (!mission) {
    // eslint-disable-next-line no-console
    console.error(`usage: pnpm mission <name>\navailable: ${missions.all().map((m) => m.name).join(", ")}`);
    process.exit(1);
  }
  // eslint-disable-next-line no-console
  console.log(`running mission: ${mission.name}`);
  await mission.run({ runId: "manual" });
  // eslint-disable-next-line no-console
  console.log("done — check the ApprovalItem queue (GET /approvals/:id).");
  process.exit(0);
}

main().catch((err) => {
  // eslint-disable-next-line no-console
  console.error(err);
  process.exit(1);
});
