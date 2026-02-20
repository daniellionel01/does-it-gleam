import * as fs from "node:fs/promises";
import * as path from "node:path";
import { type AllConfig } from "./config.ts";
import { ensureDir, safePathSegment, writeFileAtomic, writeJsonAtomic } from "./fs_util.ts";

type ResultJson = {
  modelId: string;
  challengeId: string;
  runIndex: number;
  passed: boolean;
  usage?: {
    totalPromptTokens?: number;
    totalCompletionTokens?: number;
    totalTokens?: number;
  };
};

function stddevPopulation(xs: number[]): number {
  if (xs.length === 0) return 0;
  const mean = xs.reduce((a, b) => a + b, 0) / xs.length;
  const v = xs.reduce((acc, x) => acc + (x - mean) ** 2, 0) / xs.length;
  return Math.sqrt(v);
}

export async function buildReport(opts: { cfg: AllConfig; artifactsDir: string }): Promise<void> {
  await ensureDir(opts.artifactsDir);
  const results = await loadAllResults(opts);

  const summary = buildSummary(opts.cfg, results);
  await writeJsonAtomic(path.join(opts.artifactsDir, "summary.json"), summary);

  const html = renderHtml(summary);
  await writeFileAtomic(path.join(opts.artifactsDir, "report.html"), html);
}

async function loadAllResults(opts: { cfg: AllConfig; artifactsDir: string }): Promise<ResultJson[]> {
  const out: ResultJson[] = [];
  for (const m of opts.cfg.models) {
    for (const c of opts.cfg.challenges) {
      for (let i = 1; i <= opts.cfg.run.runs; i++) {
        const p = path.join(
          opts.artifactsDir,
          "jobs",
          safePathSegment(m.id),
          c.id,
          `run-${i}`,
          "result.json"
        );
        try {
          const s = await fs.readFile(p, "utf8");
          out.push(JSON.parse(s) as ResultJson);
        } catch {}
      }
    }
  }
  return out;
}

function buildSummary(cfg: AllConfig, results: ResultJson[]) {
  const byKey = new Map<string, ResultJson[]>();
  for (const r of results) {
    const key = `${r.modelId}::${r.challengeId}`;
    const arr = byKey.get(key) ?? [];
    arr.push(r);
    byKey.set(key, arr);
  }

  const challenges = cfg.challenges.map((c) => ({ id: c.id, title: c.title }));
  const models = cfg.models.map((m) => {
    const perChallenge: Record<
      string,
      {
        completedRuns: number;
        expectedRuns: number;
        passRate: number;
        stddev: number;
        passes: number;
        fails: number;
        totalTokens: number;
      }
    > = {};

    let scoreParts: number[] = [];
    let totalTokens = 0;
    for (const c of cfg.challenges) {
      const key = `${m.id}::${c.id}`;
      const arr = (byKey.get(key) ?? []).sort((a, b) => a.runIndex - b.runIndex);
      const xs = arr.map((r) => (r.passed ? 1 : 0));
      const passes = xs.reduce((a, b) => a + b, 0);
      const fails = xs.length - passes;
      const passRate = xs.length === 0 ? 0 : passes / xs.length;
      const sd = stddevPopulation(xs);
      const tok = arr.reduce((acc, r) => acc + (r.usage?.totalTokens ?? 0), 0);
      totalTokens += tok;
      perChallenge[c.id] = {
        completedRuns: xs.length,
        expectedRuns: cfg.run.runs,
        passRate,
        stddev: sd,
        passes,
        fails,
        totalTokens: tok
      };
      // Use per-challenge pass rate based on completed runs; report completeness separately.
      scoreParts.push(passRate);
    }
    const score = scoreParts.length === 0 ? 0 : (scoreParts.reduce((a, b) => a + b, 0) / scoreParts.length) * 100;

    return {
      id: m.id,
      name: m.name ?? m.id,
      provider: m.provider ?? null,
      releaseDate: m.releaseDate ?? null,
      score,
      totalTokens,
      challenges: perChallenge
    };
  });

  return {
    generatedAt: new Date().toISOString(),
    runConfig: cfg.run,
    challenges,
    models
  };
}

function renderHtml(summary: any): string {
  // Self-contained HTML: embed JSON and render with a tiny script.
  const json = JSON.stringify(summary);
  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>Does it Gleam? Report</title>
  <style>
    :root { --bg:#0b1020; --panel:#111a33; --text:#e8ecff; --muted:#aeb7e6; --line:#243055; --good:#25c26e; --bad:#ff5d5d; }
    body { margin:0; font:14px/1.4 ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace; background:radial-gradient(1200px 500px at 20% -10%, #1b2a63 0%, rgba(27,42,99,0) 60%), var(--bg); color:var(--text); }
    header { padding:24px 20px 10px; border-bottom:1px solid var(--line); }
    h1 { margin:0 0 6px; font-size:18px; }
    .meta { color:var(--muted); }
    main { padding:16px 20px 40px; }
    table { width:100%; border-collapse:collapse; background:rgba(17,26,51,0.7); border:1px solid var(--line); }
    th, td { padding:10px 10px; border-bottom:1px solid var(--line); text-align:left; vertical-align:top; }
    th { position:sticky; top:0; background:rgba(17,26,51,0.95); z-index:1; }
    .muted { color:var(--muted); }
    .pill { display:inline-block; padding:2px 8px; border:1px solid var(--line); border-radius:999px; }
    .good { color:var(--good); }
    .bad { color:var(--bad); }
    .row { display:flex; gap:12px; flex-wrap:wrap; margin:12px 0; }
    .card { background:rgba(17,26,51,0.7); border:1px solid var(--line); border-radius:12px; padding:12px 12px; }
  </style>
</head>
<body>
  <header>
    <h1>Does it Gleam? Report</h1>
    <div class="meta" id="meta"></div>
  </header>
  <main>
    <div class="row">
      <div class="card"><div class="muted">Models</div><div id="modelCount"></div></div>
      <div class="card"><div class="muted">Challenges</div><div id="challengeCount"></div></div>
      <div class="card"><div class="muted">Runs/Challenge</div><div id="runs"></div></div>
    </div>
    <table id="tbl"></table>
  </main>
  <script>
    const SUMMARY = ${json};
    document.getElementById('meta').textContent = 'Generated ' + SUMMARY.generatedAt;
    document.getElementById('modelCount').textContent = String(SUMMARY.models.length);
    document.getElementById('challengeCount').textContent = String(SUMMARY.challenges.length);
    document.getElementById('runs').textContent = String(SUMMARY.runConfig.runs);

    const tbl = document.getElementById('tbl');
    const head = document.createElement('thead');
    const hr = document.createElement('tr');
    const cols = ['Model', 'Score', 'Tokens'].concat(SUMMARY.challenges.map(c => c.id));
    for (const c of cols) {
      const th = document.createElement('th');
      th.textContent = c;
      hr.appendChild(th);
    }
    head.appendChild(hr);
    tbl.appendChild(head);

    const body = document.createElement('tbody');
    const models = [...SUMMARY.models].sort((a,b) => b.score - a.score);
    for (const m of models) {
      const tr = document.createElement('tr');
      const td0 = document.createElement('td');
      td0.innerHTML = '<div>' + m.name + '</div><div class="muted">' + m.id + '</div>';
      tr.appendChild(td0);

      const td1 = document.createElement('td');
      td1.innerHTML = '<span class="pill">' + m.score.toFixed(1) + '</span>';
      tr.appendChild(td1);

      const td2 = document.createElement('td');
      td2.textContent = String(m.totalTokens || 0);
      tr.appendChild(td2);

      for (const c of SUMMARY.challenges) {
        const r = m.challenges[c.id];
        const td = document.createElement('td');
        const pct = (r.passRate * 100).toFixed(0);
        const ok = r.passRate >= 0.999;
        const cls = ok ? 'good' : (r.passRate === 0 ? 'bad' : '');
        td.innerHTML = '<div class="' + cls + '">' + pct + '%</div>' +
          '<div class="muted">' + r.passes + '/' + r.completedRuns + ' (sd ' + r.stddev.toFixed(2) + ')</div>';
        tr.appendChild(td);
      }
      body.appendChild(tr);
    }
    tbl.appendChild(body);
  </script>
</body>
</html>`;
}
