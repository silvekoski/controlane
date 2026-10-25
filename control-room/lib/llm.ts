import Anthropic from "@anthropic-ai/sdk";
import "dotenv/config";

// One place for the Claude client. Claude runs through Anthropic or, without that key, through
// OpenRouter. Without either key the app runs in scripted mode.

export const MODELS = {
  agent: process.env.AGENT_MODEL || "claude-opus-5-5",
  judge: process.env.JUDGE_MODEL || "claude-opus-5-5",
  driver: process.env.DRIVER_MODEL || "claude-opus-5-5",
};

// USD per million tokens, for the cost column in the benchmark.
export const PRICES: Record<string, { input: number; output: number }> = {
  "claude-opus-5-5": { input: 4, output: 20 },
  "claude-sonnet-5-5": { input: 2, output: 10 },
  "claude-haiku-5-5": { input: 0.1, output: 0.5 },
  "claude-fable-5-1": { input: 10, output: 50 },
};

let client: Anthropic | null | undefined;

export function claude(): Anthropic | null {
  if (client !== undefined) return client;
  client = process.env.ANTHROPIC_API_KEY || process.env.ANTHROPIC_AUTH_TOKEN ? new Anthropic() : null;
  return client;
}

// Without an Anthropic key, the same Claude models run through OpenRouter.
const openRouterKey = () => (claude() ? null : process.env.OPENROUTER_API_KEY || null);

export function hasClaude() {
  return claude() !== null || openRouterKey() !== null;
}

/** Which service the Claude calls go to, for the UI and the run log. */
export function llmProvider(): "anthropic" | "openrouter" | null {
  return claude() ? "anthropic" : openRouterKey() ? "openrouter" : null;
}

export function costUsd(model: string, usage: { input_tokens: number; output_tokens: number }) {
  const p = PRICES[model];
  if (!p) return undefined;
  return (usage.input_tokens * p.input + usage.output_tokens * p.output) / 1_000_000;
}

type CreateParams = Omit<Anthropic.Beta.MessageCreateParamsNonStreaming, "betas" | "fallbacks">;

// A request with server-side refusal fallbacks switched on. Without an Anthropic key,
// the request goes to OpenRouter and the answer comes back in the same shape.
export async function create(params: CreateParams): Promise<Anthropic.Beta.BetaMessage> {
  const c = claude();
  if (c) {
    return c.beta.messages.create({
      ...params,
      betas: ["server-side-fallback-2026-07-01"],
      fallbacks: "default",
    });
  }
  const key = openRouterKey();
  if (!key) throw new Error("No LLM key set. Add ANTHROPIC_API_KEY or OPENROUTER_API_KEY to control-room/.env.");
  return openRouterCreate(params, key);
}

// ---------- OpenRouter translation ----------
// OpenRouter takes the OpenAI chat format. These functions turn a Messages request into a chat
// request and the chat answer back into a Messages answer, so the callers do not change.

type ChatPart = { type: "text"; text: string } | { type: "image_url"; image_url: { url: string } };
type ChatToolCall = { id: string; type: "function"; function: { name: string; arguments: string } };
type ChatMessage =
  | { role: "system" | "user"; content: string | ChatPart[] }
  | { role: "assistant"; content: string | null; tool_calls?: ChatToolCall[]; reasoning_details?: unknown[] }
  | { role: "tool"; tool_call_id: string; content: string };

/** claude-opus-5-5 → anthropic/claude-opus-5.5. A full "vendor/model" id in .env passes through unchanged. */
export function openRouterModel(model: string) {
  if (model.includes("/")) return model;
  const m = /^claude-([a-z]+)-(\d+)-(\d+)$/.exec(model);
  return `anthropic/${m ? `claude-${m[1]}-${m[2]}.${m[3]}` : model}`;
}

function blockText(content: unknown): string {
  if (typeof content === "string") return content;
  if (!Array.isArray(content)) return "";
  return content.map((b: { type?: string; text?: string }) => (b.type === "text" ? b.text ?? "" : "")).join("\n");
}

function toChatMessages(params: CreateParams): ChatMessage[] {
  const out: ChatMessage[] = [];
  const system = blockText(params.system);
  if (system) out.push({ role: "system", content: system });
  for (const m of params.messages) {
    if (typeof m.content === "string") {
      out.push({ role: m.role, content: m.content } as ChatMessage);
      continue;
    }
    const blocks = m.content as unknown as Record<string, any>[];
    if (m.role === "assistant") {
      const text = blocks.filter((b) => b.type === "text").map((b) => b.text).join("\n");
      const calls = blocks.filter((b) => b.type === "tool_use").map((b) => ({ id: b.id, type: "function" as const, function: { name: b.name, arguments: JSON.stringify(b.input ?? {}) } }));
      // The reasoning travels back with the tool calls, as OpenRouter asks for tool use.
      const thinking = blocks.find((b) => b.type === "thinking" && typeof b.signature === "string" && b.signature.startsWith("openrouter:"));
      const msg: ChatMessage = { role: "assistant", content: text || null, ...(calls.length ? { tool_calls: calls } : {}) };
      if (thinking) msg.reasoning_details = JSON.parse(thinking.signature.slice("openrouter:".length));
      out.push(msg);
      continue;
    }
    // Tool results become tool messages right after the assistant turn; other parts stay a user message.
    for (const b of blocks.filter((x) => x.type === "tool_result")) {
      out.push({ role: "tool", tool_call_id: b.tool_use_id, content: typeof b.content === "string" ? b.content : blockText(b.content) || JSON.stringify(b.content ?? "") });
    }
    const parts: ChatPart[] = blocks.flatMap((b): ChatPart[] => {
      if (b.type === "text") return [{ type: "text", text: b.text }];
      if (b.type === "image" && b.source?.type === "base64") return [{ type: "image_url", image_url: { url: `data:${b.source.media_type};base64,${b.source.data}` } }];
      if (b.type === "image" && b.source?.type === "url") return [{ type: "image_url", image_url: { url: b.source.url } }];
      return [];
    });
    if (parts.length) out.push({ role: "user", content: parts });
  }
  return out;
}

const STOP: Record<string, Anthropic.Beta.BetaMessage["stop_reason"]> = { stop: "end_turn", tool_calls: "tool_use", length: "max_tokens", content_filter: "refusal" };

async function openRouterCreate(params: CreateParams, key: string): Promise<Anthropic.Beta.BetaMessage> {
  const config = (params as { output_config?: { effort?: string; format?: { type: string; schema?: unknown } } }).output_config;
  const body: Record<string, unknown> = {
    model: openRouterModel(params.model),
    max_tokens: params.max_tokens,
    messages: toChatMessages(params),
  };
  if (params.tools?.length) {
    body.tools = (params.tools as unknown as { name: string; description?: string; input_schema: unknown }[])
      .map((t) => ({ type: "function", function: { name: t.name, description: t.description, parameters: t.input_schema } }));
  }
  if (config?.format?.type === "json_schema") body.response_format = { type: "json_schema", json_schema: { name: "answer", strict: true, schema: config.format.schema } };
  if (config?.effort) body.reasoning = { effort: config.effort };

  const res = await fetch("https://openrouter.ai/api/v1/chat/completions", {
    method: "POST",
    headers: { "content-type": "application/json", authorization: `Bearer ${key}`, "x-title": "Bahn control room" },
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error(`OpenRouter returned ${res.status}: ${(await res.text()).slice(0, 300)}`);
  const data = (await res.json()) as {
    id: string; model: string; error?: { message?: string };
    choices: { finish_reason: string; message: { content: string | null; tool_calls?: ChatToolCall[]; reasoning?: string; reasoning_details?: unknown[] } }[];
    usage?: { prompt_tokens: number; completion_tokens: number };
  };
  const choice = data.choices?.[0];
  if (!choice) throw new Error(`OpenRouter returned no answer${data.error?.message ? `: ${data.error.message}` : ""}`);
  if (choice.finish_reason === "error") throw new Error("OpenRouter: the model returned an error.");

  const content: Record<string, unknown>[] = [];
  if (choice.message.reasoning_details?.length) {
    content.push({ type: "thinking", thinking: choice.message.reasoning ?? "", signature: `openrouter:${JSON.stringify(choice.message.reasoning_details)}` });
  }
  if (choice.message.content) content.push({ type: "text", text: choice.message.content, citations: null });
  for (const call of choice.message.tool_calls ?? []) {
    let input: unknown = {};
    try { input = JSON.parse(call.function.arguments || "{}"); } catch { input = {}; }
    content.push({ type: "tool_use", id: call.id, name: call.function.name, input });
  }
  return {
    id: data.id,
    type: "message",
    role: "assistant",
    model: data.model,
    content,
    stop_reason: STOP[choice.finish_reason] ?? "end_turn",
    stop_sequence: null,
    usage: { input_tokens: data.usage?.prompt_tokens ?? 0, output_tokens: data.usage?.completion_tokens ?? 0 },
  } as unknown as Anthropic.Beta.BetaMessage;
}

export function textOf(msg: Anthropic.Beta.BetaMessage) {
  return msg.content
    .filter((b): b is Anthropic.Beta.BetaTextBlock => b.type === "text")
    .map((b) => b.text)
    .join("\n")
    .trim();
}

// Pull the first JSON object out of a model reply.
export function parseJson<T>(text: string): T | null {
  const start = text.indexOf("{");
  const end = text.lastIndexOf("}");
  if (start < 0 || end <= start) return null;
  try {
    return JSON.parse(text.slice(start, end + 1)) as T;
  } catch {
    return null;
  }
}
