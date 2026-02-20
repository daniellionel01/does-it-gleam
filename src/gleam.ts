import * as fs from "node:fs/promises";
import * as path from "node:path";
import { copyDir, ensureDir, writeFileAtomic } from "./fs_util.ts";

export function extractFirstCodeBlock(md: string): string | null {
  const m = md.match(/```(?:gleam)?\s*([\s\S]*?)```/i);
  return m ? m[1].trim() + "\n" : null;
}

export function generateGleamTestFile(opts: {
  extraImports: string[];
  setupLines: string[];
  assertions: Array<{ actual: string; expected: string }>;
}): string {
  const lines: string[] = [];
  lines.push("import gleeunit/should");
  lines.push("import solution");
  for (const imp of opts.extraImports) lines.push(`import ${imp}`);
  lines.push("");
  lines.push("pub fn generated_test() {");
  for (const s of opts.setupLines) {
    lines.push(`  ${s}`);
  }
  for (const a of opts.assertions) {
    lines.push(`  ${a.actual}`);
    lines.push(`  |> should.equal(${a.expected})`);
  }
  lines.push("}");
  lines.push("");
  return lines.join("\n");
}

export async function prepareWorkspace(opts: {
  templateDir: string;
  workspaceDir: string;
  solutionCode: string;
  testFileContents: string;
}): Promise<void> {
  await ensureDir(opts.workspaceDir);
  await copyDir(opts.templateDir, opts.workspaceDir);
  await ensureDir(path.join(opts.workspaceDir, "src"));
  await ensureDir(path.join(opts.workspaceDir, "test"));
  await writeFileAtomic(path.join(opts.workspaceDir, "src", "solution.gleam"), opts.solutionCode);
  await writeFileAtomic(path.join(opts.workspaceDir, "test", "generated_test.gleam"), opts.testFileContents);
}

export async function runGleamTest(workspaceDir: string): Promise<{
  exitCode: number;
  stdout: string;
  stderr: string;
}> {
  const proc = Bun.spawn(["gleam", "test"], {
    cwd: workspaceDir,
    stdout: "pipe",
    stderr: "pipe",
    env: { ...process.env }
  });

  const [stdout, stderr, exitCode] = await Promise.all([
    new Response(proc.stdout).text(),
    new Response(proc.stderr).text(),
    proc.exited
  ]);

  return { exitCode, stdout, stderr };
}

export async function writeTextFiles(opts: {
  attemptDir: string;
  stdout: string;
  stderr: string;
  exitCode: number;
}): Promise<void> {
  await writeFileAtomic(`${opts.attemptDir}/gleam_test_stdout.txt`, opts.stdout);
  await writeFileAtomic(`${opts.attemptDir}/gleam_test_stderr.txt`, opts.stderr);
  await writeFileAtomic(
    `${opts.attemptDir}/gleam_test_exit.json`,
    JSON.stringify({ exitCode: opts.exitCode }, null, 2) + "\n"
  );
}

export async function removeDir(dirPath: string): Promise<void> {
  await fs.rm(dirPath, { recursive: true, force: true });
}
