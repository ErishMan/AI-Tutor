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

const LIVE_TURN_WINDOW = 12;
const MAX_CONTEXT_CHARS = 6000;

function buildSystemPrompt(session: Session, allowedModes: TutorMode[]): string {
  return `You are an expert, warm, and Socratic programming tutor.

Current session context:
Topic: ${session.topic}
Language: ${session.language}
Difficulty: ${session.difficulty}

LEARNER STATE
Skill level (0-1): ${session.learnerState.estimatedSkill.toFixed(2)}
Confusion (0-1): ${session.learnerState.confusion.toFixed(2)}
Mastery (0-1): ${session.learnerState.mastery.toFixed(2)}
Frustration (0-1): ${session.learnerState.frustration.toFixed(2)}
Known misconceptions: ${session.learnerState.misconceptions.join(", ") || "none observed yet"}
Mastered concepts: ${session.learnerState.masteredConcepts.join(", ") || "none confirmed yet"}
Preferred pace: ${session.learnerState.preferredPace}

TEACHING STYLE
- Be warm, encouraging, and Socratic.
- Never write the complete solution.
- Adapt depth and vocabulary to the learner's estimated skill.
- Do not assume a programming language preference unless the learner explicitly states one.

ALLOWED MODES for this turn: ${allowedModes.join(", ")}
You MUST choose one of these modes only.

You MUST respond with a single JSON object and NOTHING else.
Do not use markdown fences.
Do not put JSON inside "tutorMessage".
"tutorMessage" must be plain conversational text for the learner.

Schema:
{
  "mode": "chat" | "sandbox" | "test",
  "tutorMessage": "plain text reply for the learner",
  "objective": "pedagogical objective",
  "reasoning": "internal reasoning",
  "newMisconceptions": [],
  "resolvedConcepts": [],
  "sandboxTask": {
    "instructions": "task instructions",
    "starterCode": "starter code",
    "successCriteria": ["criterion"],
    "hints": ["hint"],
    "language": "${session.language}"
  } | null,
  "testTask": {
    "prompt": "test prompt",
    "publicRubricItems": ["item"],
    "hiddenRubricIds": ["id"],
    "timeboxMinutes": null,
    "noHints": true,
    "language": "${session.language}"
  } | null
}

Context summary from earlier in the session:
${session.contextSummary ?? "No prior summary — this is the start of the session."}`;
}

function buildContextMessages(session: Session): LLMMessage[] {
  const recentTurns = session.turns.slice(-LIVE_TURN_WINDOW);
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

    charCount += content.length;
    if (charCount > MAX_CONTEXT_CHARS) break;

    messages.push({ role: turn.role as "user" | "assistant", content });
  }

  return messages;
}

function extractJSON(raw: string): string {
  const cleaned = raw
    .replace(/^```json?\n?/i, "")
    .replace(/\n?```$/i, "")
    .trim();

  if (cleaned.startsWith("{")) return cleaned;

  const start = cleaned.indexOf("{");
  const end = cleaned.lastIndexOf("}");

  if (start !== -1 && end !== -1 && end > start) {
    return cleaned.slice(start, end + 1);
  }

  return cleaned;
}

function parseLLMDecision(
  raw: string,
  allowedModes: TutorMode[],
  language: Language
): Omit<TutorDecision, "learnerState" | "uiDirectives"> & {
  newMisconceptions: string[];
  resolvedConcepts: string[];
} {
  let parsed: Record<string, unknown>;

  try {
    parsed = JSON.parse(extractJSON(raw));
  } catch {
    logger.warn("LLM returned non-JSON, falling back to chat mode");
    return {
      mode: "chat",
      tutorMessage: raw.trim() || "I'm here — what would you like to explore?",
      objective: "Conversational engagement",
      reasoning: "JSON parse failed — using raw text as chat message",
      newMisconceptions: [],
      resolvedConcepts: [],
      sandboxTask: undefined,
      testTask: undefined,
    };
  }

  const mode = allowedModes.includes(parsed.mode as TutorMode)
    ? (parsed.mode as TutorMode)
    : allowedModes[0];

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
    } catch {
      // leave as-is
    }
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
    tutorMessage: String(tutorMessage ?? ""),
    objective: String(parsed.objective ?? ""),
    reasoning: String(parsed.reasoning ?? ""),
    newMisconceptions: (parsed.newMisconceptions as string[]) ?? [],
    resolvedConcepts: (parsed.resolvedConcepts as string[]) ?? [],
    sandboxTask,
    testTask,
  };
}

function buildUIDirectives(mode: TutorMode, frustration: number): UIDirectives {
  return {
    openPanel: mode === "test" ? "test" : mode === "sandbox" ? "editor" : "chat",
    showRunButton: mode === "sandbox" || mode === "test",
    lockSolutionView: mode === "test",
    showHintButton: mode === "sandbox",
    showProgressUpdate: frustration < 0.3,
    progressMessage: frustration < 0.3 ? "You're making great progress! 🚀" : undefined,
  };
}

async function maybeCompressSummary(session: Session): Promise<string | undefined> {
  if (session.turns.length % 20 !== 0 || session.turns.length === 0) return undefined;

  const text = session.turns
    .slice(-20)
    .map(t => `${t.role}: ${t.content.slice(0, 200)}`)
    .join("\n");

  try {
    const summary = await chatCompletion(
      [
        {
          role: "system",
          content:
            "Summarise this tutoring session excerpt in 3-5 bullet points. Focus on: " +
            "what concepts were covered, any mistakes the learner made, and their current " +
            "understanding. Be concise.",
        },
        { role: "user", content: text },
      ],
      { temperature: 0.3, max_tokens: 200 }
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
  const updatedLearnerState = updateLearnerState(session.learnerState, signals);
  const policy = evaluatePolicy(updatedLearnerState, signals, session);

  if (policy.overrideReason) {
    logger.info(`Policy override: ${policy.overrideReason}`);
  }

  const systemPrompt = buildSystemPrompt(session, policy.allowedModes);
  const contextMessages = buildContextMessages(session);

  const userTurnContent = codeSource
    ? `${userMessage}\n\n\`\`\`${codeLanguage ?? session.language}\n${codeSource}\n\`\`\``
    : userMessage;

  const messages: LLMMessage[] = [
    { role: "system", content: systemPrompt },
    ...contextMessages,
    { role: "user", content: userTurnContent },
  ];

  const rawResponse = await chatCompletion(messages, {
    temperature: 0.65,
    max_tokens: 1200,
    json_mode: true,
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
    id: uuidv4(),
    role: "user",
    content: userMessage,
    timestamp: Date.now(),
    mode: session.currentMode,
    signals,
    ...(codeSource
      ? { codeSubmission: { language: codeLanguage ?? session.language, source: codeSource } }
      : {}),
  };

  const assistantTurn: ConversationTurn = {
    id: uuidv4(),
    role: "assistant",
    content: parsed.tutorMessage,
    timestamp: Date.now(),
    mode: parsed.mode,
  };

  const updatedSummary = await maybeCompressSummary(session);

  updateSession(session.id, {
    turns: [...session.turns, userTurn, assistantTurn],
    learnerState: finalLearnerState,
    currentMode: parsed.mode,
    ...(updatedSummary ? { contextSummary: updatedSummary } : {}),
  });

  return {
    mode: parsed.mode,
    tutorMessage: parsed.tutorMessage,
    objective: parsed.objective,
    reasoning: parsed.reasoning,
    learnerState: finalLearnerState,
    sandboxTask: parsed.sandboxTask,
    testTask: parsed.testTask,
    uiDirectives: buildUIDirectives(parsed.mode, finalLearnerState.frustration),
  };
}