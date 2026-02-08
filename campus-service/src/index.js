import "dotenv/config";
import crypto from "node:crypto";
import fs from "node:fs";
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
function redactUrl(rawUrl) {
  try {
    const url = new URL(rawUrl, "http://localhost");
    if (url.searchParams.has("sig")) {
      url.searchParams.set("sig", "***");
    }
    if (url.searchParams.has("token")) {
      url.searchParams.set("token", "***");
    }
    const query = url.searchParams.toString();
    return `${url.pathname}${query ? `?${query}` : ""}`;
  } catch {
    return rawUrl;
  }
}

app.use((req, res, next) => {
  const startAt = process.hrtime.bigint();
  res.on("finish", () => {
    const elapsedMs = Number(process.hrtime.bigint() - startAt) / 1_000_000;
    logger.info(
      {
        method: req.method,
        path: redactUrl(req.originalUrl || req.url),
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
const SIGNED_URL_SECRET = process.env.SIGNED_URL_SECRET || "change-this-signed-url-secret";
const SIGNED_URL_TTL_SECONDS = Math.max(
  10,
  Number(process.env.SIGNED_URL_TTL_SECONDS || "60")
);
const PORT = Number(process.env.CAMPUS_SERVICE_PORT || "4100");
const PHOTO_EXTENSIONS = [".jpg", ".jpeg", ".png", ".webp", ".bmp", ".svg"];

function resolveOfficialPhotoFile(nim) {
  for (const ext of PHOTO_EXTENSIONS) {
    const filePath = path.join(publicDir, "photos", `${nim}${ext}`);
    if (fs.existsSync(filePath)) {
      return { filePath, ext };
    }
  }
  return null;
}

function officialPhotoUrl(nim) {
  const resolved = resolveOfficialPhotoFile(nim);
  return `${PUBLIC_BASE}/photos/${nim}${resolved?.ext ?? ".png"}`;
}

function signPhotoToken(nim, exp) {
  return crypto
    .createHmac("sha256", SIGNED_URL_SECRET)
    .update(`${nim}:${exp}`)
    .digest("hex");
}

function signedOfficialPhotoUrl(nim) {
  const exp = Math.floor(Date.now() / 1000) + SIGNED_URL_TTL_SECONDS;
  const sig = signPhotoToken(nim, exp);
  return {
    referenceUrl: `${PUBLIC_BASE}/internal/photos/${encodeURIComponent(
      nim
    )}?exp=${exp}&sig=${sig}`,
    expiresAt: new Date(exp * 1000).toISOString(),
  };
}

function requireInternalToken(req, res, next) {
  const token = req.headers["x-campus-service-token"];
  if (typeof token !== "string" || token !== SERVICE_TOKEN) {
    return res.status(403).json({ ok: false, reason: "Unauthorized service" });
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

app.get("/internal/students/:nim/face-reference", requireInternalToken, (req, res) => {
  const nim = String(req.params.nim || "").trim();
  const student = getStudent(nim);
  if (!student) {
    return res.status(404).json({ ok: false, reason: "Student not found" });
  }
  if (!resolveOfficialPhotoFile(nim)) {
    return res.status(404).json({ ok: false, reason: "Official photo not found" });
  }
  const signed = signedOfficialPhotoUrl(nim);
  return res.json({
    ok: true,
    nim: student.nim,
    studentId: student.nim,
    referenceUrl: signed.referenceUrl,
    expiresAt: signed.expiresAt,
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

app.get("/internal/photos/:nim", (req, res) => {
  const nim = String(req.params.nim || "").trim();
  const expRaw = String(req.query.exp || "");
  const sig = String(req.query.sig || "");
  const exp = Number(expRaw);

  if (!nim || !expRaw || !sig || !Number.isFinite(exp)) {
    return res.status(403).json({ ok: false, reason: "Invalid signed URL" });
  }
  if (!/^[a-f0-9]{64}$/i.test(sig)) {
    return res.status(403).json({ ok: false, reason: "Invalid signature" });
  }
  if (Math.floor(Date.now() / 1000) > exp) {
    return res.status(410).json({ ok: false, reason: "Signed URL expired" });
  }
  const expected = signPhotoToken(nim, exp);
  const providedBuffer = Buffer.from(sig, "hex");
  const expectedBuffer = Buffer.from(expected, "hex");
  if (
    providedBuffer.length !== expectedBuffer.length ||
    !crypto.timingSafeEqual(providedBuffer, expectedBuffer)
  ) {
    return res.status(403).json({ ok: false, reason: "Invalid signature" });
  }
  const resolvedPhoto = resolveOfficialPhotoFile(nim);
  if (!resolvedPhoto) {
    return res.status(404).json({ ok: false, reason: "Official photo not found" });
  }
  return res.sendFile(resolvedPhoto.filePath);
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
