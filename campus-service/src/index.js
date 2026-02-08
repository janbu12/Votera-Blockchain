import "dotenv/config";
import path from "node:path";
import { fileURLToPath } from "node:url";
import express from "express";
import logger from "./logger.js";
import {
  changeStudentPassword,
  getStudent,
  listStudents,
  verifyStudentCredentials
} from "./students.js";

const app = express();
app.use(express.json());
app.use((req, res, next) => {
  const startAt = process.hrtime.bigint();
  res.on("finish", () => {
    const elapsedMs = Number(process.hrtime.bigint() - startAt) / 1_000_000;
    logger.info(
      {
        method: req.method,
        path: req.originalUrl || req.url,
        statusCode: res.statusCode,
        durationMs: Number(elapsedMs.toFixed(2))
      },
      "http_request"
    );
  });
  next();
});

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const publicDir = path.join(__dirname, "..", "public");
app.use(express.static(publicDir));

const SERVICE_TOKEN = process.env.CAMPUS_SERVICE_TOKEN || "change-this-campus-token";
const PUBLIC_BASE = process.env.CAMPUS_PUBLIC_BASE_URL || "http://localhost:4100";
const PORT = Number(process.env.CAMPUS_SERVICE_PORT || "4100");

function officialPhotoUrl(nim) {
  return `${PUBLIC_BASE}/photos/${nim}.svg`;
}

function requireInternalToken(req, res, next) {
  const token = req.headers["x-campus-service-token"];
  if (typeof token !== "string" || token !== SERVICE_TOKEN) {
    return res.status(401).json({ ok: false, reason: "Unauthorized service" });
  }
  return next();
}

app.get("/health", (_req, res) => {
  return res.json({ ok: true, service: "campus-service" });
});

app.get("/internal/students", requireInternalToken, (_req, res) => {
  const items = listStudents().map((item) => ({
    ...item,
    officialPhotoUrl: officialPhotoUrl(item.nim)
  }));
  return res.json({ ok: true, items });
});

app.get("/internal/students/:nim", requireInternalToken, (req, res) => {
  const nim = String(req.params.nim || "").trim();
  const student = getStudent(nim);
  if (!student) {
    return res.status(404).json({ ok: false, reason: "Student not found" });
  }
  return res.json({
    ok: true,
    student: {
      ...student,
      officialPhotoUrl: officialPhotoUrl(student.nim)
    }
  });
});

app.post("/internal/auth/student-login", requireInternalToken, async (req, res) => {
  const nim = String(req.body?.nim || "").trim();
  const password = String(req.body?.password || "");
  if (!nim || !password) {
    return res.status(400).json({ ok: false, reason: "NIM dan password wajib" });
  }
  const student = await verifyStudentCredentials(nim, password);
  if (!student) {
    return res.status(401).json({ ok: false, reason: "NIM atau password salah" });
  }
  return res.json({
    ok: true,
    student: {
      ...student,
      officialPhotoUrl: officialPhotoUrl(student.nim)
    }
  });
});

app.post("/internal/students/:nim/change-password", requireInternalToken, async (req, res) => {
  const nim = String(req.params.nim || "").trim();
  const newPassword = String(req.body?.newPassword || "");
  if (!nim || newPassword.length < 8) {
    return res.status(400).json({ ok: false, reason: "Password minimal 8 karakter" });
  }
  const changed = await changeStudentPassword(nim, newPassword);
  if (!changed) {
    return res.status(404).json({ ok: false, reason: "Student not found" });
  }
  return res.json({ ok: true });
});

app.use((err, _req, res, _next) => {
  logger.error({ err }, "unhandled error");
  if (res.headersSent) return;
  res.status(500).json({ ok: false, reason: "Internal server error" });
});

app.listen(PORT, () => {
  logger.info(`Campus service running on http://localhost:${PORT}`);
});
