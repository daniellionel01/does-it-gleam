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

  const smallRun = jobs.length <= 50;
  let completed = 0;
  let passed = 0;
  let failed = 0;
  let skipped = 0;
  let errored = 0;

  console.log(`Running ${jobs.length} job(s) with concurrency ${concurrency}`);

  const workers = Array.from({ length: concurrency }, async () => {
    while (true) {
      const idx = nextIndex++;
      if (idx >= jobs.length) return;
      const job = jobs[idx];
      try {
        const outcome = await runOneJob({
          artifactsDir: opts.artifactsDir,
          model: job.model,
          challenge: job.challenge,
          runIndex: job.runIndex,
          attempts: runCfg.attempts,
          temperature: runCfg.temperature,
          openrouterBaseUrl: runCfg.openrouterBaseUrl,
          requestTimeoutMs: runCfg.requestTimeoutMs
        });

        completed++;
        if (outcome.status === "skipped") skipped++;
        if (outcome.status === "done") {
          if (outcome.passed) passed++;
          else failed++;
        }

        if (smallRun) {
          const tail = outcome.status === "done" ? ` ${outcome.passed ? "PASS" : "FAIL"} (attempts ${outcome.attemptsUsed})` : " SKIP";
          console.log(`[${completed}/${jobs.length}] ${job.model.id} ${job.challenge.id} run-${job.runIndex}${tail}`);
        } else if (completed % 25 === 0 || completed === jobs.length) {
          console.log(`Progress ${completed}/${jobs.length} (pass ${passed}, fail ${failed}, skip ${skipped}, err ${errored})`);
        }
      } catch (err) {
        const dir = jobDir(opts.artifactsDir, job.model.id, job.challenge.id, job.runIndex);
        await ensureDir(dir);
        await writeJsonAtomic(path.join(dir, "job_error.json"), {
          modelId: job.model.id,
          challengeId: job.challenge.id,
          runIndex: job.runIndex,
          error: {
            message: err instanceof Error ? err.message : String(err)
          },
          at: new Date().toISOString()
        });

        completed++;
        errored++;
        if (smallRun) {
          console.log(
            `[${completed}/${jobs.length}] ${job.model.id} ${job.challenge.id} run-${job.runIndex} ERROR ${
              err instanceof Error ? err.message : String(err)
            }`
          );
        }
      }
    }
  });

  await Promise.all(workers);
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
}): Promise<{ status: "done" | "skipped"; passed?: boolean; attemptsUsed?: number }> {
  const apiKey = process.env.OPENROUTER_API_KEY;
  if (!apiKey) throw new Error("Missing OPENROUTER_API_KEY");

  const dir = jobDir(opts.artifactsDir, opts.model.id, opts.challenge.id, opts.runIndex);
  const resultPath = path.join(dir, "result.json");

  if (await fileExists(resultPath)) {
    // Backward-compat: earlier versions could write an incomplete result with missing fields.
    try {
      const r = (await readJson(resultPath)) as { attemptsUsed?: number };
      if (typeof r.attemptsUsed !== "number") {
        const renamed = path.join(dir, `result.invalid-${Date.now()}.json`);
        await Bun.write(renamed, await Bun.file(resultPath).text());
        // Keep the original file for now (non-destructive) and proceed to rerun.
      } else {
        return { status: "skipped" };
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

    const { exitCode, stdout, stderr } = await runGleamTest(workspaceDir);
    await writeTextFiles({ attemptDir, stdout, stderr, exitCode });

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
