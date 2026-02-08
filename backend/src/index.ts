import express from "express";
import cors from "cors";
import path from "node:path";
import type { NextFunction, Request, Response } from "express";
import {
  AUTO_CLOSE_ENABLED,
  AUTO_CLOSE_INTERVAL_MS,
  AUTO_MINE,
  RPC_URL,
} from "./config";
import { publicClient } from "./blockchain";
import { ensureSuperadmin } from "./services/admin";
import { autoCloseExpiredElections } from "./services/autoClose";
import adminRouter from "./routes/admin";
import studentRouter from "./routes/student";
import publicRouter from "./routes/public";
import logger from "./logger";
import { requestLogger } from "./middleware/requestLogger";

const app = express();
app.use(cors({ origin: "http://localhost:3000" }));
// Selfie data URL can exceed the default 100kb parser limit.
app.use(express.json({ limit: "2mb" }));
app.use(requestLogger);

ensureSuperadmin().catch((err) => logger.error({ err }, "superadmin bootstrap failed"));

app.use(studentRouter);
app.use(adminRouter);
app.use(publicRouter);

app.use("/uploads", express.static(path.join(process.cwd(), "uploads")));
app.get("/health", (_req, res) => res.json({ ok: true }));

app.use((err: unknown, _req: Request, res: Response, _next: NextFunction) => {
  logger.error({ err }, "unhandled error");
  if (res.headersSent) return;
  const payloadTooLarge =
    typeof err === "object" &&
    err !== null &&
    ("status" in err || "statusCode" in err) &&
    (((err as { status?: number }).status ?? 0) === 413 ||
      ((err as { statusCode?: number }).statusCode ?? 0) === 413);
  if (payloadTooLarge) {
    return res.status(413).json({
      ok: false,
      reason: "Payload terlalu besar. Coba ulangi dengan selfie berukuran lebih kecil.",
    });
  }
  res.status(500).json({ ok: false, reason: "Internal server error" });
});

app.listen(4000, () => {
  logger.info("Backend running on http://localhost:4000");
});

if (AUTO_CLOSE_ENABLED) {
  setInterval(autoCloseExpiredElections, AUTO_CLOSE_INTERVAL_MS);
  setTimeout(autoCloseExpiredElections, 2000);
}

if (AUTO_MINE && RPC_URL.includes("127.0.0.1")) {
  setInterval(async () => {
    try {
      await (publicClient as any).request({ method: "evm_mine" });
    } catch (err) {
      logger.error({ err }, "auto mine failed");
    }
  }, 10000);
}
