import { writeJsonAtomic } from "./fs_util.ts";

export type OpenRouterChatRequest = {
  model: string;
  messages: Array<{ role: "system" | "user" | "assistant"; content: string }>;
  temperature?: number;
};

export type OpenRouterChatResponse = {
  id?: string;
  choices?: Array<{ message?: { content?: string } }>;
  usage?: {
    prompt_tokens?: number;
    completion_tokens?: number;
    total_tokens?: number;
  };
};

export type OpenRouterErrorKind =
  | "out_of_credits"
  | "invalid_api_key"
  | "rate_limited"
  | "bad_request"
  | "server_error"
  | "unknown";

export class OpenRouterHttpError extends Error {
  readonly name = "OpenRouterHttpError";
  readonly status: number;
  readonly statusText: string;
  readonly kind: OpenRouterErrorKind;
  readonly detailsMessage: string;

  constructor(opts: { status: number; statusText: string; kind: OpenRouterErrorKind; message: string }) {
    super(`OpenRouter ${opts.kind} (${opts.status}): ${opts.message}`);
    this.status = opts.status;
    this.statusText = opts.statusText;
    this.kind = opts.kind;
    this.detailsMessage = opts.message;
  }

  get isFatal(): boolean {
    return this.kind === "out_of_credits" || this.kind === "invalid_api_key";
  }
}

function classifyError(status: number, bodyText: string, bodyJson: unknown): { kind: OpenRouterErrorKind; message: string } {
  const text = (bodyText || "").toLowerCase();
  const msg = extractErrorMessage(bodyJson) ?? bodyText;

  if (status === 402 || text.includes("payment_required") || text.includes("insufficient") || text.includes("credit") || text.includes("balance")) {
    return { kind: "out_of_credits", message: msg || "Insufficient credits" };
  }

  if (status === 401 || status === 403 || text.includes("invalid api key") || text.includes("invalid_api_key") || text.includes("unauthorized")) {
    return { kind: "invalid_api_key", message: msg || "Invalid API key" };
  }

  if (status === 429 || text.includes("rate limit") || text.includes("rate_limited")) {
    return { kind: "rate_limited", message: msg || "Rate limited" };
  }

  if (status >= 400 && status < 500) {
    return { kind: "bad_request", message: msg || "Bad request" };
  }

  if (status >= 500) {
    return { kind: "server_error", message: msg || "Server error" };
  }

  return { kind: "unknown", message: msg || "Unknown error" };
}

function extractErrorMessage(bodyJson: unknown): string | null {
  if (!bodyJson || typeof bodyJson !== "object") return null;
  const anyJson = bodyJson as any;
  const candidates = [
    anyJson?.error?.message,
    anyJson?.error?.error?.message,
    anyJson?.message,
    anyJson?.detail,
    anyJson?.error
  ];
  for (const c of candidates) {
    if (typeof c === "string" && c.trim().length > 0) return c;
  }
  return null;
}

export async function callOpenRouterChat(opts: {
  baseUrl: string;
  apiKey: string;
  request: OpenRouterChatRequest;
  requestTimeoutMs: number;
  attemptDir: string;
}): Promise<{ json: OpenRouterChatResponse; headers: Record<string, string> }> {
  const url = `${opts.baseUrl.replace(/\/$/, "")}/chat/completions`;
  const controller = new AbortController();
  const t = setTimeout(() => controller.abort(), opts.requestTimeoutMs);

  await writeJsonAtomic(`${opts.attemptDir}/request.json`, {
    url,
    ...opts.request
  });

  let res: Response;
  try {
    res = await fetch(url, {
      method: "POST",
      signal: controller.signal,
      headers: {
        Authorization: `Bearer ${opts.apiKey}`,
        "Content-Type": "application/json",
        "X-Title": "does-it-gleam"
      },
      body: JSON.stringify(opts.request)
    });
  } finally {
    clearTimeout(t);
  }

  const headers: Record<string, string> = {};
  for (const [k, v] of res.headers.entries()) headers[k] = v;
  await writeJsonAtomic(`${opts.attemptDir}/response_headers.json`, headers);

  const text = await res.text();
  if (!res.ok) {
    let bodyJson: unknown = null;
    try {
      bodyJson = JSON.parse(text);
    } catch {
      bodyJson = null;
    }

    const classified = classifyError(res.status, text, bodyJson);
    await writeJsonAtomic(`${opts.attemptDir}/response_error.json`, {
      status: res.status,
      statusText: res.statusText,
      kind: classified.kind,
      message: classified.message,
      body: text,
      bodyJson
    });

    throw new OpenRouterHttpError({
      status: res.status,
      statusText: res.statusText,
      kind: classified.kind,
      message: classified.message
    });
  }

  const json = JSON.parse(text) as OpenRouterChatResponse;
  await writeJsonAtomic(`${opts.attemptDir}/response.json`, json);
  return { json, headers };
}

export function extractAssistantContent(resp: OpenRouterChatResponse): string {
  const content = resp.choices?.[0]?.message?.content;
  if (!content || typeof content !== "string") {
    throw new Error("OpenRouter response missing choices[0].message.content");
  }
  return content;
}
