import dotenv from "dotenv";

export function loadEnv(): void {
  dotenv.config();
  if (!process.env.OPENROUTER_API_KEY) {
    throw new Error("Missing OPENROUTER_API_KEY in environment (.env)");
  }
}
