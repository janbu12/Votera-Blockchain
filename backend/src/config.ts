import "dotenv/config";
import path from "node:path";

export const JWT_SECRET = process.env.JWT_SECRET || "dev-secret-change-me";
export const ADMIN_JWT_SECRET = process.env.ADMIN_JWT_SECRET || JWT_SECRET;
export const SIGNER_PRIVATE_KEY = process.env.SIGNER_PRIVATE_KEY;
export const VOTING_CONTRACT_ADDRESS = process.env.VOTING_CONTRACT_ADDRESS;
export const RPC_URL = process.env.RPC_URL || "http://127.0.0.1:8545";
export const ADMIN_USERNAME = process.env.ADMIN_USERNAME || "admin";
export const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || "";
export const SUPERADMIN_USERNAME = process.env.SUPERADMIN_USERNAME || "superadmin";
export const SUPERADMIN_PASSWORD = process.env.SUPERADMIN_PASSWORD || "";
export const REQUIRE_STUDENT_VERIFICATION =
  (process.env.REQUIRE_STUDENT_VERIFICATION ?? "false").toLowerCase() === "true";
export const UPLOAD_DIR =
  process.env.UPLOAD_DIR || path.join(process.cwd(), "uploads", "verification");
export const CANDIDATE_UPLOAD_DIR =
  process.env.CANDIDATE_UPLOAD_DIR ||
  path.join(process.cwd(), "uploads", "candidates");
export const CAMPUS_SERVICE_URL =
  process.env.CAMPUS_SERVICE_URL || "http://localhost:4100";
export const CAMPUS_SERVICE_TOKEN =
  process.env.CAMPUS_SERVICE_TOKEN || "change-this-campus-token";
export const CAMPUS_SERVICE_TIMEOUT_MS = Math.max(
  1000,
  Number(process.env.CAMPUS_SERVICE_TIMEOUT_MS ?? "8000")
);
export const FACE_PROVIDER_MODE = (process.env.FACE_PROVIDER_MODE ?? "mock").toLowerCase();
export const FACE_PROVIDER_TIMEOUT_MS = Math.max(
  1000,
  Number(process.env.FACE_PROVIDER_TIMEOUT_MS ?? "10000")
);
export const FACE_MATCH_THRESHOLD = Math.max(
  0.1,
  Math.min(1, Number(process.env.FACE_MATCH_THRESHOLD ?? "0.82"))
);
export const FACE_SERVICE_URL =
  process.env.FACE_SERVICE_URL || "http://localhost:4200";
export const FACE_SERVICE_TOKEN =
  process.env.FACE_SERVICE_TOKEN || "change-this-face-token";

export const AUTO_CLOSE_ENABLED =
  (process.env.AUTO_CLOSE_ENABLED ?? "true").toLowerCase() === "true";
export const AUTO_CLOSE_INTERVAL_MS = Math.max(
  2000,
  Number(process.env.AUTO_CLOSE_INTERVAL_MS ?? "10000")
);
export const AUTO_MINE =
  (process.env.AUTO_MINE ?? "false").toLowerCase() === "true";
