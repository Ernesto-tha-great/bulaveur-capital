import { type Job } from "bullmq";
import { logger } from "../logger";
import { makeQueue, makeWorker } from "../queue/queue";

/**
 * Missions are the unit of autonomy: a named job on a cron cadence. This is how
 * each product "runs itself" — Bulaveur's "06:30 ET morning brief", Grantsmith's
 * "nightly grant discovery sweep". Register missions, then run a worker that
 * executes them when the scheduler fires.
 */
export interface MissionContext {
  runId: string;
}

export interface Mission {
  name: string;
  /** cron pattern in UTC, e.g. "30 11 * * 1-5" (11:30 UTC = 06:30 ET weekdays). */
  cron: string;
  description?: string;
  run: (ctx: MissionContext) => Promise<void>;
}

const QUEUE = "missions";

export class MissionRegistry {
  private readonly missions = new Map<string, Mission>();

  register(...m: Mission[]): this {
    for (const x of m) this.missions.set(x.name, x);
    return this;
  }
  all(): Mission[] {
    return [...this.missions.values()];
  }
  get(name: string): Mission | undefined {
    return this.missions.get(name);
  }
}

/** Install/refresh the cron schedules in Redis. Idempotent. */
export async function scheduleMissions(registry: MissionRegistry): Promise<void> {
  const q = makeQueue(QUEUE);
  for (const m of registry.all()) {
    await q.upsertJobScheduler(m.name, { pattern: m.cron }, { name: m.name, data: {} });
    logger.info({ mission: m.name, cron: m.cron }, "mission.scheduled");
  }
}

/** Long-lived worker that executes missions when the scheduler fires them. */
export function startMissionWorker(registry: MissionRegistry) {
  return makeWorker(QUEUE, async (job: Job) => {
    const mission = registry.get(job.name);
    if (!mission) {
      logger.warn({ job: job.name }, "mission.unknown");
      return;
    }
    logger.info({ mission: mission.name }, "mission.start");
    await mission.run({ runId: job.id ?? mission.name });
    logger.info({ mission: mission.name }, "mission.done");
  });
}
