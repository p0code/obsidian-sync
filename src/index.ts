import { definePlugin } from "@t3tools/plugin-api";
import * as Effect from "effect/Effect";

import { OBSIDIAN_SHARED_MEMORY_ID, sharedMemoryActions } from "./actions.ts";
import { makeSharedMemorySync } from "./sync.ts";

export const obsidianSharedMemory = definePlugin({
  manifest: {
    id: OBSIDIAN_SHARED_MEMORY_ID,
    name: "Obsidian shared memory",
    description:
      "Syncs a shared agent memory folder through Obsidian Sync (Obsidian Headless) and tells every agent turn where it is, so agents on all your machines read and add to the same notes.",
    version: "0.1.0",
    unofficial: true,
    externalServices: ["Obsidian Sync"],
    capabilities: ["network:outbound", "process:spawn", "agent:instructions"],
    httpRoutes: [],
  },
  actions: sharedMemoryActions,
  start: Effect.gen(function* () {
    const sync = yield* makeSharedMemorySync;
    return {
      actions: {
        status: () => sync.status,
        vaults: () => sync.vaults,
        command: sync.command,
      },
      agentInstructions: sync.agentInstructions,
    };
  }),
});
