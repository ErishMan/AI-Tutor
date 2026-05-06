import { Router, Request, Response } from "express";
import {
  getSession,
  deleteSession,
} from "../services/SessionStore.js";
import { chatCompletion } from "../services/LmStudioClient.js";
import { SessionSummaryResponse } from "../types/index.js";
import logger from "../utils/logger.js";

const router = Router();

// GET /sessions/:id — fetch session summary
router.get("/:id", (req: Request, res: Response) => {
  const session = getSession(req.params.id);
  if (!session) {
    res.status(404).json({ error: "Session not found" });
    return;
  }

  const summary: SessionSummaryResponse = {
    sessionId: session.id,
    topic: session.topic,
    turnsCount: session.turns.length,
    learnerState: session.learnerState,
    masteredConcepts: session.learnerState.masteredConcepts,
    misconceptions: session.learnerState.misconceptions,
  };

  res.json(summary);
});

// DELETE /sessions/:id — end session
router.delete("/:id", (req: Request, res: Response) => {
  const session = getSession(req.params.id);
  if (!session) {
    res.status(404).json({ error: "Session not found" });
    return;
  }
  deleteSession(req.params.id);
  res.json({ message: "Session ended" });
});

// POST /sessions/:id/hint — request a Socratic hint
router.post("/:id/hint", async (req: Request, res: Response) => {
  const session = getSession(req.params.id);
  if (!session) {
    res.status(404).json({ error: "Session not found" });
    return;
  }

  if (session.currentMode === "test") {
    res.status(403).json({ error: "Hints are not available in test mode." });
    return;
  }

  const { taskContext } = req.body as { taskContext?: string };
  const hintLevel = Math.min(
    3,
    Math.floor(session.learnerState.frustration * 3) + 1
  );

  try {
    const hint = await chatCompletion(
      [
        {
          role: "system",
          content:
            `You are a Socratic programming tutor. Give a level-${hintLevel} hint (1=subtle, 3=near-explicit). ` +
            "Do NOT give the full answer. Ask a leading question or point at a concept.",
        },
        {
          role: "user",
          content: `The student is working on: ${taskContext ?? session.topic}. ` +
            `Their skill level is ${session.learnerState.estimatedSkill.toFixed(2)}. Give a hint.`,
        },
      ],
      { temperature: 0.5, max_tokens: 150 }
    );

    res.json({ hint, hintLevel });
  } catch (err) {
    logger.error("Hint generation failed", err);
    res.status(500).json({ error: "Could not generate hint" });
  }
});

export default router;