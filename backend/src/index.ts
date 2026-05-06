import "dotenv/config";
import "express-async-errors";
import express from "express";
import cors from "cors";
import helmet from "helmet";
import rateLimit from "express-rate-limit";

import { errorHandler } from "./middleware/errorHandler.js";
import chatRouter    from "./routes/chat.js";
import executeRouter from "./routes/execute.js";
import sessionRouter from "./routes/session.js";
import healthRouter  from "./routes/health.js";
import logger from "./utils/logger.js";

const app  = express();
const PORT = Number(process.env.PORT ?? 3001);

// ── Security middleware ───────────────────────────────────────────────────────
app.use(helmet());
app.use(cors({
  origin: process.env.CORS_ORIGIN ?? "http://localhost:3000",
  methods: ["GET", "POST", "DELETE"],
  allowedHeaders: ["Content-Type", "Authorization"],
}));
app.use(express.json({ limit: "1mb" }));

// ── Rate limiting ─────────────────────────────────────────────────────────────
const limiter = rateLimit({
  windowMs: 60 * 1000,   // 1 minute
  max: 60,               // 60 requests per minute per IP
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: "Too many requests. Please slow down." },
});
app.use(limiter);

// ── Routes ────────────────────────────────────────────────────────────────────
app.use("/health",   healthRouter);
app.use("/chat",     chatRouter);
app.use("/execute",  executeRouter);
app.use("/sessions", sessionRouter);

// ── Global error handler ──────────────────────────────────────────────────────
app.use(errorHandler);

// ── Start ─────────────────────────────────────────────────────────────────────
app.listen(PORT, () => {
  logger.info(`🎓 AI Tutor backend running on http://localhost:${PORT}`);
  logger.info(`   LM Studio: ${process.env.LM_STUDIO_BASE_URL ?? "http://127.0.0.1:1234/v1"}`);
  logger.info(`   Environment: ${process.env.NODE_ENV ?? "development"}`);
});

export default app;
