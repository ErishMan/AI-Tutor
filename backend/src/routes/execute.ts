import { Router, Request, Response } from "express";
import { z } from "zod";
import { validate } from "../middleware/validate.js";
import { getSession, updateSession } from "../services/SessionStore.js";
import { execute } from "../services/SandboxExecutor.js";
import { assess } from "../services/AssessmentService.js";
import { ExecuteResponse } from "../types/index.js";

const router = Router();

const executeSchema = z.object({
  sessionId:          z.string().uuid(),
  source:             z.string().min(1).max(20000),
  language:           z.enum(["python", "javascript", "typescript", "java"]),
  mode:               z.enum(["sandbox", "test"]).default("sandbox"),
  // Fix: withTutorFeedback is now read and honoured in the handler
  withTutorFeedback:  z.boolean().optional(),
});

router.post("/", validate(executeSchema), async (req: Request, res: Response) => {
  const { sessionId, source, language, mode, withTutorFeedback } = req.body;

  const session = getSession(sessionId);
  if (!session) {
    res.status(404).json({ error: "Session not found" });
    return;
  }

  // Run code in sandbox
  const result = await execute(source, language);

  let tutorFeedback: string | undefined;
  let assessmentReport;

  // Fix: only generate tutor feedback when mode is "test", a prior test turn
  // exists, AND withTutorFeedback is not explicitly false.
  if (mode === "test" && withTutorFeedback !== false) {
    const lastAssistantTurn = [...session.turns]
      .reverse()
      .find(t => t.role === "assistant" && t.mode === "test");

    if (lastAssistantTurn) {
      const mockTask = {
        prompt:            "Complete the programming task",
        publicRubricItems: ["Code runs without errors", "Output is not empty"],
        hiddenRubricIds:   ["output_not_empty", "no_hardcoded_answer"],
        noHints:           true,
        language,
      };
      assessmentReport  = await assess(source, result, mockTask);
      tutorFeedback     = assessmentReport.qualitativeFeedback;
      result.testResults = assessmentReport.testResults.filter(t => !t.hidden);
    }
  }

  // Attach execution result to the last user code submission in session
  const turns = [...session.turns];
  const lastUserTurn = [...turns].reverse().find(t => t.role === "user");
  if (lastUserTurn?.codeSubmission) {
    lastUserTurn.codeSubmission.executionResult = result;
    updateSession(sessionId, { turns });
  }

  const response: ExecuteResponse = {
    sessionId,
    result,
    tutorFeedback,
  };

  res.json(response);
});

export default router;
