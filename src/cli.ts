#!/usr/bin/env bun

import { Command } from "commander";
import { loadEnv } from "./env.ts";
import { loadAllConfig } from "./config.ts";
import { planSuite, runSuite } from "./runner.ts";
import { buildReport } from "./report.ts";
import { inspectCache } from "./inspect.ts";

const program = new Command();

program
  .name("does-it-gleam")
  .description("Run Gleam coding challenges against OpenRouter models")
  .option("--config-dir <dir>", "Config directory", "config")
  .option("--artifacts-dir <dir>", "Artifacts directory", "artifacts");

program.addHelpText(
  "after",
  `
Examples:
  bun src/cli.ts run --dry-run
  bun src/cli.ts run --model openai/gpt-5.2 --challenge fizzbuzz --runs 1 --concurrency 1
  bun src/cli.ts inspect --cost
  bun src/cli.ts report
`
);

program
  .command("run")
  .description("Run suite (resumable)")
  .option("--model <modelId>", "Only run a single model")
  .option("--challenge <challengeId>", "Only run a single challenge")
  .option("--runs <n>", "Number of runs per (model, challenge)", (v) => Number(v))
  .option("--attempts <n>", "Max attempts per run", (v) => Number(v))
  .option("--concurrency <n>", "Parallel workers", (v) => Number(v))
  .option("--temperature <n>", "LLM temperature", (v) => Number(v))
  .option("--dry-run", "Print planned jobs and exit")
  .action(async (opts) => {
    const global = program.opts();
    const cfg = await loadAllConfig(global.configDir);

    const overrides: Record<string, number> = {};
    for (const [k, v] of Object.entries({
      runs: opts.runs,
      attempts: opts.attempts,
      concurrency: opts.concurrency,
      temperature: opts.temperature
    })) {
      if (typeof v === "number" && Number.isFinite(v)) overrides[k] = v;
    }

    if (opts.dryRun) {
      await planSuite({
        cfg,
        artifactsDir: global.artifactsDir,
        filterModelId: opts.model,
        filterChallengeId: opts.challenge,
        overrides: {
          runs: overrides.runs,
          attempts: overrides.attempts,
          concurrency: overrides.concurrency,
          temperature: overrides.temperature
        }
      });
      return;
    }

    loadEnv();

    await runSuite({
      cfg,
      artifactsDir: global.artifactsDir,
      filterModelId: opts.model,
      filterChallengeId: opts.challenge,
      overrides: {
        runs: overrides.runs,
        attempts: overrides.attempts,
        concurrency: overrides.concurrency,
        temperature: overrides.temperature
      }
    });
  });

program
  .command("report")
  .description("Generate artifacts/summary.json and artifacts/report.html")
  .action(async () => {
    const global = program.opts();
    const cfg = await loadAllConfig(global.configDir);
    await buildReport({ cfg, artifactsDir: global.artifactsDir });
    console.log(`Wrote ${global.artifactsDir}/summary.json and ${global.artifactsDir}/report.html`);
  });

program
  .command("inspect")
  .description("Show cached progress (use --cost for spend)")
  .option("--cost", "Show cost/tokens so far (total + per model)")
  .action(async (opts) => {
    const global = program.opts();
    const cfg = await loadAllConfig(global.configDir);
    await inspectCache({ cfg, artifactsDir: global.artifactsDir, showCost: Boolean(opts.cost) });
  });

await program.parseAsync(process.argv);
