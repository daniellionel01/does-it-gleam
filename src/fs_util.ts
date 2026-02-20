import * as fs from "node:fs/promises";
import * as path from "node:path";

export async function ensureDir(dirPath: string): Promise<void> {
  await fs.mkdir(dirPath, { recursive: true });
}

export async function fileExists(filePath: string): Promise<boolean> {
  try {
    await fs.stat(filePath);
    return true;
  } catch {
    return false;
  }
}

export async function readJson(filePath: string): Promise<unknown> {
  const s = await fs.readFile(filePath, "utf8");
  return JSON.parse(s);
}

export async function writeFileAtomic(filePath: string, contents: string): Promise<void> {
  const dir = path.dirname(filePath);
  await ensureDir(dir);
  const tmp = `${filePath}.tmp-${process.pid}-${Date.now()}`;
  await fs.writeFile(tmp, contents, "utf8");
  await fs.rename(tmp, filePath);
}

export async function writeJsonAtomic(filePath: string, value: unknown): Promise<void> {
  const s = JSON.stringify(value, null, 2) + "\n";
  await writeFileAtomic(filePath, s);
}

export async function copyDir(srcDir: string, dstDir: string): Promise<void> {
  await ensureDir(dstDir);
  const entries = await fs.readdir(srcDir, { withFileTypes: true });
  for (const ent of entries) {
    const src = path.join(srcDir, ent.name);
    const dst = path.join(dstDir, ent.name);
    if (ent.isDirectory()) {
      await copyDir(src, dst);
    } else if (ent.isFile()) {
      await fs.copyFile(src, dst);
    }
  }
}

export function safePathSegment(s: string): string {
  return s.replace(/\//g, "__").replace(/[^A-Za-z0-9._-]+/g, "_");
}
