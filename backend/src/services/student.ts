import type express from "express";
import { prisma } from "../db";
import { REQUIRE_STUDENT_VERIFICATION } from "../config";
import type { AuthRequest } from "../middleware/auth";

export async function ensureVerifiedStudent(req: AuthRequest, res: express.Response) {
  if (!REQUIRE_STUDENT_VERIFICATION) return true;
  const student = await prisma.student.findUnique({
    where: { id: req.user!.id },
    select: { verificationStatus: true },
  });
  if (!student || student.verificationStatus !== "VERIFIED") {
    res.status(403).json({ ok: false, reason: "Akun belum terverifikasi" });
    return false;
  }
  return true;
}
