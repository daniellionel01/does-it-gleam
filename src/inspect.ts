import * as path from "node:path";
import * as fs from "node:fs/promises";
import { type AllConfig } from "./config.ts";
import { fileExists, safePathSegment } from "./fs_util.ts";

type CostAgg = {
  attempts: number;
  totalTokens: number;
  costUsd: number;
};

export async function inspectCache(opts: {
  cfg: AllConfig;
  artifactsDir: string;
  showCost?: boolean;
}): Promise<void> {
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

  if (opts.showCost) {
    const { totalAgg, byModelId } = await scanCostSoFar({
      artifactsDir: opts.artifactsDir,
      modelIds: opts.cfg.models.map((m) => m.id)
    });

    const dollars = (n: number) => `$${n.toFixed(6)}`;
    console.log(
      `Cost so far: ${dollars(totalAgg.costUsd)} across ${totalAgg.attempts} attempt(s) (tokens ${totalAgg.totalTokens})`
    );

    const rows = [...byModelId.entries()]
      .filter(([, v]) => v.attempts > 0)
      .sort((a, b) => b[1].costUsd - a[1].costUsd);

    for (const [modelId, v] of rows) {
      console.log(`${modelId}  ${dollars(v.costUsd)}  attempts ${v.attempts}  tokens ${v.totalTokens}`);
    }
  }
}

async function scanCostSoFar(opts: {
  artifactsDir: string;
  modelIds: string[];
}): Promise<{ totalAgg: CostAgg; byModelId: Map<string, CostAgg> }> {
  const byModelId = new Map<string, CostAgg>();
  const safeToModel = new Map<string, string>();
  for (const id of opts.modelIds) {
    safeToModel.set(safePathSegment(id), id);
    byModelId.set(id, { attempts: 0, totalTokens: 0, costUsd: 0 });
  }

  const totalAgg: CostAgg = { attempts: 0, totalTokens: 0, costUsd: 0 };
  const jobsRoot = path.join(opts.artifactsDir, "jobs");

  let modelDirs: Array<string> = [];
  try {
    modelDirs = await fs.readdir(jobsRoot);
  } catch {
    return { totalAgg, byModelId };
  }

  for (const safeModel of modelDirs) {
    const modelId = safeToModel.get(safeModel);
    if (!modelId) continue;

    const modelAgg = byModelId.get(modelId)!;
    const modelRoot = path.join(jobsRoot, safeModel);
    let challengeDirs: Array<string> = [];
    try {
      challengeDirs = await fs.readdir(modelRoot);
    } catch {
      continue;
    }

    for (const challengeId of challengeDirs) {
      const challengeRoot = path.join(modelRoot, challengeId);
      let runDirs: Array<string> = [];
      try {
        runDirs = await fs.readdir(challengeRoot);
      } catch {
        continue;
      }

      for (const runDir of runDirs) {
        if (!runDir.startsWith("run-")) continue;
        const runRoot = path.join(challengeRoot, runDir);
        let attemptDirs: Array<string> = [];
        try {
          attemptDirs = await fs.readdir(runRoot);
        } catch {
          continue;
        }

        for (const attemptDir of attemptDirs) {
          if (!attemptDir.startsWith("attempt-")) continue;
          const responsePath = path.join(runRoot, attemptDir, "response.json");
          try {
            const s = await fs.readFile(responsePath, "utf8");
            const j = JSON.parse(s) as { usage?: { cost?: number; total_tokens?: number; totalTokens?: number } };
            const cost = typeof j.usage?.cost === "number" ? j.usage.cost : 0;
            const tokens =
              typeof j.usage?.total_tokens === "number"
                ? j.usage.total_tokens
                : typeof (j.usage as any)?.totalTokens === "number"
                  ? (j.usage as any).totalTokens
                  : 0;

            modelAgg.attempts += 1;
            modelAgg.totalTokens += tokens;
            modelAgg.costUsd += cost;

            totalAgg.attempts += 1;
            totalAgg.totalTokens += tokens;
            totalAgg.costUsd += cost;
          } catch {
            // ignore missing/partial attempts
          }
        }
      }
    }
  }

  return { totalAgg, byModelId };
}
