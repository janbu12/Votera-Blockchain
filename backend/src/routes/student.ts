import express from "express";
import jwt from "jsonwebtoken";
import bcrypt from "bcryptjs";
import { encodePacked, keccak256 } from "viem";
import { prisma } from "../db";
import {
  JWT_SECRET,
  VOTING_CONTRACT_ADDRESS,
} from "../config";
import { VOTING_READ_ABI, VOTING_WRITE_ABI, VOTING_ADMIN_ABI } from "../abi";
import { publicClient, walletClient, signerAccount } from "../blockchain";
import { upload, toPublicPath } from "../uploads";
import { requireAuth, AuthRequest } from "../middleware/auth";
import { ensureVerifiedStudent } from "../services/student";
import {
  campusChangePassword,
  campusGetStudent,
  campusLogin,
} from "../services/campus";
import logger from "../logger";

const router = express.Router();
const paramValue = (value: string | string[]) => (Array.isArray(value) ? value[0] : value);

router.post("/auth/login", async (req, res) => {
  const nim = String(req.body?.nim ?? "").trim();
  const password = String(req.body?.password ?? "");

  if (!nim || !password) {
    return res.status(400).json({ ok: false, reason: "NIM dan password wajib diisi" });
  }

  let campusStudent;
  try {
    campusStudent = await campusLogin(nim, password);
  } catch (err) {
    logger.error({ err, nim }, "student login campus-service failed");
    const reason =
      err instanceof Error ? err.message : "Campus service tidak tersedia";
    return res.status(503).json({ ok: false, reason });
  }

  if (!campusStudent) {
    return res.status(401).json({ ok: false, reason: "NIM atau password salah" });
  }

  const fallbackPasswordHash = await bcrypt.hash(
    `${nim}:${Date.now().toString()}:${Math.random().toString(16).slice(2)}`,
    10
  );
  const student = await prisma.student.upsert({
    where: { nim },
    update: {},
    create: {
      nim,
      passwordHash: fallbackPasswordHash,
      mustChangePassword: true,
    },
    select: {
      id: true,
      nim: true,
      mustChangePassword: true,
    },
  });

  const token = jwt.sign({ sub: student.id, nim: student.nim }, JWT_SECRET, {
    expiresIn: "7d",
  });

  return res.json({
    ok: true,
    token,
    mustChangePassword: student.mustChangePassword,
    campusStudent: {
      name: campusStudent.name,
      officialPhotoUrl: campusStudent.officialPhotoUrl,
    },
  });
});

router.get("/auth/me", requireAuth, async (req: AuthRequest, res) => {
  const student = await prisma.student.findUnique({
    where: { id: req.user!.id },
    select: {
      nim: true,
      mustChangePassword: true,
      verificationStatus: true,
    },
  });
  if (!student) {
    return res.status(404).json({ ok: false, reason: "Not found" });
  }
  let campusStudent = null;
  try {
    campusStudent = await campusGetStudent(student.nim);
  } catch {
    campusStudent = null;
  }
  return res.json({
    ok: true,
    ...student,
    campusName: campusStudent?.name ?? null,
    campusOfficialPhotoUrl: campusStudent?.officialPhotoUrl ?? null,
  });
});

router.post("/auth/change-password", requireAuth, async (req: AuthRequest, res) => {
  if (!(await ensureVerifiedStudent(req, res))) return;
  const newPassword = String(req.body?.newPassword ?? "");
  if (newPassword.length < 8) {
    return res.status(400).json({ ok: false, reason: "Password minimal 8 karakter" });
  }

  try {
    await campusChangePassword(req.user!.nim, newPassword);
  } catch (err) {
    logger.error({ err, nim: req.user?.nim }, "student change-password campus-service failed");
    const reason =
      err instanceof Error ? err.message : "Gagal sinkron password ke kampus";
    return res.status(503).json({ ok: false, reason });
  }

  const hash = await bcrypt.hash(newPassword, 10);
  await prisma.student.update({
    where: { id: req.user!.id },
    data: { passwordHash: hash, mustChangePassword: false },
  });

  return res.json({ ok: true });
});

router.post("/auth/vote-signature", requireAuth, async (req: AuthRequest, res) => {
  if (!signerAccount || !VOTING_CONTRACT_ADDRESS) {
    return res.status(500).json({ ok: false, reason: "Signer not configured" });
  }
  if (!(await ensureVerifiedStudent(req, res))) return;

  const electionIdRaw = req.body?.electionId;
  const voterAddress = String(req.body?.voterAddress ?? "").trim();

  if (!electionIdRaw || !voterAddress) {
    return res.status(400).json({ ok: false, reason: "Invalid payload" });
  }
  if (!voterAddress.startsWith("0x") || voterAddress.length !== 42) {
    return res.status(400).json({ ok: false, reason: "Invalid voter address" });
  }

  let electionId: bigint;
  try {
    electionId = BigInt(electionIdRaw);
  } catch {
    return res.status(400).json({ ok: false, reason: "Invalid electionId" });
  }

  const nimHash = keccak256(new TextEncoder().encode(req.user!.nim));

  try {
    const alreadyVoted = await publicClient.readContract({
      address: VOTING_CONTRACT_ADDRESS as `0x${string}`,
      abi: VOTING_READ_ABI,
      functionName: "hasVotedNim",
      args: [electionId, nimHash],
    });
    if (alreadyVoted) {
      return res.status(409).json({ ok: false, reason: "NIM sudah voting" });
    }
  } catch {
    return res.status(500).json({ ok: false, reason: "Gagal cek status vote" });
  }
  const deadline = Math.floor(Date.now() / 1000) + 5 * 60;

  const messageHash = keccak256(
    encodePacked(
      ["address", "uint256", "address", "bytes32", "uint256"],
      [
        VOTING_CONTRACT_ADDRESS as `0x${string}`,
        electionId,
        voterAddress as `0x${string}`,
        nimHash,
        BigInt(deadline),
      ]
    )
  );

  const signature = await signerAccount.signMessage({
    message: { raw: messageHash },
  });

  return res.json({ ok: true, nimHash, deadline, signature });
});

router.post("/auth/vote-relay", requireAuth, async (req: AuthRequest, res) => {
  if (!walletClient || !VOTING_CONTRACT_ADDRESS) {
    return res.status(500).json({ ok: false, reason: "Relayer not configured" });
  }
  if (!(await ensureVerifiedStudent(req, res))) return;

  const electionIdRaw = req.body?.electionId;
  const candidateIdRaw = req.body?.candidateId;
  if (!electionIdRaw || !candidateIdRaw) {
    return res.status(400).json({ ok: false, reason: "Invalid payload" });
  }

  let electionId: bigint;
  let candidateId: bigint;
  try {
    electionId = BigInt(electionIdRaw);
    candidateId = BigInt(candidateIdRaw);
  } catch {
    return res.status(400).json({ ok: false, reason: "Invalid id" });
  }

  const nimHash = keccak256(new TextEncoder().encode(req.user!.nim));

  try {
    const alreadyVoted = await publicClient.readContract({
      address: VOTING_CONTRACT_ADDRESS as `0x${string}`,
      abi: VOTING_READ_ABI,
      functionName: "hasVotedNim",
      args: [electionId, nimHash],
    });
    if (alreadyVoted) {
      return res.status(409).json({ ok: false, reason: "NIM sudah voting" });
    }
  } catch {
    return res.status(500).json({ ok: false, reason: "Gagal cek status vote" });
  }

  try {
    const hash = await walletClient.writeContract({
      chain: null,
      address: VOTING_CONTRACT_ADDRESS as `0x${string}`,
      abi: VOTING_WRITE_ABI,
      functionName: "voteByRelayer",
      args: [electionId, candidateId, nimHash],
    });
    await prisma.voteReceipt.upsert({
      where: { studentId_electionId: { studentId: req.user!.id, electionId } },
      update: { candidateId, txHash: hash, mode: "relayer" },
      create: {
        studentId: req.user!.id,
        electionId,
        candidateId,
        txHash: hash,
        mode: "relayer",
      },
    });
    return res.json({ ok: true, hash });
  } catch {
    return res.status(500).json({ ok: false, reason: "Gagal submit vote" });
  }
});

router.post("/auth/vote-log", requireAuth, async (req: AuthRequest, res) => {
  const electionIdRaw = req.body?.electionId;
  const candidateIdRaw = req.body?.candidateId;
  const txHash = String(req.body?.txHash ?? "").trim();
  if (!electionIdRaw || !candidateIdRaw || !txHash) {
    return res.status(400).json({ ok: false, reason: "Invalid payload" });
  }
  let electionId: bigint;
  let candidateId: bigint;
  try {
    electionId = BigInt(electionIdRaw);
    candidateId = BigInt(candidateIdRaw);
  } catch {
    return res.status(400).json({ ok: false, reason: "Invalid id" });
  }
  try {
    await prisma.voteReceipt.upsert({
      where: { studentId_electionId: { studentId: req.user!.id, electionId } },
      update: { candidateId, txHash, mode: "wallet" },
      create: {
        studentId: req.user!.id,
        electionId,
        candidateId,
        txHash,
        mode: "wallet",
      },
    });
    return res.json({ ok: true });
  } catch {
    return res.status(500).json({ ok: false, reason: "Gagal simpan riwayat" });
  }
});

router.get("/auth/vote-history", requireAuth, async (req: AuthRequest, res) => {
  try {
    const items = await prisma.voteReceipt.findMany({
      where: { studentId: req.user!.id },
      orderBy: { createdAt: "desc" },
      select: {
        electionId: true,
        candidateId: true,
        txHash: true,
        mode: true,
        createdAt: true,
      },
    });
    const normalized = items.map((item) => ({
      ...item,
      electionId: item.electionId.toString(),
      candidateId: item.candidateId.toString(),
    }));
    return res.json({ ok: true, items: normalized });
  } catch {
    return res.status(500).json({ ok: false, reason: "Gagal memuat riwayat" });
  }
});

router.post("/auth/vote-status", requireAuth, async (req: AuthRequest, res) => {
  if (!VOTING_CONTRACT_ADDRESS) {
    return res.status(500).json({ ok: false, reason: "Contract not configured" });
  }

  const electionIdRaw = req.body?.electionId;
  if (!electionIdRaw) {
    return res.status(400).json({ ok: false, reason: "Invalid electionId" });
  }

  let electionId: bigint;
  try {
    electionId = BigInt(electionIdRaw);
  } catch {
    return res.status(400).json({ ok: false, reason: "Invalid electionId" });
  }

  const nimHash = keccak256(new TextEncoder().encode(req.user!.nim));

  try {
    const alreadyVoted = await publicClient.readContract({
      address: VOTING_CONTRACT_ADDRESS as `0x${string}`,
      abi: VOTING_READ_ABI,
      functionName: "hasVotedNim",
      args: [electionId, nimHash],
    });
    return res.json({ ok: true, alreadyVoted });
  } catch {
    return res.status(500).json({ ok: false, reason: "Gagal cek status vote" });
  }
});

router.get(
  "/auth/verification/status",
  requireAuth,
  async (req: AuthRequest, res) => {
    const student = await prisma.student.findUnique({
      where: { id: req.user!.id },
      select: {
        nim: true,
        verificationStatus: true,
        verificationRejectReason: true,
        verificationSubmittedAt: true,
        verificationVerifiedAt: true,
        verificationRejectedAt: true,
      },
    });
    if (!student) {
      return res.status(404).json({ ok: false, reason: "Not found" });
    }
    let campusStudent = null;
    try {
      campusStudent = await campusGetStudent(student.nim);
    } catch {
      campusStudent = null;
    }
    return res.json({
      ok: true,
      ...student,
      campusName: campusStudent?.name ?? null,
      campusOfficialPhotoUrl: campusStudent?.officialPhotoUrl ?? null,
    });
  }
);

router.post(
  "/auth/verification/upload",
  requireAuth,
  upload.single("selfie"),
  async (req: AuthRequest, res) => {
    const selfieFile = req.file;
    if (!selfieFile) {
      return res.status(400).json({ ok: false, reason: "Foto selfie wajib diisi" });
    }

    await prisma.student.update({
      where: { id: req.user!.id },
      data: {
        verificationStatus: "PENDING",
        verificationCardPath: null,
        verificationSelfiePath: pathRelative(selfieFile.path),
        verificationSubmittedAt: new Date(),
        verificationVerifiedAt: null,
        verificationRejectedAt: null,
        verificationRejectReason: null,
      },
    });

    return res.json({ ok: true });
  }
);

function pathRelative(filePath: string) {
  return filePath.replace(process.cwd(), "").replace(/^[\\/]/, "");
}

router.get(
  "/auth/candidates/:electionId/:candidateId",
  requireAuth,
  async (req: AuthRequest, res) => {
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
      return res.status(400).json({ ok: false, reason: "Gagal memuat profil kandidat" });
    }
  }
);

router.get(
  "/auth/elections/schedule/:electionId",
  requireAuth,
  async (req: AuthRequest, res) => {
    try {
      if (!VOTING_CONTRACT_ADDRESS) {
        return res.status(500).json({ ok: false, reason: "Contract not configured" });
      }
      const electionId = BigInt(paramValue(req.params.electionId));
      const election = await publicClient.readContract({
        address: VOTING_CONTRACT_ADDRESS as `0x${string}`,
        abi: VOTING_ADMIN_ABI,
        functionName: "getElection",
        args: [electionId],
      });
      const [, isOpen, mode, startTime, endTime] = election;
      const startMs = startTime ? Number(startTime) * 1000 : 0;
      const endMs = endTime ? Number(endTime) * 1000 : 0;
      return res.json({
        ok: true,
        schedule: {
          opensAt: startMs ? new Date(startMs).toISOString() : null,
          closesAt: endMs ? new Date(endMs).toISOString() : null,
          mode: Number(mode),
          isOpen,
        },
      });
    } catch {
      return res.status(400).json({ ok: false, reason: "Gagal memuat jadwal event" });
    }
  }
);

export default router;
