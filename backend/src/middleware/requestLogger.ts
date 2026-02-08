import type { Request, Response, NextFunction } from "express";
import logger from "../logger";

export function requestLogger(req: Request, res: Response, next: NextFunction) {
  const start = process.hrtime.bigint();
  res.on("finish", () => {
    const elapsedMs = Number(process.hrtime.bigint() - start) / 1_000_000;
    logger.info(
      {
        method: req.method,
        path: req.originalUrl || req.url,
        statusCode: res.statusCode,
        durationMs: Number(elapsedMs.toFixed(2)),
      },
      "http_request"
    );
  });
  next();
}
