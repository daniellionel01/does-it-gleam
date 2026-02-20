import { z } from "zod";
import { readJson } from "./fs_util.ts";

const ModelSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1).optional(),
  provider: z.string().min(1).optional(),
  releaseDate: z.string().min(1).optional()
});

const AssertionSchema = z.object({
  actual: z.string().min(1),
  expected: z.string().min(1)
});

const ChallengeSchema = z.object({
  id: z.string().min(1),
  title: z.string().min(1),
  prompt: z.string().min(1),
  testSetup: z.array(z.string().min(1)).default([]),
  extraTestImports: z.array(z.string().min(1)).default([]),
  assertions: z.array(AssertionSchema).min(1)
});

const RunConfigSchema = z.object({
  runs: z.number().int().positive().default(10),
  attempts: z.number().int().positive().default(3),
  concurrency: z.number().int().positive().default(2),
  temperature: z.number().min(0).max(2).default(0.2),
  openrouterBaseUrl: z.string().min(1).default("https://openrouter.ai/api/v1"),
  requestTimeoutMs: z.number().int().positive().default(120000)
});

export type Model = z.infer<typeof ModelSchema>;
export type Challenge = z.infer<typeof ChallengeSchema>;
export type RunConfig = z.infer<typeof RunConfigSchema>;

export type AllConfig = {
  models: Model[];
  challenges: Challenge[];
  run: RunConfig;
};

export async function loadAllConfig(configDir: string): Promise<AllConfig> {
  const modelsRaw = await readJson(`${configDir}/models.json`);
  const challengesRaw = await readJson(`${configDir}/challenges.json`);
  const runRaw = await readJson(`${configDir}/run.json`);

  const models = z.array(ModelSchema).parse(modelsRaw);
  const challenges = z.array(ChallengeSchema).parse(challengesRaw);
  const run = RunConfigSchema.parse(runRaw);

  const challengeIds = new Set<string>();
  for (const c of challenges) {
    if (challengeIds.has(c.id)) throw new Error(`Duplicate challenge id: ${c.id}`);
    challengeIds.add(c.id);
  }

  return { models, challenges, run };
}
