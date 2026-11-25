// @effect-diagnostics nodeBuiltinImport:off -- Creates temp fixture files inside the fake PTY login callback.
import * as NodeFS from "node:fs";
import * as NodePath from "node:path";
import * as NodeCrypto from "@effect/platform-node/NodeCrypto";
import * as NodeServices from "@effect/platform-node/NodeServices";
import { PluginContext, PluginError } from "@t3tools/plugin-api";
import * as HostProcess from "@t3tools/shared/HostProcess";
import * as PtyAdapter from "@t3tools/shared/PtyAdapter";
import { assert, describe, it } from "@effect/vitest";
import * as Effect from "effect/Effect";
import * as Fiber from "effect/Fiber";
import * as FileSystem from "effect/FileSystem";
import * as Layer from "effect/Layer";
import * as Option from "effect/Option";
import * as Stream from "effect/Stream";

import { buildSharedMemoryInstructions } from "./instructions.ts";
import { Binary, makeSharedMemorySync } from "./sync.ts";

const fixture = `#!/usr/bin/env node
const fs = require('node:fs'); const path = require('node:path');
const args = process.argv.slice(2); const action = args[0];
if (process.env.OBSIDIAN_AUTH_TOKEN !== 'token-secret') process.exit(2);
if (action === 'sync') {
  const counter = path.join(process.env.HOME, 'sync-count');
  const count = fs.existsSync(counter) ? Number(fs.readFileSync(counter, 'utf8')) + 1 : 1;
  fs.writeFileSync(counter, String(count));
  if (count === 2) process.exit(1);
  console.log('Fully synced');
}
if (action === 'sync-list-remote') console.log(JSON.stringify({ vaults: [{ id: 'vault-1', name: 'Memory', region: 'us' }], shared: [] }));
if (action === 'sync-setup') fs.mkdirSync(args[args.indexOf('--path') + 1], { recursive: true });
`;

const fakeLoginPty = Layer.succeed(
  PtyAdapter.PtyAdapter,
  PtyAdapter.PtyAdapter.of({
    spawn: (options) =>
      Effect.gen(function* () {
        const platform = yield* HostProcess.Platform;
        const prompts = ["Email: ", "Password: ", "2FA code: "];
        const values: Array<string> = [];
        let buffer = "";
        let dataListener: ((data: string) => void) | undefined;
        let exitListener: ((event: PtyAdapter.PtyExitEvent) => void) | undefined;
        const authPath =
          platform === "linux"
            ? NodePath.join(options.env.HOME ?? "", ".config/obsidian-headless/auth_token")
            : NodePath.join(options.env.HOME ?? "", ".obsidian-headless/auth_token");
        return {
          pid: 12345,
          write: (data: string) => {
            for (const char of data) {
              if (char === "\r") {
                values.push(buffer);
                buffer = "";
                if (values.length === 3) {
                  if (values.join("|") !== "agent@example.com|password-secret|123456") {
                    exitListener?.({ exitCode: 2, signal: null });
                    return;
                  }
                  NodeFS.mkdirSync(NodePath.dirname(authPath), { recursive: true });
                  NodeFS.writeFileSync(authPath, "token-secret");
                  exitListener?.({ exitCode: 0, signal: null });
                } else {
                  dataListener?.(prompts[values.length] ?? "");
                }
              } else {
                buffer += char;
              }
            }
          },
          resize: () => undefined,
          kill: () => undefined,
          onData: (cb) => {
            dataListener = cb;
            queueMicrotask(() => cb(prompts[0] ?? ""));
            return () => {
              dataListener = undefined;
            };
          },
          onExit: (cb) => {
            exitListener = cb;
            return () => {
              exitListener = undefined;
            };
          },
        } satisfies PtyAdapter.PtyProcess;
      }),
  }),
);

describe("buildSharedMemoryInstructions", () => {
  it("sanitizes line breaks and angle brackets in folder paths and agent ids", () => {
    const text = buildSharedMemoryInstructions({
      folder: "/vault/\n<evil>",
      agentId: "agent\r1",
    });
    assert.include(text, "Shared agent identity: agent?1.");
    assert.include(text, "Shared memory folder: /vault/?‹evil›.");
    assert.isTrue(text.startsWith("<shared_memory>"));
    assert.isTrue(text.endsWith("</shared_memory>"));
  });
});

describe("makeSharedMemorySync", () => {
  it.live(
    "logs in privately, persists only the token, initializes a pulled vault, exposes agentInstructions, and stops on logout",
    () =>
      Effect.gen(function* () {
        const fs = yield* FileSystem.FileSystem;
        const dataDir = yield* fs.makeTempDirectoryScoped({
          prefix: "p0-obsidian-plugin-",
        });
        const binary = `${dataDir}/fake-ob.cjs`;
        yield* fs.writeFileString(binary, fixture);
        yield* fs.chmod(binary, 0o700);

        const storage = new Map<string, string>();
        const statuses: Array<string | null> = [];
        const unused = Effect.fail(new PluginError({ message: "unused" }));
        const pluginContextLayer = Layer.succeed(
          PluginContext,
          PluginContext.of({
            pluginId: "obsidian-shared-memory",
            dataDir,
            storage: {
              get: (key) => Effect.sync(() => Option.fromUndefinedOr(storage.get(key))),
              set: (key, value) =>
                Effect.sync(() => {
                  storage.set(key, value);
                }),
              remove: (key) =>
                Effect.sync(() => {
                  storage.delete(key);
                }),
            },
            reportStatus: (message) =>
              Effect.sync(() => {
                statuses.push(message);
              }),
            environment: {
              environmentId: Effect.die("unused"),
              descriptor: Effect.die("unused"),
              localOrigin: unused,
            },
            deviceAccess: { issueCredential: () => unused, revokeAll: Effect.void },
            agentActivity: {
              changes: Stream.empty,
              read: () => Effect.succeed(null),
              activeThreadIds: Effect.succeed([]),
            },
            usage: { dailyTotals: () => Effect.succeed([]) },
          }),
        );

        const sync = yield* makeSharedMemorySync.pipe(
          Effect.provide(
            Layer.mergeAll(pluginContextLayer, fakeLoginPty, Layer.succeed(Binary, binary)),
          ),
        );

        assert.strictEqual((yield* sync.status).connected, false);
        assert.isNull(yield* sync.agentInstructions);

        yield* sync.command({
          action: "login",
          email: "agent@example.com",
          password: "password-secret",
          mfa: "123456",
        });
        assert.strictEqual(storage.get("token"), "token-secret");

        const vaults = yield* sync.vaults;
        assert.strictEqual(vaults.vaults[0]?.id, "vault-1");

        const restarted = yield* fs.watch(`${dataDir}/obsidian-headless-home`).pipe(
          Stream.filterEffect(() =>
            fs.readFileString(`${dataDir}/obsidian-headless-home/sync-count`).pipe(
              Effect.map((value) => Number(value) >= 3),
              Effect.orElseSucceed(() => false),
            ),
          ),
          Stream.runHead,
          Effect.forkScoped,
        );
        const state = yield* sync.command({
          action: "configure",
          vault: "vault-1",
          folder: "",
        });
        yield* Fiber.join(restarted);

        assert.isNotEmpty(state.agentId);
        assert.strictEqual(state.enabled, false);
        assert.isNull(yield* sync.agentInstructions);
        for (const name of ["agent.json", "MEMORY.md", "README.md", "issues", "notes"]) {
          assert.isTrue(yield* fs.exists(`${state.folder}/${name}`));
        }
        const initialIdentity = yield* fs.readFileString(`${state.folder}/agent.json`);

        yield* sync.command({ action: "preferences", enabled: true, agentId: "" });
        const instructions = yield* sync.agentInstructions;
        assert.isString(instructions);
        assert.include(instructions ?? "", state.folder);
        assert.include(instructions ?? "", state.agentId);

        yield* sync.command({ action: "pause" });
        assert.strictEqual((yield* sync.status).phase, "idle");
        assert.include(statuses, "Paused · vault-1");

        yield* sync.command({ action: "configure", vault: "vault-1", folder: state.folder });
        yield* sync.command({ action: "pause" });
        assert.strictEqual(yield* fs.readFileString(`${state.folder}/agent.json`), initialIdentity);

        const preferences = yield* fs.readFileString(`${dataDir}/shared-memory.json`);
        assert.notInclude(preferences, "password-secret");
        assert.notInclude(preferences, "token-secret");
        assert.notInclude(preferences, "123456");

        const loggedOut = yield* sync.command({ action: "logout" });
        assert.strictEqual(loggedOut.connected, false);
        assert.isNull(yield* sync.agentInstructions);
        assert.isUndefined(storage.get("token"));
      }).pipe(Effect.scoped, Effect.provide(Layer.merge(NodeServices.layer, NodeCrypto.layer))),
  );
});
