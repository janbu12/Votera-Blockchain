import express from "express";
import cors from "cors";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { PrismaClient } from "@prisma/client";
import { createPublicClient, createWalletClient, encodePacked, http, keccak256 } from "viem";
import { privateKeyToAccount } from "viem/accounts";

const app = express();
app.use(cors({ origin: "http://localhost:3000" }));
app.use(express.json());

const prisma = new PrismaClient();
const JWT_SECRET = process.env.JWT_SECRET || "dev-secret-change-me";
const SIGNER_PRIVATE_KEY = process.env.SIGNER_PRIVATE_KEY;
const VOTING_CONTRACT_ADDRESS = process.env.VOTING_CONTRACT_ADDRESS;
const RPC_URL = process.env.RPC_URL || "http://127.0.0.1:8545";

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

app.get("/health", (_req, res) => res.json({ ok: true }));

app.listen(4000, () => {
  console.log("Backend running on http://localhost:4000");
});
