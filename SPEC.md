# Specification

We need a tool set to run the tests defined @README.md against the suite defined in @CHALLENGES.md.

Visualization Format should be an html file generated from raw JSON data.

OpenRouter API KEY is in `.env` as `OPENROUTER_API_KEY`

## Tech Stack

Open for suggestions.

## Important

- We want to be resourceful with requests. That means we do not want to have to run the whole test suite every time.
There has to be a way to cache und store results on disk so that cancelling and rerunning the test suite picks up
where it left off.

- We want to track costs and token usage for each test we run with the model.

- Every model will be run 10x against each test. This is to collect data and avoid "unlucky" runs. Differences in results will be calculated at the end in a standard deviation.

## System Prompt
```
You are an expert programmer. Your task is to provide a code solution within a single Markdown code block for the given programming problem. Do not include any direct execution commands, test cases, or usage examples within the code block.
```

## Appendix: Implementation Decisions (Interview)

### Tech Stack
- Runtime: Bun
- Language: TypeScript
- LLM API: OpenRouter Chat Completions (`OPENROUTER_API_KEY` from `.env`)
- Verification: `gleam test` (generated tests per challenge attempt)
- Reports: single self-contained HTML file generated from raw JSON results

### Runner Interface
- CLI commands (names flexible):
  - `run`: execute (models x challenges x runs), resumable
  - `report`: generate `report.html` from aggregated JSON
  - `inspect`: print a quick summary of cached progress (optional)

### Execution Model
- Unit of work: `(model, challenge, runIndex)`
- For each unit of work: up to 3 attempts
  - Attempt 1: model writes solution from prompt
  - If compile/test fails: feed compiler/test output back to model and retry
  - Stop early on first passing attempt
- Score per unit of work: binary pass/fail (1/0)
- Repeat each model against each challenge 10x (runIndex 1..10)
- Standard deviation:
  - Computed per `(model, challenge)` across the 10 binary outcomes (treating pass=1, fail=0)
  - Overall model score: average of per-challenge pass rates, scaled to 0-100

### Parallelism + Isolation
- Parallel execution allowed with a configurable worker limit
- No shared working directories:
  - Each unit of work uses its own isolated workspace folder so files never collide
  - Each attempt writes to its own attempt folder (no overwrites)

### Disk Cache / Resumability (Per Attempt Transcript)
- Persist every attempt to disk (request, response, extracted code, compile/test outputs, usage/cost)
- On rerun:
  - Skip any unit of work already marked complete (pass/fail finalized)
  - If a unit is mid-flight, continue from the latest incomplete attempt
- Writes should be atomic (write temp file then rename) to survive interruption

### Config (Dedicated Files; no Markdown parsing)
- Models and challenges are defined in repo config files (source of truth), not parsed from `README.md` / `CHALLENGES.md`
- Suggested config files:
  - `config/models.json`: model IDs + display metadata
  - `config/challenges.json`: challenge ID, name, prompt text, and verification spec used to generate `gleam test`
  - `config/run.json`: runs=10, attempts=3, concurrency, temperature, etc.
- OpenRouter sampling defaults:
  - Temperature configurable (default 0.2 unless overridden in config)

### Results + Report Artifacts
- Raw data format: JSON (plus per-attempt JSON files)
- Aggregated output:
  - One machine-readable JSON summary (for the HTML generator)
  - One `report.html` generated from that JSON (embedded JSON payload; minimal JS/CSS; tables + simple charts)
