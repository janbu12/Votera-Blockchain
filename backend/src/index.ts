import express from "express";
import cors from "cors";
import path from "node:path";
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

const app = express();
app.use(cors({ origin: "http://localhost:3000" }));
app.use(express.json());

ensureSuperadmin().catch((err) => console.error("superadmin bootstrap failed", err));

app.use(studentRouter);
app.use(adminRouter);
app.use(publicRouter);

app.use("/uploads", express.static(path.join(process.cwd(), "uploads")));
app.get("/health", (_req, res) => res.json({ ok: true }));

app.listen(4000, () => {
  console.log("Backend running on http://localhost:4000");
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
      console.error("auto mine failed", err);
    }
  }, 10000);
}
