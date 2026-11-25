// Control characters and Unicode line separators would let a path add lines to the agent's context.
const LINE_BREAKING = /[\p{Cc}\p{Zl}\p{Zp}]/gu;
const folderPath = (value: string) =>
  value.replaceAll(LINE_BREAKING, "?").replaceAll("<", "‹").replaceAll(">", "›");

/** Added to every agent turn while shared memory is on, and shown for harnesses outside p0code. */
export function buildSharedMemoryInstructions(memory: {
  readonly folder: string;
  readonly agentId: string;
}): string {
  return `<shared_memory>Shared agent identity: ${folderPath(memory.agentId)}. Shared memory folder: ${folderPath(memory.folder)}. Read MEMORY.md before starting. Save durable learnings as one-fact Markdown notes in notes/ linked from MEMORY.md. After fixing a notable issue, write issues/YYYY-MM-DD-<slug>.md with problem, root cause, fix, repo, and machine. Preserve other agents' notes; never store secrets.</shared_memory>`;
}
