import { Request, Response, NextFunction } from "express";
import logger from "../utils/logger.js";

export function errorHandler(
  err: Error,
  _req: Request,
  res: Response,
  _next: NextFunction
): void {
  logger.error(`Unhandled error: ${err.message}`, { stack: err.stack });

  const status = (err as { status?: number }).status ?? 500;
  const message =
    process.env.NODE_ENV === "production"
      ? "An internal error occurred."
      : err.message;

  res.status(status).json({ error: message });
}