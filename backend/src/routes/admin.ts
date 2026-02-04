import express from "express";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import path from "node:path";
import { formatEther } from "viem";
import * as XLSX from "xlsx";
import { prisma } from "../db";
import {
  ADMIN_JWT_SECRET,
  RPC_URL,
  VOTING_CONTRACT_ADDRESS,
} from "../config";
import { VOTING_ADMIN_ABI } from "../abi";
import { publicClient, signerAccount, walletClient } from "../blockchain";
import { candidateUpload, toPublicPath } from "../uploads";
import { requireAdmin, requireSuperadmin, AdminRequest } from "../middleware/auth";
import { logAdminAction } from "../services/admin";
import {
  toCsvRow,
  markElectionOpened,
  isElectionLocked,
  fetchElectionSnapshot,
} from "../services/election";

const router = express.Router();
const paramValue = (value: string | string[]) => (Array.isArray(value) ? value[0] : value);

router.post("/admin/login", async (req, res) => {
  const username = String(req.body?.username ?? "").trim();
  const password = String(req.body?.password ?? "");

  const admin = await prisma.adminUser.findUnique({
    where: { username },
  });
  if (!admin || !admin.isActive) {
    return res.status(401).json({ ok: false, reason: "Username atau password salah" });
  }
  const isValid = await bcrypt.compare(password, admin.passwordHash);
  if (!isValid) {
    return res.status(401).json({ ok: false, reason: "Username atau password salah" });
  }

  const token = jwt.sign(
    { sub: admin.username, role: admin.role, id: admin.id },
    ADMIN_JWT_SECRET,
    { expiresIn: "7d" }
  );

  return res.json({ ok: true, token, role: admin.role });
});

router.get("/admin/me", requireAdmin, (req: AdminRequest, res) => {
  return res.json({
    ok: true,
    username: req.admin?.username ?? "admin",
    role: req.admin?.role ?? "admin",
  });
});

router.get("/admin/users", requireAdmin, requireSuperadmin, async (_req, res) => {
  const users = await prisma.adminUser.findMany({
    orderBy: { createdAt: "desc" },
    select: { id: true, username: true, role: true, isActive: true, createdAt: true },
  });
  return res.json({ ok: true, users });
});

router.post("/admin/users", requireAdmin, requireSuperadmin, async (req, res) => {
  try {
    const username = String(req.body?.username ?? "").trim();
    const password = String(req.body?.password ?? "");
    const role = String(req.body?.role ?? "admin");
    if (!username || !password) {
      return res.status(400).json({ ok: false, reason: "Username/password wajib" });
    }
    if (role !== "admin" && role !== "superadmin") {
      return res.status(400).json({ ok: false, reason: "Role tidak valid" });
    }
    const hash = await bcrypt.hash(password, 10);
    const user = await prisma.adminUser.create({
      data: { username, passwordHash: hash, role },
    });
    await logAdminAction(req, "admin.create", { username, role });
    return res.json({
      ok: true,
      user: { id: user.id, username: user.username, role: user.role, isActive: user.isActive },
    });
  } catch (err) {
    console.error("admin create failed", err);
    return res.status(400).json({ ok: false, reason: "Gagal membuat admin" });
  }
});

router.post(
  "/admin/users/:id/reset-password",
  requireAdmin,
  requireSuperadmin,
  async (req: AdminRequest, res) => {
    try {
      const id = Number(req.params.id);
      const password = String(req.body?.password ?? "");
      if (!password) {
        return res.status(400).json({ ok: false, reason: "Password wajib" });
      }
      const hash = await bcrypt.hash(password, 10);
      const user = await prisma.adminUser.update({
        where: { id },
        data: { passwordHash: hash },
      });
      await logAdminAction(req, "admin.reset", { username: user.username });
      return res.json({ ok: true });
    } catch (err) {
      console.error("admin reset failed", err);
      return res.status(400).json({ ok: false, reason: "Gagal reset password" });
    }
  }
);

router.post(
  "/admin/users/:id/toggle",
  requireAdmin,
  requireSuperadmin,
  async (req: AdminRequest, res) => {
    try {
      const id = Number(req.params.id);
      const user = await prisma.adminUser.findUnique({ where: { id } });
      if (!user) return res.status(404).json({ ok: false, reason: "Not found" });
      if (user.role === "superadmin" && user.isActive) {
        return res
          .status(400)
          .json({ ok: false, reason: "Superadmin tidak bisa dinonaktifkan" });
      }
      const updated = await prisma.adminUser.update({
        where: { id },
        data: { isActive: !user.isActive },
      });
      await logAdminAction(req, "admin.toggle", {
        username: updated.username,
        isActive: updated.isActive,
      });
      return res.json({ ok: true, isActive: updated.isActive });
    } catch (err) {
      console.error("admin toggle failed", err);
      return res.status(400).json({ ok: false, reason: "Gagal ubah status admin" });
    }
  }
);

router.get("/admin/verifications", requireAdmin, async (req, res) => {
  const status = String(req.query.status ?? "PENDING").toUpperCase();
  const rows = await prisma.student.findMany({
    where: {
      verificationStatus: status === "ALL" ? undefined : (status as any),
    },
    select: {
      id: true,
      nim: true,
      verificationStatus: true,
      verificationSubmittedAt: true,
      verificationCardPath: true,
      verificationSelfiePath: true,
      verificationRejectReason: true,
    },
    orderBy: { verificationSubmittedAt: "desc" },
  });
  return res.json({ ok: true, items: rows });
});

router.get("/admin/stats", requireAdmin, async (_req, res) => {
  try {
    const [verifiedCount, totalStudents, votedStudents] = await Promise.all([
      prisma.student.count({
        where: { verificationStatus: "VERIFIED" },
      }),
      prisma.student.count(),
      prisma.voteReceipt.findMany({
        select: { studentId: true },
        distinct: ["studentId"],
      }),
    ]);

    return res.json({
      ok: true,
      stats: {
        verifiedCount,
        totalStudents,
        votedCount: votedStudents.length,
      },
    });
  } catch (err) {
    console.error("admin stats failed", err);
    return res.status(500).json({ ok: false, reason: "Gagal memuat statistik" });
  }
});

router.get("/admin/voters/:electionId", requireAdmin, async (req: AdminRequest, res) => {
  try {
    const electionId = BigInt(paramValue(req.params.electionId));
    const receipts = await prisma.voteReceipt.findMany({
      where: { electionId },
      include: { student: { select: { nim: true } } },
      orderBy: { createdAt: "desc" },
    });
    const unique = new Map<string, string>();
    for (const item of receipts) {
      if (!item.student?.nim) continue;
      if (!unique.has(item.student.nim)) {
        unique.set(item.student.nim, item.createdAt.toISOString());
      }
    }
    const voters = Array.from(unique.entries()).map(([nim, votedAt]) => ({
      nim,
      votedAt,
    }));
    return res.json({
      ok: true,
      electionId: electionId.toString(),
      count: voters.length,
      voters,
    });
  } catch (err) {
    console.error("admin voters failed", err);
    return res.status(400).json({ ok: false, reason: "Gagal memuat daftar pemilih" });
  }
});

router.post("/admin/candidates/profile", requireAdmin, async (req, res) => {
  try {
    const electionId = BigInt(req.body?.electionId);
    const candidateId = BigInt(req.body?.candidateId);
    if (await isElectionLocked(electionId)) {
      return res.status(400).json({
        ok: false,
        reason: "Event sudah terkunci. Perubahan kandidat tidak diizinkan.",
      });
    }
    const payload = {
      tagline: String(req.body?.tagline ?? "").trim() || null,
      about: String(req.body?.about ?? "").trim() || null,
      visi: String(req.body?.visi ?? "").trim() || null,
      misi: String(req.body?.misi ?? "").trim() || null,
      programKerja: String(req.body?.programKerja ?? "").trim() || null,
    };
    const profile = await prisma.candidateProfile.upsert({
      where: { electionId_candidateId: { electionId, candidateId } },
      update: payload,
      create: { electionId, candidateId, ...payload },
    });
    await logAdminAction(req, "candidate.profile", {
      electionId: electionId.toString(),
      candidateId: candidateId.toString(),
    });
    return res.json({
      ok: true,
      profile: {
        electionId: profile.electionId.toString(),
        candidateId: profile.candidateId.toString(),
        tagline: profile.tagline,
        about: profile.about,
        visi: profile.visi,
        misi: profile.misi,
        programKerja: profile.programKerja,
        photoUrl: toPublicPath(profile.photoPath),
      },
    });
  } catch (err) {
    console.error("candidate profile save failed", err);
    return res.status(400).json({ ok: false, reason: "Gagal menyimpan profil" });
  }
});

router.post(
  "/admin/candidates/photo",
  requireAdmin,
  candidateUpload.single("photo"),
  async (req, res) => {
    try {
      const electionId = BigInt(req.body?.electionId);
      const candidateId = BigInt(req.body?.candidateId);
      if (await isElectionLocked(electionId)) {
        return res.status(400).json({
          ok: false,
          reason: "Event sudah terkunci. Perubahan kandidat tidak diizinkan.",
        });
      }
      if (!req.file) {
        return res.status(400).json({ ok: false, reason: "File tidak ditemukan" });
      }
      const relativePath = path.relative(process.cwd(), req.file.path);
      const profile = await prisma.candidateProfile.upsert({
        where: { electionId_candidateId: { electionId, candidateId } },
        update: { photoPath: relativePath },
        create: { electionId, candidateId, photoPath: relativePath },
      });
      await logAdminAction(req, "candidate.photo", {
        electionId: electionId.toString(),
        candidateId: candidateId.toString(),
      });
      return res.json({
        ok: true,
        photoUrl: toPublicPath(profile.photoPath),
      });
    } catch (err) {
      console.error("candidate photo upload failed", err);
      return res.status(400).json({ ok: false, reason: "Gagal upload foto" });
    }
  }
);

router.get(
  "/admin/candidates/profile/:electionId/:candidateId",
  requireAdmin,
  async (req, res) => {
    try {
      const electionId = BigInt(paramValue(req.params.electionId));
      const candidateId = BigInt(paramValue(req.params.candidateId));
      const profile = await prisma.candidateProfile.findUnique({
        where: { electionId_candidateId: { electionId, candidateId } },
      });
      return res.json({
        ok: true,
        profile: profile
          ? {
              electionId: profile.electionId.toString(),
              candidateId: profile.candidateId.toString(),
              tagline: profile.tagline,
              about: profile.about,
              visi: profile.visi,
              misi: profile.misi,
              programKerja: profile.programKerja,
              photoUrl: toPublicPath(profile.photoPath),
            }
          : null,
      });
    } catch {
      return res.status(400).json({ ok: false, reason: "Gagal memuat profil" });
    }
  }
);

router.post("/admin/elections/schedule", requireAdmin, async (req, res) => {
  if (!walletClient || !VOTING_CONTRACT_ADDRESS) {
    return res.status(500).json({ ok: false, reason: "Relayer not configured" });
  }
  try {
    const electionId = BigInt(req.body?.electionId);
    const mode = String(req.body?.mode ?? "manual").toLowerCase();
    const opensAtRaw = req.body?.opensAt;
    const closesAtRaw = req.body?.closesAt;

    if (mode === "scheduled") {
      if (!opensAtRaw || !closesAtRaw) {
        return res.status(400).json({ ok: false, reason: "Jadwal wajib diisi" });
      }
      const opensAt = new Date(opensAtRaw);
      const closesAt = new Date(closesAtRaw);
      if (Number.isNaN(opensAt.getTime())) {
        return res.status(400).json({ ok: false, reason: "Format tanggal buka tidak valid" });
      }
      if (Number.isNaN(closesAt.getTime())) {
        return res.status(400).json({ ok: false, reason: "Format tanggal tutup tidak valid" });
      }
      const startTime = BigInt(Math.floor(opensAt.getTime() / 1000));
      const endTime = BigInt(Math.floor(closesAt.getTime() / 1000));

      const scheduleHash = await walletClient.writeContract({
        chain: null,
        address: VOTING_CONTRACT_ADDRESS as `0x${string}`,
        abi: VOTING_ADMIN_ABI,
        functionName: "setElectionSchedule",
        args: [electionId, startTime, endTime],
      });
      const modeHash = await walletClient.writeContract({
        chain: null,
        address: VOTING_CONTRACT_ADDRESS as `0x${string}`,
        abi: VOTING_ADMIN_ABI,
        functionName: "setElectionMode",
        args: [electionId, 1],
      });
      await logAdminAction(req, "election.schedule", {
        electionId: electionId.toString(),
        opensAt: opensAt.toISOString(),
        closesAt: closesAt.toISOString(),
      });
      return res.json({
        ok: true,
        hashes: [scheduleHash, modeHash],
      });
    }
    await logAdminAction(req, "election.schedule", {
      electionId: electionId.toString(),
      mode: "manual",
    });
    return res.json({ ok: true, mode: "manual" });
  } catch (err) {
    console.error("schedule save failed", err);
    return res.status(400).json({ ok: false, reason: "Gagal menyimpan jadwal" });
  }
});

router.get("/admin/elections/state/:electionId", requireAdmin, async (req, res) => {
  try {
    const electionId = BigInt(paramValue(req.params.electionId));
    const state = await prisma.electionState.findUnique({
      where: { electionId },
    });
    return res.json({
      ok: true,
      state: {
        electionId: electionId.toString(),
        openedOnce: state?.openedOnce ?? false,
        openedAt: state?.openedAt ? state.openedAt.toISOString() : null,
      },
    });
  } catch (err) {
    console.error("election state failed", err);
    return res.status(400).json({ ok: false, reason: "Gagal memuat status" });
  }
});

router.get("/admin/audit", requireAdmin, async (req: AdminRequest, res) => {
  try {
    const limitRaw = Number(req.query.limit ?? 50);
    const offsetRaw = Number(req.query.offset ?? 0);
    const take = Number.isFinite(limitRaw) ? Math.min(Math.max(limitRaw, 1), 200) : 50;
    const skip = Number.isFinite(offsetRaw) ? Math.max(offsetRaw, 0) : 0;
    const items = await prisma.adminAuditLog.findMany({
      orderBy: { createdAt: "desc" },
      take,
      skip,
    });
    return res.json({ ok: true, items });
  } catch (err) {
    console.error("audit log failed", err);
    return res.status(500).json({ ok: false, reason: "Gagal memuat audit log" });
  }
});

router.get("/admin/audit/summary", requireAdmin, async (_req: AdminRequest, res) => {
  try {
    const since = new Date();
    since.setDate(since.getDate() - 30);
    const logs = await prisma.adminAuditLog.findMany({
      where: { createdAt: { gte: since } },
      select: { adminUsername: true, action: true, createdAt: true },
    });

    const adminMap = new Map<string, number>();
    const dayMap = new Map<string, number>();
    const actionMap = new Map<string, number>();

    for (const log of logs) {
      adminMap.set(log.adminUsername, (adminMap.get(log.adminUsername) ?? 0) + 1);
      const dayKey = log.createdAt.toISOString().slice(0, 10);
      dayMap.set(dayKey, (dayMap.get(dayKey) ?? 0) + 1);
      actionMap.set(log.action, (actionMap.get(log.action) ?? 0) + 1);
    }

    const topAdmins = Array.from(adminMap.entries())
      .map(([admin, count]) => ({ admin, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 5);

    const actionsByDay = Array.from(dayMap.entries())
      .map(([day, count]) => ({ day, count }))
      .sort((a, b) => (a.day < b.day ? -1 : 1));

    const actionsByDayFilled = [];
    for (let i = 29; i >= 0; i -= 1) {
      const date = new Date();
      date.setDate(date.getDate() - i);
      const key = date.toISOString().slice(0, 10);
      const count = dayMap.get(key) ?? 0;
      actionsByDayFilled.push({ day: key, count });
    }

    const topActions = Array.from(actionMap.entries())
      .map(([action, count]) => ({ action, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 8);

    return res.json({
      ok: true,
      summary: {
        since: since.toISOString(),
        totalActions: logs.length,
        topAdmins,
        actionsByDay,
        actionsByDayFilled,
        topActions,
      },
    });
  } catch (err) {
    console.error("audit summary failed", err);
    return res.status(500).json({ ok: false, reason: "Gagal memuat ringkasan audit" });
  }
});

router.get("/admin/results/:electionId", requireAdmin, async (req: AdminRequest, res) => {
  try {
    const electionId = BigInt(paramValue(req.params.electionId));
    const result = await prisma.electionResult.findUnique({
      where: { electionId },
    });
    if (!result) {
      return res.json({ ok: true, result: null });
    }
    return res.json({
      ok: true,
      result: {
        electionId: result.electionId.toString(),
        title: result.title,
        totalVotes: result.totalVotes,
        results: result.results,
        snapshotAt: result.snapshotAt.toISOString(),
        published: result.published,
        publishedAt: result.publishedAt ? result.publishedAt.toISOString() : null,
        startTime: result.startTime ? result.startTime.toISOString() : null,
        endTime: result.endTime ? result.endTime.toISOString() : null,
      },
    });
  } catch (err) {
    console.error("admin results load failed", err);
    return res.status(400).json({ ok: false, reason: "Gagal memuat hasil" });
  }
});

router.post(
  "/admin/results/:electionId/finalize",
  requireAdmin,
  async (req: AdminRequest, res) => {
    try {
      const electionId = BigInt(paramValue(req.params.electionId));
      const existing = await prisma.electionResult.findUnique({
        where: { electionId },
        select: { published: true },
      });
      if (existing?.published) {
        return res
          .status(400)
          .json({ ok: false, reason: "Hasil sudah dipublikasikan" });
      }
      const snapshot = await fetchElectionSnapshot(electionId);
      const result = await prisma.electionResult.upsert({
        where: { electionId },
        update: {
          title: snapshot.title,
          totalVotes: snapshot.totalVotes,
          results: snapshot,
          snapshotAt: new Date(),
          startTime: snapshot.startMs ? new Date(snapshot.startMs) : null,
          endTime: snapshot.endMs ? new Date(snapshot.endMs) : null,
        },
        create: {
          electionId,
          title: snapshot.title,
          totalVotes: snapshot.totalVotes,
          results: snapshot,
          snapshotAt: new Date(),
          startTime: snapshot.startMs ? new Date(snapshot.startMs) : null,
          endTime: snapshot.endMs ? new Date(snapshot.endMs) : null,
        },
      });
      await logAdminAction(req, "election.finalize", {
        electionId: electionId.toString(),
        totalVotes: snapshot.totalVotes,
      });
      return res.json({
        ok: true,
        result: {
          electionId: result.electionId.toString(),
          snapshotAt: result.snapshotAt.toISOString(),
          published: result.published,
        },
      });
    } catch (err) {
      console.error("finalize result failed", err);
      return res.status(400).json({ ok: false, reason: "Gagal finalisasi hasil" });
    }
  }
);

router.post(
  "/admin/results/:electionId/publish",
  requireAdmin,
  async (req: AdminRequest, res) => {
    try {
      const electionId = BigInt(paramValue(req.params.electionId));
      const existing = await prisma.electionResult.findUnique({
        where: { electionId },
      });
      if (!existing) {
        return res
          .status(400)
          .json({ ok: false, reason: "Hasil belum difinalisasi" });
      }
      if (existing.published) {
        return res.json({ ok: true, published: true });
      }
      const result = await prisma.electionResult.update({
        where: { electionId },
        data: { published: true, publishedAt: new Date() },
      });
      await logAdminAction(req, "election.publish", {
        electionId: electionId.toString(),
      });
      return res.json({
        ok: true,
        publishedAt: result.publishedAt?.toISOString() ?? null,
      });
    } catch (err) {
      console.error("publish result failed", err);
      return res.status(400).json({ ok: false, reason: "Gagal publish hasil" });
    }
  }
);

router.get("/admin/monitor", requireAdmin, async (_req: AdminRequest, res) => {
  const rpc = {
    url: RPC_URL,
    ok: false,
    chainId: null as number | null,
    blockNumber: null as string | null,
    latencyMs: null as number | null,
    error: null as string | null,
  };
  try {
    const start = Date.now();
    const [chainId, blockNumber] = await Promise.all([
      publicClient.getChainId(),
      publicClient.getBlockNumber(),
    ]);
    rpc.latencyMs = Date.now() - start;
    rpc.ok = true;
    rpc.chainId = chainId;
    rpc.blockNumber = blockNumber.toString();
  } catch (err) {
    rpc.error = err instanceof Error ? err.message : "RPC error";
  }

  const signer = {
    configured: !!signerAccount,
    address: signerAccount?.address ?? null,
    balance: null as string | null,
    balanceEth: null as string | null,
    error: null as string | null,
  };
  if (signerAccount) {
    try {
      const balance = await publicClient.getBalance({ address: signerAccount.address });
      signer.balance = balance.toString();
      signer.balanceEth = formatEther(balance);
    } catch (err) {
      signer.error = err instanceof Error ? err.message : "Signer error";
    }
  }

  return res.json({
    ok: true,
    rpc,
    signer,
    contractAddress: VOTING_CONTRACT_ADDRESS ?? null,
  });
});

router.get(
  "/admin/export/elections/:electionId",
  requireAdmin,
  async (req: AdminRequest, res) => {
    if (!VOTING_CONTRACT_ADDRESS) {
      return res.status(500).json({ ok: false, reason: "Contract not configured" });
    }
    try {
      const electionId = BigInt(paramValue(req.params.electionId));
      const election = await publicClient.readContract({
        address: VOTING_CONTRACT_ADDRESS as `0x${string}`,
        abi: VOTING_ADMIN_ABI,
        functionName: "getElection",
        args: [electionId],
      });
      const [title, , , startTime, endTime, candidatesCount] = election;
      const startMs = startTime ? Number(startTime) * 1000 : 0;
      const endMs = endTime ? Number(endTime) * 1000 : 0;
      const startLocal = startMs ? new Date(startMs).toLocaleString("id-ID") : "";
      const endLocal = endMs ? new Date(endMs).toLocaleString("id-ID") : "";
      const rows: string[] = [];
      rows.push(
        toCsvRow([
          "electionId",
          "title",
          "candidateId",
          "candidateName",
          "voteCount",
          "startTimeMs",
          "endTimeMs",
          "startTimeLocal",
          "endTimeLocal",
        ])
      );
      const total = Number(candidatesCount ?? 0n);
      for (let i = 1; i <= total; i += 1) {
        const candidate = await publicClient.readContract({
          address: VOTING_CONTRACT_ADDRESS as `0x${string}`,
          abi: VOTING_ADMIN_ABI,
          functionName: "getCandidate",
          args: [electionId, BigInt(i)],
        });
        const [cid, name, voteCount] = candidate;
        rows.push(
          toCsvRow([
            electionId.toString(),
            title,
            cid.toString(),
            name,
            voteCount.toString(),
            startMs || "",
            endMs || "",
            startLocal,
            endLocal,
          ])
        );
      }
      const csv = rows.join("\n");
      const filename = `election-${electionId.toString()}-results.csv`;
      res.setHeader("Content-Type", "text/csv; charset=utf-8");
      res.setHeader("Content-Disposition", `attachment; filename="${filename}"`);
      return res.send(csv);
    } catch (err) {
      console.error("export results failed", err);
      return res.status(400).json({ ok: false, reason: "Gagal export hasil" });
    }
  }
);

router.get(
  "/admin/export/elections/:electionId/xlsx",
  requireAdmin,
  async (req: AdminRequest, res) => {
    if (!VOTING_CONTRACT_ADDRESS) {
      return res.status(500).json({ ok: false, reason: "Contract not configured" });
    }
    try {
      const electionId = BigInt(paramValue(req.params.electionId));
      const election = await publicClient.readContract({
        address: VOTING_CONTRACT_ADDRESS as `0x${string}`,
        abi: VOTING_ADMIN_ABI,
        functionName: "getElection",
        args: [electionId],
      });
      const [title, , , startTime, endTime, candidatesCount] = election;
      const startMs = startTime ? Number(startTime) * 1000 : 0;
      const endMs = endTime ? Number(endTime) * 1000 : 0;
      const startLocal = startMs ? new Date(startMs).toLocaleString("id-ID") : "";
      const endLocal = endMs ? new Date(endMs).toLocaleString("id-ID") : "";
      const total = Number(candidatesCount ?? 0n);
      const rows: Array<Record<string, string>> = [];
      for (let i = 1; i <= total; i += 1) {
        const candidate = await publicClient.readContract({
          address: VOTING_CONTRACT_ADDRESS as `0x${string}`,
          abi: VOTING_ADMIN_ABI,
          functionName: "getCandidate",
          args: [electionId, BigInt(i)],
        });
        const [cid, name, voteCount] = candidate;
        rows.push({
          electionId: electionId.toString(),
          title,
          candidateId: cid.toString(),
          candidateName: name,
          voteCount: voteCount.toString(),
          startTimeMs: startMs ? String(startMs) : "",
          endTimeMs: endMs ? String(endMs) : "",
          startTimeLocal: startLocal,
          endTimeLocal: endLocal,
        });
      }

      const worksheet = XLSX.utils.json_to_sheet(rows);
      const workbook = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(workbook, worksheet, "Hasil");
      const buffer = XLSX.write(workbook, { type: "buffer", bookType: "xlsx" });
      const filename = `election-${electionId.toString()}-results.xlsx`;
      res.setHeader(
        "Content-Type",
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
      );
      res.setHeader("Content-Disposition", `attachment; filename="${filename}"`);
      return res.send(Buffer.from(buffer));
    } catch (err) {
      console.error("export excel failed", err);
      return res.status(400).json({ ok: false, reason: "Gagal export hasil" });
    }
  }
);

router.post("/admin/verifications/:id/approve", requireAdmin, async (req, res) => {
  const id = Number(req.params.id);
  if (!Number.isFinite(id)) {
    return res.status(400).json({ ok: false, reason: "Invalid id" });
  }
  const student = await prisma.student.findUnique({
    where: { id },
    select: {
      verificationStatus: true,
      verificationCardPath: true,
      verificationSelfiePath: true,
    },
  });
  if (!student) {
    return res.status(404).json({ ok: false, reason: "Not found" });
  }
  if (student.verificationStatus !== "PENDING") {
    return res.status(400).json({ ok: false, reason: "Status harus PENDING" });
  }
  if (!student.verificationCardPath || !student.verificationSelfiePath) {
    return res.status(400).json({ ok: false, reason: "Bukti verifikasi belum lengkap" });
  }
  await prisma.student.update({
    where: { id },
    data: {
      verificationStatus: "VERIFIED",
      verificationVerifiedAt: new Date(),
      verificationRejectedAt: null,
      verificationRejectReason: null,
    },
  });
  await logAdminAction(req, "verification.approve", { studentId: id });
  return res.json({ ok: true });
});

router.post("/admin/verifications/:id/reject", requireAdmin, async (req, res) => {
  const id = Number(req.params.id);
  const reason = String(req.body?.reason ?? "Ditolak").trim();
  if (!Number.isFinite(id)) {
    return res.status(400).json({ ok: false, reason: "Invalid id" });
  }
  const student = await prisma.student.findUnique({
    where: { id },
    select: { verificationStatus: true },
  });
  if (!student) {
    return res.status(404).json({ ok: false, reason: "Not found" });
  }
  if (student.verificationStatus !== "PENDING") {
    return res.status(400).json({ ok: false, reason: "Status harus PENDING" });
  }
  await prisma.student.update({
    where: { id },
    data: {
      verificationStatus: "REJECTED",
      verificationRejectedAt: new Date(),
      verificationRejectReason: reason,
    },
  });
  await logAdminAction(req, "verification.reject", { studentId: id, reason });
  return res.json({ ok: true });
});

router.post("/admin/chain/create-election", requireAdmin, async (req, res) => {
  if (!walletClient || !VOTING_CONTRACT_ADDRESS) {
    return res.status(500).json({ ok: false, reason: "Relayer not configured" });
  }
  const title = String(req.body?.title ?? "").trim();
  if (!title) {
    return res.status(400).json({ ok: false, reason: "Judul wajib diisi" });
  }
  try {
    const hash = await walletClient.writeContract({
      chain: null,
      address: VOTING_CONTRACT_ADDRESS as `0x${string}`,
      abi: VOTING_ADMIN_ABI,
      functionName: "createElection",
      args: [title],
    });
    await logAdminAction(req, "election.create", { title, hash });
    return res.json({ ok: true, hash });
  } catch {
    return res.status(500).json({ ok: false, reason: "Gagal membuat event" });
  }
});

router.post("/admin/chain/open-election", requireAdmin, async (req, res) => {
  if (!walletClient || !VOTING_CONTRACT_ADDRESS) {
    return res.status(500).json({ ok: false, reason: "Relayer not configured" });
  }
  try {
    const electionId = BigInt(req.body?.electionId);
    const hash = await walletClient.writeContract({
      chain: null,
      address: VOTING_CONTRACT_ADDRESS as `0x${string}`,
      abi: VOTING_ADMIN_ABI,
      functionName: "openElection",
      args: [electionId],
    });
    await markElectionOpened(electionId);
    await logAdminAction(req, "election.open", { electionId: electionId.toString(), hash });
    return res.json({ ok: true, hash });
  } catch {
    return res.status(400).json({ ok: false, reason: "Gagal membuka event" });
  }
});

router.post("/admin/chain/close-election", requireAdmin, async (req, res) => {
  if (!walletClient || !VOTING_CONTRACT_ADDRESS) {
    return res.status(500).json({ ok: false, reason: "Relayer not configured" });
  }
  try {
    const electionId = BigInt(req.body?.electionId);
    const hash = await walletClient.writeContract({
      chain: null,
      address: VOTING_CONTRACT_ADDRESS as `0x${string}`,
      abi: VOTING_ADMIN_ABI,
      functionName: "closeElection",
      args: [electionId],
    });
    await logAdminAction(req, "election.close", { electionId: electionId.toString(), hash });
    return res.json({ ok: true, hash });
  } catch {
    return res.status(400).json({ ok: false, reason: "Gagal menutup event" });
  }
});

router.post("/admin/chain/add-candidate", requireAdmin, async (req, res) => {
  if (!walletClient || !VOTING_CONTRACT_ADDRESS) {
    return res.status(500).json({ ok: false, reason: "Relayer not configured" });
  }
  const name = String(req.body?.name ?? "").trim();
  if (!name) {
    return res.status(400).json({ ok: false, reason: "Nama kandidat wajib diisi" });
  }
  try {
    const electionId = BigInt(req.body?.electionId);
    if (await isElectionLocked(electionId)) {
      return res.status(400).json({
        ok: false,
        reason: "Event sudah terkunci. Kandidat tidak dapat ditambah.",
      });
    }
    const hash = await walletClient.writeContract({
      chain: null,
      address: VOTING_CONTRACT_ADDRESS as `0x${string}`,
      abi: VOTING_ADMIN_ABI,
      functionName: "addCandidate",
      args: [electionId, name],
    });
    await logAdminAction(req, "candidate.add", {
      electionId: electionId.toString(),
      name,
      hash,
    });
    return res.json({ ok: true, hash });
  } catch {
    return res.status(400).json({ ok: false, reason: "Gagal menambah kandidat" });
  }
});

router.post("/admin/chain/update-candidate", requireAdmin, async (req, res) => {
  if (!walletClient || !VOTING_CONTRACT_ADDRESS) {
    return res.status(500).json({ ok: false, reason: "Relayer not configured" });
  }
  const name = String(req.body?.name ?? "").trim();
  if (!name) {
    return res.status(400).json({ ok: false, reason: "Nama kandidat wajib diisi" });
  }
  try {
    const electionId = BigInt(req.body?.electionId);
    const candidateId = BigInt(req.body?.candidateId);
    if (await isElectionLocked(electionId)) {
      return res.status(400).json({
        ok: false,
        reason: "Event sudah terkunci. Kandidat tidak dapat diubah.",
      });
    }
    const hash = await walletClient.writeContract({
      chain: null,
      address: VOTING_CONTRACT_ADDRESS as `0x${string}`,
      abi: VOTING_ADMIN_ABI,
      functionName: "updateCandidate",
      args: [electionId, candidateId, name],
    });
    await logAdminAction(req, "candidate.update", {
      electionId: electionId.toString(),
      candidateId: candidateId.toString(),
      name,
      hash,
    });
    return res.json({ ok: true, hash });
  } catch {
    return res.status(400).json({ ok: false, reason: "Gagal update kandidat" });
  }
});

router.post("/admin/chain/hide-candidate", requireAdmin, async (req, res) => {
  if (!walletClient || !VOTING_CONTRACT_ADDRESS) {
    return res.status(500).json({ ok: false, reason: "Relayer not configured" });
  }
  try {
    const electionId = BigInt(req.body?.electionId);
    const candidateId = BigInt(req.body?.candidateId);
    if (await isElectionLocked(electionId)) {
      return res.status(400).json({
        ok: false,
        reason: "Event sudah terkunci. Kandidat tidak dapat disembunyikan.",
      });
    }
    const hash = await walletClient.writeContract({
      chain: null,
      address: VOTING_CONTRACT_ADDRESS as `0x${string}`,
      abi: VOTING_ADMIN_ABI,
      functionName: "hideCandidate",
      args: [electionId, candidateId],
    });
    await logAdminAction(req, "candidate.hide", {
      electionId: electionId.toString(),
      candidateId: candidateId.toString(),
      hash,
    });
    return res.json({ ok: true, hash });
  } catch {
    return res.status(400).json({ ok: false, reason: "Gagal menyembunyikan kandidat" });
  }
});

export default router;
