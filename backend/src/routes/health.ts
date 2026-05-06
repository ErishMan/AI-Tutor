import { Router, Request, Response } from "express";
import { isLmStudioAvailable } from "../services/LmStudioClient.js";
import { getSessionCount } from "../services/SessionStore.js";

const router = Router();

router.get("/", async (_req: Request, res: Response) => {
  const lmStudioOnline = await isLmStudioAvailable();

  res.json({
    status: lmStudioOnline ? "ok" : "degraded",
    timestamp: new Date().toISOString(),
    services: {
      lmStudio: lmStudioOnline ? "online" : "offline",
      sessionStore: "ok",
    },
    activeSessions: getSessionCount(),
    version: "1.0.0",
  });
});

export default router;