/**
 * Thin client for the LM Studio OpenAI-compatible local endpoint.
 * Uses the /v1/chat/completions API.
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
  /** If true, instructs LM Studio to return valid JSON */
  json_mode?:    boolean;
  stop?:         string[];
}

export async function chatCompletion(
  messages: LLMMessage[],
  options:  LLMOptions = {},
): Promise<string> {
  const body = {
    model:       MODEL,
    messages,
    temperature: options.temperature ?? 0.7,
    max_tokens:  options.max_tokens  ?? 1024,
    ...(options.json_mode
      ? {
          response_format: {
            type: "json_schema",
            json_schema: {
              name:   "tutor_response",
              strict: false,
              schema: { type: "object" },
            },
          },
        }
      : {}),
    ...(options.stop ? { stop: options.stop } : {}),
  };

  logger.debug(`LLM request: ${messages.length} messages, temp=${body.temperature}`);

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