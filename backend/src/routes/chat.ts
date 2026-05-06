// backend/src/routes/chat.ts
import { Router, Request, Response } from "express";
import { z } from "zod";
import { validate } from "../middleware/validate.js";
import { createSession, getSession } from "../services/SessionStore.js";
import { orchestrate } from "../services/TutorOrchestrator.js";
import { ChatResponse } from "../types/index.js";

const router = Router();

const chatSchema = z.object({
  sessionId: z.string().uuid().optional(),
  message: z.string().min(1).max(4000),
  language: z.enum(["python", "javascript", "typescript", "java", "general"]).optional(),
  topic: z.string().max(200).optional(),
  difficulty: z.enum(["beginner", "intermediate", "advanced"]).optional(),
  codeContext: z
    .object({
      source: z.string().max(20000),
      language: z.enum(["python", "javascript", "typescript", "java", "general"]),
    })
    .optional(),
});

router.post("/", validate(chatSchema), async (req: Request, res: Response) => {
  const { sessionId, message, language, topic, difficulty, codeContext } = req.body;

  let session = sessionId ? getSession(sessionId) : undefined;

  if (!session) {
    session = createSession(
      language ?? "general",
      topic ?? "programming fundamentals",
      difficulty ?? "beginner"
    );
  }

  const decision = await orchestrate(
    session,
    message,
    codeContext?.source,
    codeContext?.language
  );

  // Fix: omit reasoning entirely from the response instead of re-adding it as
  // an empty string, which was leaking a spurious field to the client.
  const { reasoning: _reasoning, ...safeDecision } = decision;

  const response: ChatResponse = {
    sessionId: session.id,
    decision: safeDecision,
  };

  res.json(response);
});

export default router;
