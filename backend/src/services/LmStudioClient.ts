/**
 * Thin client for the LM Studio OpenAI-compatible local endpoint.
 *
 * History of response_format issues:
 * - json_schema caused HTTP 400 on most local models (fixed previously).
 * - json_object ALSO causes HTTP 400 on many quantised LM Studio builds.
 *
 * Resolution: response_format is disabled by default. The orchestrator no
 * longer passes json_mode:true; the system prompt + extractJSON handles
 * structured output instead. json_mode is kept in the API for future use
 * (e.g. a model that does support it) but defaults to off.
 *
 * max_tokens is now read from LM_STUDIO_MAX_TOKENS (default 2048) so it can
 * be tuned per model without a code change.
 */
import logger from "../utils/logger.js";

const BASE_URL    = process.env.LM_STUDIO_BASE_URL  ?? "http://localhost:1234/v1";
const MODEL       = process.env.LM_STUDIO_MODEL     ?? "local-model";
const API_KEY     = process.env.LM_STUDIO_API_KEY   ?? "lm-studio";
const MAX_TOKENS  = parseInt(process.env.LM_STUDIO_MAX_TOKENS ?? "2048", 10);

export interface LLMMessage {
  role:    "system" | "user" | "assistant";
  content: string;
}

export interface LLMOptions {
  temperature?: number;
  max_tokens?:  number;
  /**
   * If true, requests response_format: { type: "json_object" }.
   * Only enable this if you have confirmed your local model supports it
   * without returning HTTP 400. Most quantised LM Studio models do NOT.
   * Default: false.
   */
  json_mode?:   boolean;
  stop?:        string[];
}

export async function chatCompletion(
  messages: LLMMessage[],
  options:  LLMOptions = {},
): Promise<string> {
  logger.debug(`LLM request: ${messages.length} messages, temp=${options.temperature ?? 0.7}`);

  const body: Record<string, unknown> = {
    model:       MODEL,
    messages,
    temperature: options.temperature ?? 0.7,
    max_tokens:  options.max_tokens  ?? MAX_TOKENS,
    ...(options.stop ? { stop: options.stop } : {}),
  };

  // Only attach response_format if explicitly opted in — most local models
  // reject it with 400, adding wasted latency on every request.
  if (options.json_mode === true) {
    body.response_format = { type: "json_object" };
  }

  const res = await fetch(`${BASE_URL}/chat/completions`, {
    method:  "POST",
    headers: {
      "Content-Type":  "application/json",
      "Authorization": `Bearer ${API_KEY}`,
    },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`LM Studio error ${res.status}: ${err}`);
  }

  const data = await res.json() as {
    choices: Array<{ message: { content: string }; finish_reason?: string }>;
    usage?:  { prompt_tokens: number; completion_tokens: number };
  };

  const content     = data.choices[0]?.message?.content ?? "";
  const finishReason = data.choices[0]?.finish_reason ?? "unknown";

  logger.debug(
    `LLM response: ${content.length} chars, ` +
    `tokens=${data.usage?.prompt_tokens ?? "?"}/${data.usage?.completion_tokens ?? "?"}, ` +
    `finish=${finishReason}`
  );

  if (finishReason === "length") {
    logger.warn(
      `LLM hit token limit (finish_reason=length). ` +
      `Completion used ${data.usage?.completion_tokens} tokens. ` +
      `Raise LM_STUDIO_MAX_TOKENS (currently ${options.max_tokens ?? MAX_TOKENS}) if JSON is being truncated.`
    );
  }

  return content;
}

/** Quick health check — returns true if LM Studio is reachable */
export async function isLmStudioAvailable(): Promise<boolean> {
  try {
    const res = await fetch(`${BASE_URL}/models`, {
      headers: { "Authorization": `Bearer ${API_KEY}` },
      signal:  AbortSignal.timeout(3000),
    });
    return res.ok;
  } catch {
    return false;
  }
}
