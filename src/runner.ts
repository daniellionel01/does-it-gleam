import * as path from "node:path";
import { type AllConfig, type Challenge, type Model } from "./config.ts";
import {
  ensureDir,
  fileExists,
  readJson,
  safePathSegment,
  writeFileAtomic,
  writeJsonAtomic
} from "./fs_util.ts";
import { callOpenRouterChat, extractAssistantContent } from "./openrouter.ts";
import { OpenRouterHttpError } from "./openrouter.ts";
import {
  extractFirstCodeBlock,
  generateGleamTestFile,
  prepareWorkspace,
  runGleamTest,
  writeTextFiles
} from "./gleam.ts";

const SYSTEM_PROMPT =
  "You are an expert programmer. Your task is to provide a code solution within a single Markdown code block for the given programming problem. Do not include any direct execution commands, test cases, or usage examples within the code block.";

type Overrides = Partial<{
  runs: number;
  attempts: number;
  concurrency: number;
  temperature: number;
}>;

export async function planSuite(opts: {
  cfg: AllConfig;
  artifactsDir: string;
  filterModelId?: string;
  filterChallengeId?: string;
  overrides?: Overrides;
}): Promise<void> {
  const runCfg = { ...opts.cfg.run };
  if (opts.overrides) {
    if (opts.overrides.runs !== undefined) runCfg.runs = opts.overrides.runs;
    if (opts.overrides.attempts !== undefined) runCfg.attempts = opts.overrides.attempts;
    if (opts.overrides.concurrency !== undefined) runCfg.concurrency = opts.overrides.concurrency;
    if (opts.overrides.temperature !== undefined) runCfg.temperature = opts.overrides.temperature;
  }

  const models = filterModels(opts.cfg.models, opts.filterModelId);
  const challenges = filterChallenges(opts.cfg.challenges, opts.filterChallengeId);
  const jobs: Array<{ model: Model; challenge: Challenge; runIndex: number }> = [];

  for (const model of models) {
    for (const challenge of challenges) {
      for (let i = 1; i <= runCfg.runs; i++) {
        jobs.push({ model, challenge, runIndex: i });
      }
    }
  }

  let alreadyDone = 0;
  for (const j of jobs) {
    const dir = jobDir(opts.artifactsDir, j.model.id, j.challenge.id, j.runIndex);
    const resultPath = path.join(dir, "result.json");
    if (!(await fileExists(resultPath))) continue;
    try {
      const r = (await readJson(resultPath)) as { attemptsUsed?: number };
      if (typeof r.attemptsUsed === "number") alreadyDone++;
    } catch {
      // ignore
    }
  }

  const toRun = jobs.length - alreadyDone;
  console.log(
    `Plan: ${jobs.length} job(s) (models ${models.length} x challenges ${challenges.length} x runs ${runCfg.runs}), concurrency ${runCfg.concurrency}, attempts ${runCfg.attempts}, temp ${runCfg.temperature}`
  );
  console.log(`- already complete: ${alreadyDone}`);
  console.log(`- would run now:    ${toRun}`);

  const preview = jobs.slice(0, 20);
  if (preview.length > 0) {
    console.log("Preview:");
    for (const j of preview) {
      console.log(`- ${j.model.id} ${j.challenge.id} run-${j.runIndex}`);
    }
    if (jobs.length > preview.length) {
      console.log(`- ... (${jobs.length - preview.length} more)`);
    }
  }
}

export async function runSuite(opts: {
  cfg: AllConfig;
  artifactsDir: string;
  filterModelId?: string;
  filterChallengeId?: string;
  overrides?: Overrides;
}): Promise<void> {
  const runCfg = { ...opts.cfg.run };
  if (opts.overrides) {
    if (opts.overrides.runs !== undefined) runCfg.runs = opts.overrides.runs;
    if (opts.overrides.attempts !== undefined) runCfg.attempts = opts.overrides.attempts;
    if (opts.overrides.concurrency !== undefined) runCfg.concurrency = opts.overrides.concurrency;
    if (opts.overrides.temperature !== undefined) runCfg.temperature = opts.overrides.temperature;
  }
  const models = filterModels(opts.cfg.models, opts.filterModelId);
  const challenges = filterChallenges(opts.cfg.challenges, opts.filterChallengeId);
  const jobs: Array<{ model: Model; challenge: Challenge; runIndex: number }> = [];

  for (const model of models) {
    for (const challenge of challenges) {
      for (let i = 1; i <= runCfg.runs; i++) {
        jobs.push({ model, challenge, runIndex: i });
      }
    }
  }

  await ensureDir(opts.artifactsDir);
  const concurrency = Math.max(1, runCfg.concurrency);
  let nextIndex = 0;
  let abortReason: string | null = null;

  const smallRun = jobs.length <= 50;
  let completed = 0;
  let passed = 0;
  let failed = 0;
  let skipped = 0;
  let errored = 0;

  type WorkerState = {
    status: "idle" | "running";
    modelId?: string;
    challengeId?: string;
    runIndex?: number;
    attempt?: number;
    phase?: string;
    startedAtMs?: number;
  };

  const workerStates: WorkerState[] = Array.from({ length: concurrency }, () => ({ status: "idle" }));
  const suiteStartMs = Date.now();
  let lastCompletedAtMs = suiteStartMs;
  let printedAbort = false;

  const isTty = Boolean(process.stdout.isTTY);
  const enableHeartbeat = !smallRun;
  const heartbeatIntervalMs = 5000;

  const clearLine = () => {
    if (!enableHeartbeat) return;
    if (isTty) process.stdout.write("\r\x1b[2K");
  };

  const writeLine = (s: string) => {
    if (!enableHeartbeat) {
      console.log(s);
      return;
    }
    if (isTty) {
      process.stdout.write("\r\x1b[2K" + s);
    } else {
      console.log(s);
    }
  };

  const formatDuration = (ms: number) => {
    const sec = Math.max(0, Math.floor(ms / 1000));
    const m = Math.floor(sec / 60);
    const s = sec % 60;
    if (m === 0) return `${s}s`;
    return `${m}m${s}s`;
  };

  const formatAvgMsPerJob = (avgMsPerJob: number | null) => {
    if (!avgMsPerJob || !Number.isFinite(avgMsPerJob) || avgMsPerJob <= 0) return "avg ?/job";
    return `avg ${formatDuration(avgMsPerJob)}/job`;
  };

  const phaseAbbr = (p?: string) => {
    switch (p) {
      case "requesting":
        return "req";
      case "extracting":
        return "ext";
      case "testing":
        return "test";
      case "finalizing":
        return "fin";
      default:
        return p ?? "";
    }
  };

  const renderHeartbeat = () => {
    if (!enableHeartbeat) return;
    const now = Date.now();
    const elapsedMs = now - suiteStartMs;
    const remaining = jobs.length - completed;
    const avgMsPerJob = completed > 0 ? elapsedMs / completed : null;
    const etaMs = avgMsPerJob ? remaining * avgMsPerJob : null;
    const inFlight = workerStates.filter((w) => w.status === "running");
    const inFlightCount = inFlight.length;
    const sinceLast = now - lastCompletedAtMs;

    // show up to 2 longest-running workers
    const inflightDetails = inFlight
      .slice()
      .sort((a, b) => (a.startedAtMs ?? Number.MAX_SAFE_INTEGER) - (b.startedAtMs ?? Number.MAX_SAFE_INTEGER));

    const details = inflightDetails
      .slice(0, 2)
      .map((w) => {
        const dur = w.startedAtMs ? formatDuration(now - w.startedAtMs) : "?";
        const a = w.attempt ? `a${w.attempt}` : "";
        const r = w.runIndex ? `r${w.runIndex}` : "";
        const modelShort = (w.modelId ?? "?").split("/").slice(-1)[0];
        return `${phaseAbbr(w.phase)} ${modelShort} ${w.challengeId ?? "?"} ${r} ${a} ${dur}`.trim();
      })
      .join("; ");

    const line = `Progress ${completed}/${jobs.length} pass ${passed} fail ${failed} skip ${skipped} err ${errored} | elapsed ${formatDuration(
      elapsedMs
    )} | ${formatAvgMsPerJob(avgMsPerJob)} | ${etaMs ? "ETA " + formatDuration(etaMs) : "ETA ?"} | in-flight ${inFlightCount} | last +${formatDuration(
      sinceLast
    )}${details ? " | " + details : ""}`;
    writeLine(line);
  };

  console.log(`Running ${jobs.length} job(s) with concurrency ${concurrency}`);

  let heartbeat: ReturnType<typeof setInterval> | null = null;
  if (enableHeartbeat) {
    heartbeat = setInterval(renderHeartbeat, heartbeatIntervalMs);
    renderHeartbeat();
  }

  const workers = Array.from({ length: concurrency }, (_, workerId) => (async () => {
    while (true) {
      if (abortReason) return;
      const idx = nextIndex++;
      if (idx >= jobs.length) return;
      const job = jobs[idx];

       workerStates[workerId] = {
         status: "running",
         modelId: job.model.id,
         challengeId: job.challenge.id,
         runIndex: job.runIndex,
         attempt: 0,
         phase: "requesting",
         startedAtMs: Date.now()
       };

      try {
        const outcome = await runOneJob({
          artifactsDir: opts.artifactsDir,
          model: job.model,
          challenge: job.challenge,
          runIndex: job.runIndex,
          attempts: runCfg.attempts,
          temperature: runCfg.temperature,
          openrouterBaseUrl: runCfg.openrouterBaseUrl,
          requestTimeoutMs: runCfg.requestTimeoutMs,
          onProgress: (p) => {
            const ws = workerStates[workerId];
            if (ws.status !== "running") return;
            if (typeof p.attempt === "number") ws.attempt = p.attempt;
            if (typeof p.phase === "string") ws.phase = p.phase;
          }
        });

        completed++;
        lastCompletedAtMs = Date.now();
        if (outcome.status === "skipped") skipped++;
        if (outcome.status === "done") {
          if (outcome.passed) passed++;
          else failed++;
        } else if (outcome.status === "skipped" && typeof outcome.passed === "boolean") {
          if (outcome.passed) passed++;
          else failed++;
        }

        workerStates[workerId] = { status: "idle" };

        if (smallRun) {
          let tail = "";
          if (outcome.status === "done") {
            tail = ` ${outcome.passed ? "PASS" : "FAIL"} (attempts ${outcome.attemptsUsed})`;
          } else {
            const cached = typeof outcome.passed === "boolean" ? `cached ${outcome.passed ? "PASS" : "FAIL"}` : "cached";
            tail = ` SKIP (${cached})`;
          }
          console.log(`[${completed}/${jobs.length}] ${job.model.id} ${job.challenge.id} run-${job.runIndex}${tail}`);
        } else if (completed % 25 === 0 || completed === jobs.length) {
          clearLine();
          console.log(`Progress ${completed}/${jobs.length} (pass ${passed}, fail ${failed}, skip ${skipped}, err ${errored})`);
          renderHeartbeat();
        }
      } catch (err) {
        if (err instanceof OpenRouterHttpError && err.isFatal) {
          abortReason = err.message;
        }

        const dir = jobDir(opts.artifactsDir, job.model.id, job.challenge.id, job.runIndex);
        await ensureDir(dir);
        await writeJsonAtomic(path.join(dir, "job_error.json"), {
          modelId: job.model.id,
          challengeId: job.challenge.id,
          runIndex: job.runIndex,
          error: {
            message: err instanceof Error ? err.message : String(err),
            kind: err instanceof OpenRouterHttpError ? err.kind : "unknown",
            status: err instanceof OpenRouterHttpError ? err.status : null,
            fatal: err instanceof OpenRouterHttpError ? err.isFatal : false
          },
          at: new Date().toISOString()
        });

        completed++;
        lastCompletedAtMs = Date.now();
        errored++;

        workerStates[workerId] = { status: "idle" };

        if (smallRun) {
          console.log(
            `[${completed}/${jobs.length}] ${job.model.id} ${job.challenge.id} run-${job.runIndex} ERROR ${
              err instanceof Error ? err.message : String(err)
            }`
          );
          if (abortReason) {
            console.log(`Aborting early: ${abortReason}`);
            return;
          }
        }

        if (!smallRun && abortReason) {
          if (!printedAbort) {
            printedAbort = true;
            clearLine();
            console.log(`Aborting early: ${abortReason}`);
          }
          return;
        }
      }
    }
  })());

  await Promise.all(workers);

  if (heartbeat) {
    clearInterval(heartbeat);
    clearLine();
  }

  if (!smallRun) {
    console.log(`Done (pass ${passed}, fail ${failed}, skip ${skipped}, err ${errored})`);
  }
}

function filterModels(models: Model[], onlyId?: string): Model[] {
  if (!onlyId) return models;
  const m = models.find((x) => x.id === onlyId);
  if (!m) throw new Error(`Unknown model id: ${onlyId}`);
  return [m];
}

function filterChallenges(challenges: Challenge[], onlyId?: string): Challenge[] {
  if (!onlyId) return challenges;
  const c = challenges.find((x) => x.id === onlyId);
  if (!c) throw new Error(`Unknown challenge id: ${onlyId}`);
  return [c];
}

function jobDir(artifactsDir: string, modelId: string, challengeId: string, runIndex: number): string {
  const m = safePathSegment(modelId);
  return path.join(artifactsDir, "jobs", m, challengeId, `run-${runIndex}`);
}

async function runOneJob(opts: {
  artifactsDir: string;
  model: Model;
  challenge: Challenge;
  runIndex: number;
  attempts: number;
  temperature: number;
  openrouterBaseUrl: string;
  requestTimeoutMs: number;
  onProgress?: (p: { phase?: string; attempt?: number }) => void;
}): Promise<{ status: "done" | "skipped"; passed?: boolean; attemptsUsed?: number }> {
  const apiKey = process.env.OPENROUTER_API_KEY;
  if (!apiKey) throw new Error("Missing OPENROUTER_API_KEY");

  const dir = jobDir(opts.artifactsDir, opts.model.id, opts.challenge.id, opts.runIndex);
  const resultPath = path.join(dir, "result.json");

  if (await fileExists(resultPath)) {
    // Backward-compat: earlier versions could write an incomplete result with missing fields.
    try {
      const r = (await readJson(resultPath)) as { attemptsUsed?: number; passed?: boolean };
      if (typeof r.attemptsUsed !== "number") {
        const renamed = path.join(dir, `result.invalid-${Date.now()}.json`);
        await Bun.write(renamed, await Bun.file(resultPath).text());
        // Keep the original file for now (non-destructive) and proceed to rerun.
      } else {
        return { status: "skipped", passed: Boolean(r.passed), attemptsUsed: r.attemptsUsed };
      }
    } catch {
      return { status: "skipped" };
    }
  }
  await ensureDir(dir);

  const startedAt = new Date().toISOString();
  let totalPromptTokens = 0;
  let totalCompletionTokens = 0;
  let totalTokens = 0;
  let totalCostUsd = 0;

  for (let attempt = 1; attempt <= opts.attempts; attempt++) {
    opts.onProgress?.({ attempt, phase: "requesting" });
    const attemptDir = path.join(dir, `attempt-${attempt}`);
    const attemptMetaPath = path.join(attemptDir, "attempt_meta.json");

    if (await fileExists(attemptMetaPath)) {
      const meta = (await readJson(attemptMetaPath)) as {
        passed?: boolean;
        usage?: { promptTokens?: number; completionTokens?: number; totalTokens?: number; costUsd?: number };
      };
      if (meta?.usage) {
        totalPromptTokens += meta.usage.promptTokens ?? 0;
        totalCompletionTokens += meta.usage.completionTokens ?? 0;
        totalTokens += meta.usage.totalTokens ?? 0;
        totalCostUsd += meta.usage.costUsd ?? 0;
      }
      if (meta?.passed === true) {
        await finalizeResult({
          resultPath,
          modelId: opts.model.id,
          challengeId: opts.challenge.id,
          runIndex: opts.runIndex,
          startedAt,
          finishedAt: new Date().toISOString(),
          passed: true,
          attemptsUsed: attempt,
          usage: { totalPromptTokens, totalCompletionTokens, totalTokens, totalCostUsd }
        });
        return { status: "done", passed: true, attemptsUsed: attempt };
      }
      continue;
    }

    await ensureDir(attemptDir);
    const attemptStartedAt = new Date().toISOString();

    const prev = attempt > 1 ? await readPrevFailure(dir, attempt - 1) : null;
    const userPrompt = buildUserPrompt(opts.challenge.prompt, prev);

    opts.onProgress?.({ attempt, phase: "requesting" });
    const { json: respJson, headers } = await callOpenRouterChat({
      baseUrl: opts.openrouterBaseUrl,
      apiKey,
      requestTimeoutMs: opts.requestTimeoutMs,
      attemptDir,
      request: {
        model: opts.model.id,
        temperature: opts.temperature,
        messages: [
          { role: "system", content: SYSTEM_PROMPT },
          { role: "user", content: userPrompt }
        ]
      }
    });

    opts.onProgress?.({ attempt, phase: "extracting" });
    const assistant = extractAssistantContent(respJson);
    await writeFileAtomic(path.join(attemptDir, "assistant.md"), assistant);
    const code = extractFirstCodeBlock(assistant);
    if (!code) {
      await writeJsonAtomic(attemptMetaPath, {
        attempt,
        startedAt: attemptStartedAt,
        finishedAt: new Date().toISOString(),
        passed: false,
        errorType: "missing_code_block",
        openrouterHeaders: headers,
        usage: respJson.usage ?? null
      });
      continue;
    }

    await writeFileAtomic(path.join(attemptDir, "code.gleam"), code);

    const testFile = generateGleamTestFile({
      extraImports: opts.challenge.extraTestImports,
      setupLines: opts.challenge.testSetup,
      assertions: opts.challenge.assertions
    });

    const workspaceDir = path.join(attemptDir, "workspace");
    const templateDir = path.join(process.cwd(), "templates", "gleam_project");
    await prepareWorkspace({
      templateDir,
      workspaceDir,
      solutionCode: code,
      testFileContents: testFile
    });

    opts.onProgress?.({ attempt, phase: "testing" });
    const { exitCode, stdout, stderr } = await runGleamTest(workspaceDir);
    await writeTextFiles({ attemptDir, stdout, stderr, exitCode });

    opts.onProgress?.({ attempt, phase: "finalizing" });

    const passed = exitCode === 0;
    const usage = respJson.usage ?? {};
    const promptTokens = usage.prompt_tokens ?? 0;
    const completionTokens = usage.completion_tokens ?? 0;
    const total = usage.total_tokens ?? promptTokens + completionTokens;
    const costUsd = typeof (usage as any).cost === "number" ? (usage as any).cost : 0;
    totalPromptTokens += promptTokens;
    totalCompletionTokens += completionTokens;
    totalTokens += total;
    totalCostUsd += costUsd;

    await writeJsonAtomic(attemptMetaPath, {
      attempt,
      startedAt: attemptStartedAt,
      finishedAt: new Date().toISOString(),
      passed,
      usage: { promptTokens, completionTokens, totalTokens: total, costUsd },
      openrouterHeaders: headers
    });

    if (passed) {
      await finalizeResult({
        resultPath,
        modelId: opts.model.id,
        challengeId: opts.challenge.id,
        runIndex: opts.runIndex,
        startedAt,
        finishedAt: new Date().toISOString(),
        passed: true,
        attemptsUsed: attempt,
        usage: { totalPromptTokens, totalCompletionTokens, totalTokens, totalCostUsd }
      });
      return { status: "done", passed: true, attemptsUsed: attempt };
    }
  }

  await finalizeResult({
    resultPath,
    modelId: opts.model.id,
    challengeId: opts.challenge.id,
    runIndex: opts.runIndex,
    startedAt,
    finishedAt: new Date().toISOString(),
    passed: false,
    attemptsUsed: opts.attempts,
    usage: { totalPromptTokens, totalCompletionTokens, totalTokens, totalCostUsd }
  });

  return { status: "done", passed: false, attemptsUsed: opts.attempts };
}

async function readPrevFailure(
  jobDirPath: string,
  prevAttempt: number
): Promise<{ code?: string; stdout?: string; stderr?: string } | null> {
  const attemptDir = path.join(jobDirPath, `attempt-${prevAttempt}`);
  const codePath = path.join(attemptDir, "code.gleam");
  const outPath = path.join(attemptDir, "gleam_test_stdout.txt");
  const errPath = path.join(attemptDir, "gleam_test_stderr.txt");

  const out: { code?: string; stdout?: string; stderr?: string } = {};
  try {
    out.code = await Bun.file(codePath).text();
  } catch {}
  try {
    out.stdout = await Bun.file(outPath).text();
  } catch {}
  try {
    out.stderr = await Bun.file(errPath).text();
  } catch {}

  if (!out.code && !out.stdout && !out.stderr) return null;
  return out;
}

function buildUserPrompt(basePrompt: string, prev: { code?: string; stdout?: string; stderr?: string } | null): string {
  const parts: string[] = [];
  parts.push(basePrompt.trim());
  parts.push("");
  parts.push("Requirements:");
  parts.push("- Output ONLY a single Markdown code block with Gleam code.");
  parts.push("- Do not include execution commands, test cases, or usage examples.");
  parts.push("- The file will be saved as src/solution.gleam, so the module is solution.");

  if (prev) {
    parts.push("");
    parts.push("Previous attempt failed.");
    if (prev.stdout) {
      parts.push("Test stdout:");
      parts.push("```\n" + prev.stdout.trim() + "\n```");
    }
    if (prev.stderr) {
      parts.push("Test stderr:");
      parts.push("```\n" + prev.stderr.trim() + "\n```");
    }
    if (prev.code) {
      parts.push("Your previous code:");
      parts.push("```gleam\n" + prev.code.trim() + "\n```");
    }
    parts.push("Fix the code.");
  }

  return parts.join("\n");
}

async function finalizeResult(opts: {
  resultPath: string;
  modelId: string;
  challengeId: string;
  runIndex: number;
  startedAt: string;
  finishedAt: string;
  passed: boolean;
  attemptsUsed: number;
  usage: { totalPromptTokens: number; totalCompletionTokens: number; totalTokens: number; totalCostUsd?: number };
}): Promise<void> {
  await writeJsonAtomic(opts.resultPath, {
    modelId: opts.modelId,
    challengeId: opts.challengeId,
    runIndex: opts.runIndex,
    startedAt: opts.startedAt,
    finishedAt: opts.finishedAt,
    passed: opts.passed,
    attemptsUsed: opts.attemptsUsed,
    usage: opts.usage
  });
}
