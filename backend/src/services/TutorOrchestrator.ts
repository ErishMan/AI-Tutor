// backend/src/services/TutorOrchestrator.ts
import { v4 as uuidv4 } from "uuid";
import {
  Session,
  ConversationTurn,
  TutorDecision,
  TutorMode,
  TurnSignals,
  UIDirectives,
  SandboxTask,
  TestTask,
  Language,
} from "../types/index.js";
import { chatCompletion, LLMMessage } from "./LmStudioClient.js";
import { extractSignals } from "./SignalExtractor.js";
import { evaluatePolicy, updateLearnerState } from "./PolicyEngine.js";
import { updateSession } from "./SessionStore.js";
import logger from "../utils/logger.js";

// Reduced from 12 — keeps last 4 exchanges; limits prompt token spend.
const LIVE_TURN_WINDOW  = 8;
// Reduced from 6000 — hard ceiling so context never crowds out the response.
const MAX_CONTEXT_CHARS = 3500;

function buildSystemPrompt(session: Session, allowedModes: TutorMode[]): string {
  const ls = session.learnerState;
  // Compact learner state — one line each saves ~120 chars vs the old block.
  const learnerBlock = [
    `skill=${ls.estimatedSkill.toFixed(2)} confusion=${ls.confusion.toFixed(2)} mastery=${ls.mastery.toFixed(2)} frustration=${ls.frustration.toFixed(2)} pace=${ls.preferredPace}`,
    ls.misconceptions.length   ? `misconceptions: ${ls.misconceptions.join(", ")}` : "",
    ls.masteredConcepts.length ? `mastered: ${ls.masteredConcepts.join(", ")}` : "",
  ].filter(Boolean).join("\n");

  return `You are a warm, Socratic programming tutor.
Topic: ${session.topic} | Language: ${session.language} | Difficulty: ${session.difficulty}
LEARNER: ${learnerBlock}
STYLE: Warm and encouraging. Never give the full solution. Adapt to learner skill.
ALLOWED MODES: ${allowedModes.join(", ")} — you MUST pick one.

Respond with ONE raw JSON object and NOTHING else — no markdown fences, no prose before or after.
"tutorMessage" must be plain conversational text only (no JSON inside it).

Schema (use null for unused tasks):
{"mode":"chat|sandbox|test","tutorMessage":"...","objective":"...","reasoning":"...","newMisconceptions":[],"resolvedConcepts":[],"sandboxTask":{"instructions":"...","starterCode":"...","successCriteria":[],"hints":[],"language":"${session.language}"}|null,"testTask":{"prompt":"...","publicRubricItems":[],"hiddenRubricIds":[],"timeboxMinutes":null,"noHints":true,"language":"${session.language}"}|null}

Session context so far:
${session.contextSummary ?? "Start of session."}`;
}

function buildContextMessages(session: Session): LLMMessage[] {
  const recentTurns = session.turns.slice(-LIVE_TURN_WINDOW).reverse();
  let charCount = 0;
  const messages: LLMMessage[] = [];

  for (const turn of recentTurns) {
    let content = turn.content;

    if (turn.codeSubmission) {
      content += `\n\`\`\`${turn.codeSubmission.language}\n${turn.codeSubmission.source}\n\`\`\``;
      if (turn.codeSubmission.executionResult) {
        const r = turn.codeSubmission.executionResult;
        content += `\nOutput: ${r.stdout || "(none)"}${r.stderr ? `\nError: ${r.stderr}` : ""}`;
      }
    }

    if (charCount + content.length > MAX_CONTEXT_CHARS) break;
    charCount += content.length;
    messages.push({ role: turn.role as "user" | "assistant", content });
  }

  return messages.reverse();
}

/**
 * Extract the first complete JSON object from a raw LLM response.
 *
 * Strategy:
 * 1. Strip markdown fences.
 * 2. Find first { … last } — the happy path.
 * 3. If truncated (no closing }), try a set of simple bracket repairs.
 * 4. If all repairs fail, field-salvage: extract mode + tutorMessage via
 *    regex so the learner always gets a meaningful reply even from a badly
 *    truncated response, instead of "I'm here — what would you like to explore?"
 */
function extractJSON(raw: string): string {
  // Strip markdown fences
  let s = raw
    .replace(/^```[a-zA-Z]*\n?/gm, "")
    .replace(/^```\s*$/gm, "")
    .trim();

  const start = s.indexOf("{");
  if (start === -1) return s;

  // Happy path: well-formed object
  const end = s.lastIndexOf("}");
  if (end > start) return s.slice(start, end + 1);

  // Truncated — attempt bracket repairs
  const partial = s.slice(start);
  const repairs = [
    partial + "}",
    partial + "\"}",
    partial + "\"\"}",
    partial + "null}",
    partial + "\"null}",
    partial + "]}}",
    partial + "\"]}",
    partial + "\"}}",
    partial + "\"\"\n}}",
    partial + "null}}",
    partial + "null,\"testTask\":null}",
    partial + "null,\"testTask\":null,\"sandboxTask\":null}",
  ];

  for (const attempt of repairs) {
    try { JSON.parse(attempt); logger.warn("extractJSON: repaired truncated JSON"); return attempt; }
    catch { /* try next */ }
  }

  // All repairs failed — field-salvage: build a minimal valid object from
  // whatever fields we can regex out of the partial string.
  logger.warn("extractJSON: all repairs failed, attempting field salvage");
  try {
    const modeMatch    = partial.match(/"mode"\s*:\s*"(chat|sandbox|test)"/);
    const msgMatch     = partial.match(/"tutorMessage"\s*:\s*"((?:[^"\\]|\\.)*?)"/);
    const mode         = modeMatch?.[1] ?? "chat";
    const tutorMessage = msgMatch?.[1]
      ? msgMatch[1].replace(/\\n/g, "\n").replace(/\\t/g, "\t")
      : "";
    const salvaged = JSON.stringify({
      mode,
      tutorMessage,
      objective: "",
      reasoning: "response was truncated",
      newMisconceptions: [],
      resolvedConcepts: [],
      sandboxTask: null,
      testTask: null,
    });
    logger.warn(`extractJSON: salvaged mode=${mode} tutorMessage=${tutorMessage.slice(0,80)}`);
    return salvaged;
  } catch {
    return partial; // last resort — let JSON.parse fail with a clear error
  }
}

function parseLLMDecision(
  raw: string,
  allowedModes: TutorMode[],
  language: Language
): Omit<TutorDecision, "learnerState" | "uiDirectives"> & {
  newMisconceptions: string[];
  resolvedConcepts:  string[];
} {
  let parsed: Record<string, unknown>;

  try {
    parsed = JSON.parse(extractJSON(raw));
  } catch {
    logger.warn("LLM returned non-JSON, falling back to chat mode");
    logger.debug(`Raw LLM output was: \n${raw.slice(0, 400)}`);
    return {
      mode:              "chat",
      tutorMessage:      raw.trim() || "I'm here — what would you like to explore?",
      objective:         "Conversational engagement",
      reasoning:         "JSON parse failed — using raw text as chat message",
      newMisconceptions: [],
      resolvedConcepts:  [],
      sandboxTask:       undefined,
      testTask:          undefined,
    };
  }

  const mode = allowedModes.includes(parsed.mode as TutorMode)
    ? (parsed.mode as TutorMode)
    : allowedModes[0];

  // Unwrap tutorMessage if the model accidentally nested it
  let tutorMessage = parsed.tutorMessage;
  if (typeof tutorMessage === "object" && tutorMessage !== null) {
    tutorMessage =
      (tutorMessage as Record<string, unknown>).tutorMessage ??
      JSON.stringify(tutorMessage);
  }
  if (typeof tutorMessage === "string" && tutorMessage.trim().startsWith("{")) {
    try {
      const inner = JSON.parse(tutorMessage) as Record<string, unknown>;
      tutorMessage = inner.tutorMessage ?? tutorMessage;
    } catch { /* leave as-is */ }
  }
  // Fallback if tutorMessage is empty after all that
  if (!tutorMessage || String(tutorMessage).trim() === "") {
    tutorMessage = "I'm here — what would you like to explore?";
  }

  const sandboxTask =
    mode === "sandbox" && parsed.sandboxTask
      ? ({ ...(parsed.sandboxTask as object), language } as SandboxTask)
      : undefined;

  const testTask =
    mode === "test" && parsed.testTask
      ? ({ ...(parsed.testTask as object), language } as TestTask)
      : undefined;

  return {
    mode,
    tutorMessage:      String(tutorMessage),
    objective:         String(parsed.objective ?? ""),
    reasoning:         String(parsed.reasoning ?? ""),
    newMisconceptions: (parsed.newMisconceptions as string[]) ?? [],
    resolvedConcepts:  (parsed.resolvedConcepts as string[]) ?? [],
    sandboxTask,
    testTask,
  };
}

function buildUIDirectives(mode: TutorMode, frustration: number): UIDirectives {
  return {
    openPanel:          mode === "test" ? "test" : mode === "sandbox" ? "editor" : "chat",
    showRunButton:      mode === "sandbox" || mode === "test",
    lockSolutionView:   mode === "test",
    showHintButton:     mode === "sandbox",
    showProgressUpdate: frustration < 0.3,
    progressMessage:    frustration < 0.3 ? "You're making great progress! 🚀" : undefined,
  };
}

async function maybeCompressSummary(
  session: Session,
  composedTurns: ConversationTurn[]
): Promise<string | undefined> {
  if (composedTurns.length % 20 !== 0 || composedTurns.length === 0) return undefined;

  const text = composedTurns
    .slice(-20)
    .map(t => `${t.role}: ${t.content.slice(0, 200)}`)
    .join("\n");

  try {
    const summary = await chatCompletion(
      [
        {
          role:    "system",
          content:
            "Summarise this tutoring session in 3-5 bullets: concepts covered, " +
            "learner mistakes, current understanding. Be concise.",
        },
        { role: "user", content: text },
      ],
      { temperature: 0.3, max_tokens: 300 }
    );
    return `${session.contextSummary ?? ""}\n\n### Session summary (auto):\n${summary}`;
  } catch {
    logger.warn("Context compression failed");
    return session.contextSummary;
  }
}

export async function orchestrate(
  session: Session,
  userMessage: string,
  codeSource?: string,
  codeLanguage?: Language
): Promise<TutorDecision> {
  const signals: TurnSignals = await extractSignals(userMessage, codeSource);
  const updatedLearnerState  = updateLearnerState(session.learnerState, signals);
  const policy               = evaluatePolicy(updatedLearnerState, signals, session);

  if (policy.overrideReason) {
    logger.info(`Policy override: ${policy.overrideReason}`);
  }

  const systemPrompt    = buildSystemPrompt(session, policy.allowedModes);
  const contextMessages = buildContextMessages(session);

  const userTurnContent = codeSource
    ? `${userMessage}\n\n\`\`\`${codeLanguage ?? session.language}\n${codeSource}\n\`\`\``
    : userMessage;

  const messages: LLMMessage[] = [
    { role: "system", content: systemPrompt },
    ...contextMessages,
    { role: "user", content: userTurnContent },
  ];

  // json_mode off — local models reject response_format with HTTP 400.
  // Raised to 2400 to give the full sandbox/test JSON object enough headroom.
  const rawResponse = await chatCompletion(messages, {
    temperature: 0.65,
    max_tokens:  2400,
    json_mode:   false,
  });

  const parsed = parseLLMDecision(rawResponse, policy.allowedModes, session.language);

  const finalLearnerState = {
    ...updatedLearnerState,
    misconceptions: [
      ...new Set([...updatedLearnerState.misconceptions, ...parsed.newMisconceptions]),
    ],
    masteredConcepts: [
      ...new Set([...updatedLearnerState.masteredConcepts, ...parsed.resolvedConcepts]),
    ],
  };

  const userTurn: ConversationTurn = {
    id:        uuidv4(),
    role:      "user",
    content:   userMessage,
    timestamp: Date.now(),
    mode:      session.currentMode,
    signals,
    ...(codeSource
      ? { codeSubmission: { language: codeLanguage ?? session.language, source: codeSource } }
      : {}),
  };

  const assistantTurn: ConversationTurn = {
    id:        uuidv4(),
    role:      "assistant",
    content:   parsed.tutorMessage,
    timestamp: Date.now(),
    mode:      parsed.mode,
  };

  const composedTurns  = [...session.turns, userTurn, assistantTurn];
  const updatedSummary = await maybeCompressSummary(session, composedTurns);

  updateSession(session.id, {
    turns:        composedTurns,
    learnerState: finalLearnerState,
    currentMode:  parsed.mode,
    ...(updatedSummary ? { contextSummary: updatedSummary } : {}),
  });

  return {
    mode:         parsed.mode,
    tutorMessage: parsed.tutorMessage,
    objective:    parsed.objective,
    reasoning:    parsed.reasoning,
    learnerState: finalLearnerState,
    sandboxTask:  parsed.sandboxTask,
    testTask:     parsed.testTask,
    uiDirectives: buildUIDirectives(parsed.mode, finalLearnerState.frustration),
  };
}
