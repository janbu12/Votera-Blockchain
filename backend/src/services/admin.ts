import bcrypt from "bcryptjs";
import { Prisma } from "@prisma/client";
import { prisma } from "../db";
import {
  ADMIN_PASSWORD,
  ADMIN_USERNAME,
  SUPERADMIN_PASSWORD,
  SUPERADMIN_USERNAME,
} from "../config";
import type { AdminRequest } from "../middleware/auth";

export async function ensureSuperadmin() {
  const usersCount = await prisma.adminUser.count();
  if (SUPERADMIN_PASSWORD) {
    const existing = await prisma.adminUser.findUnique({
      where: { username: SUPERADMIN_USERNAME },
    });
    if (!existing) {
      const hash = await bcrypt.hash(SUPERADMIN_PASSWORD, 10);
      await prisma.adminUser.create({
        data: {
          username: SUPERADMIN_USERNAME,
          passwordHash: hash,
          role: "superadmin",
          isActive: true,
        },
      });
      console.log(`Superadmin bootstrap created: ${SUPERADMIN_USERNAME}`);
    }
  }
  if (usersCount === 0 && ADMIN_PASSWORD) {
    const existingAdmin = await prisma.adminUser.findUnique({
      where: { username: ADMIN_USERNAME },
    });
    if (!existingAdmin) {
      const hash = await bcrypt.hash(ADMIN_PASSWORD, 10);
      await prisma.adminUser.create({
        data: {
          username: ADMIN_USERNAME,
          passwordHash: hash,
          role: "admin",
          isActive: true,
        },
      });
      console.log(`Admin bootstrap created: ${ADMIN_USERNAME}`);
    }
  }
}

export async function logAdminAction(
  req: AdminRequest,
  action: string,
  meta?: Record<string, unknown>
) {
  const username = req.admin?.username ?? "admin";
  const adminId = req.admin?.id ?? null;
  try {
    await prisma.adminAuditLog.create({
      data: {
        adminUsername: username,
        adminId: adminId && adminId > 0 ? adminId : null,
        action,
        meta: meta ? (meta as Prisma.InputJsonValue) : undefined,
      },
    });
  } catch (err) {
    console.error("audit log failed", err);
  }
}
