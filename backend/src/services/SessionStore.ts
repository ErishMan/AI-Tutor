/**
 * In-memory session store with TTL eviction.
 * For production, swap the backing store for Redis or a DB.
 */
import { Session, LearnerState, Language } from "../types/index.js";
import { v4 as uuidv4 } from "uuid";
import logger from "../utils/logger.js";

const TTL_MS = Number(process.env.SESSION_TTL_MS ?? 7_200_000); // 2h default

const store = new Map<string, Session>();

// Evict stale sessions every 30 minutes
setInterval(() => {
  const now = Date.now();
  let evicted = 0;
  for (const [id, session] of store) {
    if (now - session.updatedAt > TTL_MS) {
      store.delete(id);
      evicted++;
    }
  }
  if (evicted > 0) logger.info(`SessionStore: evicted ${evicted} stale sessions`);
}, 30 * 60 * 1000);

const defaultLearnerState: LearnerState = {
  estimatedSkill:   0.3,
  confusion:        0,
  mastery:          0,
  frustration:      0,
  misconceptions:   [],
  masteredConcepts: [],
  preferredPace:    "normal",
};

export function createSession(
  language:   Language  = "python",
  topic:      string    = "programming fundamentals",
  difficulty: Session["difficulty"] = "beginner",
): Session {
  const session: Session = {
    id:           uuidv4(),
    createdAt:    Date.now(),
    updatedAt:    Date.now(),
    language,
    topic,
    difficulty,
    turns:        [],
    learnerState: { ...defaultLearnerState },
    currentMode:  "chat",
    pasteMetrics: {
      // Fix: was misspelled as largePasseCount
      largePasteCount:      0,
      noTypingBeforeSubmit: false,
    },
  };
  store.set(session.id, session);
  logger.info(`Session created: ${session.id} topic=${topic} lang=${language}`);
  return session;
}

export function getSession(id: string): Session | undefined {
  return store.get(id);
}

export function updateSession(
  id:    string,
  patch: Partial<Session>,
): Session {
  const existing = store.get(id);
  if (!existing) throw new Error(`Session not found: ${id}`);
  const updated: Session = { ...existing, ...patch, updatedAt: Date.now() };
  store.set(id, updated);
  return updated;
}

export function deleteSession(id: string): void {
  store.delete(id);
}

export function getSessionCount(): number {
  return store.size;
}
