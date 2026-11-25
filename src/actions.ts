import * as Schema from "effect/Schema";

export const OBSIDIAN_SHARED_MEMORY_ID = "obsidian-shared-memory";

export const SharedMemoryStatus = Schema.Struct({
  connected: Schema.Boolean,
  phase: Schema.Literals(["idle", "syncing", "error"]),
  folder: Schema.String,
  vault: Schema.String,
  agentId: Schema.String,
  enabled: Schema.Boolean,
  paused: Schema.Boolean,
  lastSyncedAt: Schema.NullOr(Schema.String),
  lastError: Schema.NullOr(Schema.String),
  snippet: Schema.String,
});
export type SharedMemoryStatus = typeof SharedMemoryStatus.Type;

const Vault = Schema.Struct({ id: Schema.String, name: Schema.String, region: Schema.String });
export const SharedMemoryVaults = Schema.Struct({
  vaults: Schema.Array(Vault),
  shared: Schema.Array(Vault),
});
export type SharedMemoryVaults = typeof SharedMemoryVaults.Type;

export const SharedMemoryCommand = Schema.Union([
  Schema.Struct({
    action: Schema.Literal("login"),
    email: Schema.String,
    password: Schema.String,
    mfa: Schema.optional(Schema.String),
  }),
  Schema.Struct({
    action: Schema.Literal("configure"),
    vault: Schema.String,
    folder: Schema.String,
    password: Schema.optional(Schema.String),
  }),
  Schema.Struct({
    action: Schema.Literal("preferences"),
    enabled: Schema.Boolean,
    agentId: Schema.String,
  }),
  Schema.Struct({ action: Schema.Literals(["pause", "resume", "logout"]) }),
]);
export type SharedMemoryCommand = typeof SharedMemoryCommand.Type;

const NoInput = Schema.Struct({});

/** The settings panel's calls; each runs through the host's plugin invoke RPC. */
export const sharedMemoryActions = {
  status: { input: NoInput, output: SharedMemoryStatus },
  vaults: { input: NoInput, output: SharedMemoryVaults },
  command: { input: SharedMemoryCommand, output: SharedMemoryStatus },
};
