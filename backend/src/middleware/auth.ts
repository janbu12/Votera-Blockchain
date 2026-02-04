import type express from "express";
import jwt from "jsonwebtoken";
import { ADMIN_JWT_SECRET, JWT_SECRET } from "../config";

export type AuthRequest = express.Request & {
  user?: { id: number; nim: string };
};

export type AdminRequest = express.Request & {
  admin?: { id: number; username: string; role: string };
};

export function requireAuth(
  req: AuthRequest,
  res: express.Response,
  next: express.NextFunction
) {
  const header = req.headers.authorization;
  if (!header) return res.status(401).json({ ok: false, reason: "Unauthorized" });
  const [, token] = header.split(" ");
  if (!token) return res.status(401).json({ ok: false, reason: "Unauthorized" });

  try {
    const payload = jwt.verify(token, JWT_SECRET) as jwt.JwtPayload;
    const sub = payload.sub;
    const nim = (payload as { nim?: string }).nim;

    if ((typeof sub !== "string" && typeof sub !== "number") || typeof nim !== "string") {
      return res.status(401).json({ ok: false, reason: "Invalid token" });
    }

    const id = typeof sub === "number" ? sub : Number(sub);
    if (!Number.isFinite(id)) {
      return res.status(401).json({ ok: false, reason: "Invalid token" });
    }

    req.user = { id, nim };
    return next();
  } catch {
    return res.status(401).json({ ok: false, reason: "Invalid token" });
  }
}

export function requireAdmin(
  req: AdminRequest,
  res: express.Response,
  next: express.NextFunction
) {
  const header = req.headers.authorization;
  if (!header) return res.status(401).json({ ok: false, reason: "Unauthorized" });
  const [, token] = header.split(" ");
  if (!token) return res.status(401).json({ ok: false, reason: "Unauthorized" });

  try {
    const payload = jwt.verify(token, ADMIN_JWT_SECRET) as jwt.JwtPayload;
    const role = (payload as { role?: string }).role;
    if (!role || (role !== "admin" && role !== "superadmin")) {
      return res.status(401).json({ ok: false, reason: "Unauthorized" });
    }
    const username = String(payload.sub ?? "");
    const idValue = Number((payload as { id?: number }).id ?? 0);
    req.admin = { id: idValue, username, role };
    return next();
  } catch {
    return res.status(401).json({ ok: false, reason: "Unauthorized" });
  }
}

export function requireSuperadmin(
  req: AdminRequest,
  res: express.Response,
  next: express.NextFunction
) {
  if (!req.admin || req.admin.role !== "superadmin") {
    return res.status(403).json({ ok: false, reason: "Superadmin diperlukan" });
  }
  return next();
}
