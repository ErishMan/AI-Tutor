import { createLogger, format, transports } from "winston";

const logger = createLogger({
  level: process.env.NODE_ENV === "production" ? "info" : "debug",
  format: format.combine(
    format.timestamp({ format: "HH:mm:ss" }),
    format.colorize(),
    format.printf(({ timestamp, level, message, ...meta }) => {
      const metaStr = Object.keys(meta).length ? " " + JSON.stringify(meta) : "";
      return `${timestamp} [${level}] ${message}${metaStr}`;
    })
  ),
  transports: [new transports.Console()],
});

export default logger;