import fs from "node:fs";
import path from "node:path";
import multer from "multer";
import { CANDIDATE_UPLOAD_DIR, UPLOAD_DIR } from "./config";

if (!fs.existsSync(UPLOAD_DIR)) {
  fs.mkdirSync(UPLOAD_DIR, { recursive: true });
}
if (!fs.existsSync(CANDIDATE_UPLOAD_DIR)) {
  fs.mkdirSync(CANDIDATE_UPLOAD_DIR, { recursive: true });
}

export const upload = multer({
  storage: multer.diskStorage({
    destination: (_req, _file, cb) => cb(null, UPLOAD_DIR),
    filename: (_req, file, cb) => {
      const ext = path.extname(file.originalname) || ".bin";
      const safeName = `${Date.now()}-${Math.random().toString(16).slice(2)}${ext}`;
      cb(null, safeName);
    },
  }),
  limits: { fileSize: 5 * 1024 * 1024 },
});

export const candidateUpload = multer({
  storage: multer.diskStorage({
    destination: (_req, _file, cb) => cb(null, CANDIDATE_UPLOAD_DIR),
    filename: (_req, file, cb) => {
      const ext = path.extname(file.originalname) || ".jpg";
      const safeName = `${Date.now()}-${Math.random().toString(16).slice(2)}${ext}`;
      cb(null, safeName);
    },
  }),
  limits: { fileSize: 5 * 1024 * 1024 },
});

export function toPublicPath(filePath?: string | null) {
  if (!filePath) return null;
  const normalized = filePath.replace(/\\/g, "/");
  return normalized.startsWith("/") ? normalized : `/${normalized}`;
}
