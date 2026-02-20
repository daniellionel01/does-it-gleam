import * as path from "node:path";
import { type AllConfig } from "./config.ts";
import { fileExists, safePathSegment } from "./fs_util.ts";

export async function inspectCache(opts: { cfg: AllConfig; artifactsDir: string }): Promise<void> {
  const runCount = opts.cfg.run.runs;
  let total = 0;
  let done = 0;

  for (const m of opts.cfg.models) {
    for (const c of opts.cfg.challenges) {
      for (let i = 1; i <= runCount; i++) {
        total++;
        const p = path.join(
          opts.artifactsDir,
          "jobs",
          safePathSegment(m.id),
          c.id,
          `run-${i}`,
          "result.json"
        );
        if (await fileExists(p)) done++;
      }
    }
  }

  // Keep output minimal; CLI styling layer can improve later.
  console.log(`${done}/${total} runs complete`);
}
