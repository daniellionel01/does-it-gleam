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
    await writeJsonAtomic(`${opts.attemptDir}/response_error.json`, {
      status: res.status,
      statusText: res.statusText,
      body: text
    });
    throw new Error(`OpenRouter error ${res.status}: ${res.statusText}`);
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
