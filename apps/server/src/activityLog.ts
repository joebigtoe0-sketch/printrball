import type { ActivityEntry, ActivityType } from "./types.js";
import { loadActivity, saveActivity } from "./persist.js";
import { config } from "./config.js";

let nextId = 1;

export async function initActivityLog() {
  const existing = await loadActivity(config.dataDir);
  nextId = existing.reduce((m, e) => Math.max(m, e.id), 0) + 1;
}

export async function appendActivity(
  type: ActivityType,
  fields: { roundId?: number; wallet?: string; meta?: Record<string, unknown> },
) {
  const entry: ActivityEntry = {
    id: nextId++,
    ts: Date.now(),
    type,
    ...fields,
  };
  const all = await loadActivity(config.dataDir);
  all.unshift(entry);
  await saveActivity(config.dataDir, all);
  return entry;
}
