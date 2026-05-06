import {
  TutorDecision, Language, Difficulty, ExecutionResult, LearnerState,
} from "@/types";

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3001";

async function post<T>(path: string, body: unknown): Promise<T> {
  const res = await fetch(`${API_URL}${path}`, {
    method:  "POST",
    headers: { "Content-Type": "application/json" },
    body:    JSON.stringify(body),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: res.statusText }));
    throw new Error((err as { error?: string }).error ?? `Request failed: ${res.status}`);
  }
  return res.json() as Promise<T>;
}

// ── Health ────────────────────────────────────────────────────────────────────

export async function getHealth(): Promise<{ status: string; lmStudio: "online" | "offline" }> {
  try {
    const res = await fetch(`${API_URL}/health`);
    if (!res.ok) return { status: "degraded", lmStudio: "offline" };
    const data = await res.json();
    return { status: data.status, lmStudio: data.services?.lmStudio ?? "offline" };
  } catch {
    return { status: "offline", lmStudio: "offline" };
  }
}

// ── Session ───────────────────────────────────────────────────────────────────

export async function createSession(
  topic:      string,
  language:   Language,
  difficulty: Difficulty,
): Promise<{ sessionId: string; learnerState: LearnerState }> {
  return post("/sessions", { topic, language, difficulty });
}

export async function deleteSession(sessionId: string): Promise<void> {
  await fetch(`${API_URL}/sessions/${sessionId}`, { method: "DELETE" });
}

// ── Chat ──────────────────────────────────────────────────────────────────────
// Backend /chat returns { sessionId, decision }.

export async function sendChatMessage(params: {
  sessionId?:  string;
  message:     string;
  language?:   Language;
  topic?:      string;
  difficulty?: Difficulty;
  codeSource?: string;
}): Promise<{ sessionId: string; decision: TutorDecision }> {
  return post<{ sessionId: string; decision: TutorDecision }>("/chat", params);
}

// ── Execute ───────────────────────────────────────────────────────────────────

export async function executeCode(params: {
  sessionId:          string;
  source:             string;
  language:           Language;
  withTutorFeedback?: boolean;
}): Promise<{ result: ExecutionResult; tutorFeedback?: string }> {
  return post<{ result: ExecutionResult; tutorFeedback?: string }>(
    "/execute",
    { withTutorFeedback: true, ...params },
  );
}

// ── Hint ──────────────────────────────────────────────────────────────────────

export async function requestHint(sessionId: string): Promise<{ tutorMessage: string }> {
  const data = await post<{ sessionId: string; decision: TutorDecision }>("/chat", {
    sessionId,
    message: "Can I have a hint please?",
  });
  return { tutorMessage: data.decision.tutorMessage };
}