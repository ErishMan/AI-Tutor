/**
 * Thin client for the LM Studio OpenAI-compatible local endpoint.
 * Uses the /v1/chat/completions API.
 *
 * Fix (issues 1 & 2):
 * - json_schema response_format caused HTTP 400 on many local models.
 *   Replaced with json_object, which is universally supported by LM Studio.
 * - Added a one-shot retry without any response_format for models that reject
 *   structured-output requests entirely. The retry is transparent to callers.
 */
import logger from "../utils/logger.js";

const BASE_URL = process.env.LM_STUDIO_BASE_URL ?? "http://localhost:1234/v1";
const MODEL    = process.env.LM_STUDIO_MODEL    ?? "local-model";
const API_KEY  = process.env.LM_STUDIO_API_KEY  ?? "lm-studio";

export interface LLMMessage {
  role:    "system" | "user" | "assistant";
  content: string;
}

export interface LLMOptions {
  temperature?:  number;
  max_tokens?:   number;
  /**
   * If true, asks the model to return valid JSON.
   * Uses response_format: { type: "json_object" } — the most widely supported
   * structured-output mode for local LM Studio models.
   * Falls back to a plain request (no response_format) if the model returns
   * a non-2xx status, so even non-compliant models still work.
   */
  json_mode?:    boolean;
  stop?:         string[];
}

async function doRequest(
  messages:       LLMMessage[],
  options:        LLMOptions,
  useJsonFormat:  boolean,
): Promise<Response> {
  const body: Record<string, unknown> = {
    model:       MODEL,
    messages,
    temperature: options.temperature ?? 0.7,
    max_tokens:  options.max_tokens  ?? 1024,
    ...(options.stop ? { stop: options.stop } : {}),
  };

  if (useJsonFormat && options.json_mode) {
    // json_object is supported by all LM Studio builds; json_schema is not.
    body.response_format = { type: "json_object" };
  }

  return fetch(`${BASE_URL}/chat/completions`, {
    method:  "POST",
    headers: {
      "Content-Type":  "application/json",
      "Authorization": `Bearer ${API_KEY}`,
    },
    body: JSON.stringify(body),
  });
}

export async function chatCompletion(
  messages: LLMMessage[],
  options:  LLMOptions = {},
): Promise<string> {
  logger.debug(`LLM request: ${messages.length} messages, temp=${options.temperature ?? 0.7}`);

  let res = await doRequest(messages, options, true);

  // Retry without response_format if the model rejected the structured-output
  // request (common with quantised models that don't implement the spec).
  if (!res.ok && options.json_mode) {
    logger.warn(
      `LLM returned ${res.status} with json_mode — retrying without response_format. ` +
      `Consider setting LM_STUDIO_JSON_MODE=false in .env if this persists.`
    );
    res = await doRequest(messages, options, false);
  }

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`LM Studio error ${res.status}: ${err}`);
  }

  const data = await res.json() as {
    choices: Array<{ message: { content: string } }>;
    usage?: { prompt_tokens: number; completion_tokens: number };
  };

  const content = data.choices[0]?.message?.content ?? "";
  logger.debug(
    `LLM response: ${content.length} chars, ` +
    `tokens=${data.usage?.prompt_tokens}/${data.usage?.completion_tokens}`
  );

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
