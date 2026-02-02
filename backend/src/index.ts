import express from "express";
import cors from "cors";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import multer from "multer";
import path from "node:path";
import fs from "node:fs";
import { PrismaClient } from "@prisma/client";
import {
  createPublicClient,
  createWalletClient,
  encodePacked,
  http,
  keccak256,
} from "viem";
import { privateKeyToAccount } from "viem/accounts";

const app = express();
app.use(cors({ origin: "http://localhost:3000" }));
app.use(express.json());

const prisma = new PrismaClient();
const JWT_SECRET = process.env.JWT_SECRET || "dev-secret-change-me";
const ADMIN_JWT_SECRET = process.env.ADMIN_JWT_SECRET || JWT_SECRET;
const SIGNER_PRIVATE_KEY = process.env.SIGNER_PRIVATE_KEY;
const VOTING_CONTRACT_ADDRESS = process.env.VOTING_CONTRACT_ADDRESS;
const RPC_URL = process.env.RPC_URL || "http://127.0.0.1:8545";
const ADMIN_USERNAME = process.env.ADMIN_USERNAME || "admin";
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || "";
const REQUIRE_STUDENT_VERIFICATION =
  (process.env.REQUIRE_STUDENT_VERIFICATION ?? "false").toLowerCase() === "true";
const UPLOAD_DIR =
  process.env.UPLOAD_DIR || path.join(process.cwd(), "uploads", "verification");

if (!SIGNER_PRIVATE_KEY || !VOTING_CONTRACT_ADDRESS) {
  console.warn(
    "Missing SIGNER_PRIVATE_KEY or VOTING_CONTRACT_ADDRESS in env. Signature endpoint will fail."
  );
}

const signerAccount = SIGNER_PRIVATE_KEY
  ? privateKeyToAccount(SIGNER_PRIVATE_KEY as `0x${string}`)
  : null;

const publicClient = createPublicClient({
  transport: http(RPC_URL),
});

const walletClient = signerAccount
  ? createWalletClient({
      account: signerAccount,
      transport: http(RPC_URL),
    })
  : null;

const VOTING_READ_ABI = [
  {
    name: "hasVotedNim",
    type: "function",
    stateMutability: "view",
    inputs: [
      { name: "", type: "uint256" },
      { name: "", type: "bytes32" },
    ],
    outputs: [{ name: "", type: "bool" }],
  },
] as const;

const VOTING_WRITE_ABI = [
  {
    name: "voteByRelayer",
    type: "function",
    stateMutability: "nonpayable",
    inputs: [
      { name: "electionId", type: "uint256" },
      { name: "candidateId", type: "uint256" },
      { name: "nimHash", type: "bytes32" },
    ],
    outputs: [],
  },
] as const;

const VOTING_ADMIN_ABI = [
  {
    name: "createElection",
    type: "function",
    stateMutability: "nonpayable",
    inputs: [{ name: "title", type: "string" }],
    outputs: [{ name: "electionId", type: "uint256" }],
  },
  {
    name: "addCandidate",
    type: "function",
    stateMutability: "nonpayable",
    inputs: [
      { name: "electionId", type: "uint256" },
      { name: "name", type: "string" },
    ],
    outputs: [],
  },
  {
    name: "openElection",
    type: "function",
    stateMutability: "nonpayable",
    inputs: [{ name: "electionId", type: "uint256" }],
    outputs: [],
  },
  {
    name: "closeElection",
    type: "function",
    stateMutability: "nonpayable",
    inputs: [{ name: "electionId", type: "uint256" }],
    outputs: [],
  },
  {
    name: "updateCandidate",
    type: "function",
    stateMutability: "nonpayable",
    inputs: [
      { name: "electionId", type: "uint256" },
      { name: "candidateId", type: "uint256" },
      { name: "name", type: "string" },
    ],
    outputs: [],
  },
  {
    name: "hideCandidate",
    type: "function",
    stateMutability: "nonpayable",
    inputs: [
      { name: "electionId", type: "uint256" },
      { name: "candidateId", type: "uint256" },
    ],
    outputs: [],
  },
] as const;

if (!fs.existsSync(UPLOAD_DIR)) {
  fs.mkdirSync(UPLOAD_DIR, { recursive: true });
}

const upload = multer({
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

type AuthRequest = express.Request & {
  user?: { id: number; nim: string };
};

function requireAuth(req: AuthRequest, res: express.Response, next: express.NextFunction) {
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

function requireAdmin(req: express.Request, res: express.Response, next: express.NextFunction) {
  const header = req.headers.authorization;
  if (!header) return res.status(401).json({ ok: false, reason: "Unauthorized" });
  const [, token] = header.split(" ");
  if (!token) return res.status(401).json({ ok: false, reason: "Unauthorized" });

  try {
    const payload = jwt.verify(token, ADMIN_JWT_SECRET) as jwt.JwtPayload;
    if ((payload as { role?: string }).role !== "admin") {
      return res.status(401).json({ ok: false, reason: "Unauthorized" });
    }
    return next();
  } catch {
    return res.status(401).json({ ok: false, reason: "Unauthorized" });
  }
}

async function ensureVerifiedStudent(req: AuthRequest, res: express.Response) {
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

app.post("/auth/login", async (req, res) => {
  const nim = String(req.body?.nim ?? "").trim();
  const password = String(req.body?.password ?? "");

  if (!nim || !password) {
    return res.status(400).json({ ok: false, reason: "NIM dan password wajib diisi" });
  }

  const student = await prisma.student.findUnique({ where: { nim } });
  if (!student) {
    return res.status(401).json({ ok: false, reason: "NIM atau password salah" });
  }

  const isValid = await bcrypt.compare(password, student.passwordHash);
  if (!isValid) {
    return res.status(401).json({ ok: false, reason: "NIM atau password salah" });
  }

  const token = jwt.sign({ sub: student.id, nim: student.nim }, JWT_SECRET, {
    expiresIn: "7d",
  });

  return res.json({
    ok: true,
    token,
    mustChangePassword: student.mustChangePassword,
  });
});

app.post("/admin/login", async (req, res) => {
  const username = String(req.body?.username ?? "").trim();
  const password = String(req.body?.password ?? "");

  if (!ADMIN_PASSWORD) {
    return res.status(500).json({ ok: false, reason: "Admin not configured" });
  }
  if (username !== ADMIN_USERNAME || password !== ADMIN_PASSWORD) {
    return res.status(401).json({ ok: false, reason: "Username atau password salah" });
  }

  const token = jwt.sign(
    { sub: username, role: "admin" },
    ADMIN_JWT_SECRET,
    { expiresIn: "7d" }
  );

  return res.json({ ok: true, token });
});

app.get("/admin/me", requireAdmin, (_req, res) => {
  return res.json({ ok: true });
});

app.post("/auth/change-password", requireAuth, async (req: AuthRequest, res) => {
  const newPassword = String(req.body?.newPassword ?? "");
  if (newPassword.length < 8) {
    return res.status(400).json({ ok: false, reason: "Password minimal 8 karakter" });
  }

  const passwordHash = await bcrypt.hash(newPassword, 10);
  await prisma.student.update({
    where: { id: req.user!.id },
    data: { passwordHash, mustChangePassword: false },
  });

  return res.json({ ok: true });
});

app.post("/auth/vote-signature", requireAuth, async (req: AuthRequest, res) => {
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

  return res.json({
    ok: true,
    nimHash,
    deadline,
    signature,
  });
});

app.post("/auth/vote-relay", requireAuth, async (req: AuthRequest, res) => {
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
      address: VOTING_CONTRACT_ADDRESS as `0x${string}`,
      abi: VOTING_WRITE_ABI,
      functionName: "voteByRelayer",
      args: [electionId, candidateId, nimHash],
    });
    return res.json({ ok: true, hash });
  } catch {
    return res.status(500).json({ ok: false, reason: "Gagal submit vote" });
  }
});

app.post("/auth/vote-status", requireAuth, async (req: AuthRequest, res) => {
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

app.get("/auth/verification/status", requireAuth, async (req: AuthRequest, res) => {
  const student = await prisma.student.findUnique({
    where: { id: req.user!.id },
    select: {
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
  return res.json({ ok: true, ...student });
});

app.post(
  "/auth/verification/upload",
  requireAuth,
  upload.fields([
    { name: "card", maxCount: 1 },
    { name: "selfie", maxCount: 1 },
  ]),
  async (req: AuthRequest, res) => {
    const files = req.files as
      | { card?: Express.Multer.File[]; selfie?: Express.Multer.File[] }
      | undefined;
    const cardFile = files?.card?.[0];
    const selfieFile = files?.selfie?.[0];
    if (!cardFile || !selfieFile) {
      return res.status(400).json({ ok: false, reason: "File tidak lengkap" });
    }

    await prisma.student.update({
      where: { id: req.user!.id },
      data: {
        verificationStatus: "PENDING",
        verificationCardPath: path.relative(process.cwd(), cardFile.path),
        verificationSelfiePath: path.relative(process.cwd(), selfieFile.path),
        verificationSubmittedAt: new Date(),
        verificationVerifiedAt: null,
        verificationRejectedAt: null,
        verificationRejectReason: null,
      },
    });

    return res.json({ ok: true });
  }
);

app.get("/admin/verifications", requireAdmin, async (req, res) => {
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

app.post("/admin/verifications/:id/approve", requireAdmin, async (req, res) => {
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
  return res.json({ ok: true });
});

app.post("/admin/verifications/:id/reject", requireAdmin, async (req, res) => {
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
  return res.json({ ok: true });
});

app.post("/admin/chain/create-election", requireAdmin, async (req, res) => {
  if (!walletClient || !VOTING_CONTRACT_ADDRESS) {
    return res.status(500).json({ ok: false, reason: "Relayer not configured" });
  }
  const title = String(req.body?.title ?? "").trim();
  if (!title) {
    return res.status(400).json({ ok: false, reason: "Judul wajib diisi" });
  }
  try {
    const hash = await walletClient.writeContract({
      address: VOTING_CONTRACT_ADDRESS as `0x${string}`,
      abi: VOTING_ADMIN_ABI,
      functionName: "createElection",
      args: [title],
    });
    return res.json({ ok: true, hash });
  } catch {
    return res.status(500).json({ ok: false, reason: "Gagal membuat event" });
  }
});

app.post("/admin/chain/open-election", requireAdmin, async (req, res) => {
  if (!walletClient || !VOTING_CONTRACT_ADDRESS) {
    return res.status(500).json({ ok: false, reason: "Relayer not configured" });
  }
  try {
    const electionId = BigInt(req.body?.electionId);
    const hash = await walletClient.writeContract({
      address: VOTING_CONTRACT_ADDRESS as `0x${string}`,
      abi: VOTING_ADMIN_ABI,
      functionName: "openElection",
      args: [electionId],
    });
    return res.json({ ok: true, hash });
  } catch {
    return res.status(400).json({ ok: false, reason: "Gagal membuka event" });
  }
});

app.post("/admin/chain/close-election", requireAdmin, async (req, res) => {
  if (!walletClient || !VOTING_CONTRACT_ADDRESS) {
    return res.status(500).json({ ok: false, reason: "Relayer not configured" });
  }
  try {
    const electionId = BigInt(req.body?.electionId);
    const hash = await walletClient.writeContract({
      address: VOTING_CONTRACT_ADDRESS as `0x${string}`,
      abi: VOTING_ADMIN_ABI,
      functionName: "closeElection",
      args: [electionId],
    });
    return res.json({ ok: true, hash });
  } catch {
    return res.status(400).json({ ok: false, reason: "Gagal menutup event" });
  }
});

app.post("/admin/chain/add-candidate", requireAdmin, async (req, res) => {
  if (!walletClient || !VOTING_CONTRACT_ADDRESS) {
    return res.status(500).json({ ok: false, reason: "Relayer not configured" });
  }
  const name = String(req.body?.name ?? "").trim();
  if (!name) {
    return res.status(400).json({ ok: false, reason: "Nama kandidat wajib diisi" });
  }
  try {
    const electionId = BigInt(req.body?.electionId);
    const hash = await walletClient.writeContract({
      address: VOTING_CONTRACT_ADDRESS as `0x${string}`,
      abi: VOTING_ADMIN_ABI,
      functionName: "addCandidate",
      args: [electionId, name],
    });
    return res.json({ ok: true, hash });
  } catch {
    return res.status(400).json({ ok: false, reason: "Gagal menambah kandidat" });
  }
});

app.post("/admin/chain/update-candidate", requireAdmin, async (req, res) => {
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
    const hash = await walletClient.writeContract({
      address: VOTING_CONTRACT_ADDRESS as `0x${string}`,
      abi: VOTING_ADMIN_ABI,
      functionName: "updateCandidate",
      args: [electionId, candidateId, name],
    });
    return res.json({ ok: true, hash });
  } catch {
    return res.status(400).json({ ok: false, reason: "Gagal update kandidat" });
  }
});

app.post("/admin/chain/hide-candidate", requireAdmin, async (req, res) => {
  if (!walletClient || !VOTING_CONTRACT_ADDRESS) {
    return res.status(500).json({ ok: false, reason: "Relayer not configured" });
  }
  try {
    const electionId = BigInt(req.body?.electionId);
    const candidateId = BigInt(req.body?.candidateId);
    const hash = await walletClient.writeContract({
      address: VOTING_CONTRACT_ADDRESS as `0x${string}`,
      abi: VOTING_ADMIN_ABI,
      functionName: "hideCandidate",
      args: [electionId, candidateId],
    });
    return res.json({ ok: true, hash });
  } catch {
    return res.status(400).json({ ok: false, reason: "Gagal menyembunyikan kandidat" });
  }
});

app.use("/uploads", express.static(path.join(process.cwd(), "uploads")));

app.get("/health", (_req, res) => res.json({ ok: true }));

app.listen(4000, () => {
  console.log("Backend running on http://localhost:4000");
});
