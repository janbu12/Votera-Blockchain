import express from "express";
import jwt from "jsonwebtoken";
import bcrypt from "bcryptjs";
import { encodePacked, keccak256 } from "viem";
import { Prisma } from "@prisma/client";
import { prisma } from "../db";
import {
  FACE_MATCH_THRESHOLD,
  JWT_SECRET,
  VOTING_CONTRACT_ADDRESS,
  WEBAUTHN_REQUIRED_FOR_VOTE,
} from "../config";
import { VOTING_READ_ABI, VOTING_WRITE_ABI, VOTING_ADMIN_ABI } from "../abi";
import { publicClient, walletClient, signerAccount } from "../blockchain";
import { upload, toPublicPath } from "../uploads";
import { requireAuth, AuthRequest } from "../middleware/auth";
import { ensureVerifiedStudent } from "../services/student";
import {
  campusChangePassword,
  type CampusFaceReference,
  campusGetFaceReference,
  campusGetStudent,
  campusLogin,
} from "../services/campus";
import { type FaceVerificationDecision, verifyFaceForVote } from "../services/faceProvider";
import {
  buildChallengeExpiry,
  challengeExpired,
  createAuthenticationOptions,
  createRegistrationOptions,
  parseWebAuthnTransports,
  serializeWebAuthnTransports,
  validateAuthenticationResponse,
  validateRegistrationResponse,
  WEBAUTHN_PURPOSE_ASSERT_VOTE,
  WEBAUTHN_PURPOSE_REGISTER,
} from "../services/webauthn";
import logger from "../logger";

const router = express.Router();
const paramValue = (value: string | string[]) => (Array.isArray(value) ? value[0] : value);

function mapFaceRejectReason(reasonCode: string | null) {
  if (reasonCode === "LIVENESS_FAIL") return "Liveness check gagal";
  if (reasonCode === "SELFIE_REQUIRED") {
    return "Selfie wajib diambil sebelum vote";
  }
  if (reasonCode === "NO_FACE_SELFIE") {
    return "Wajah tidak terdeteksi pada selfie";
  }
  if (reasonCode === "MULTI_FACE_SELFIE") {
    return "Selfie harus berisi satu wajah saja";
  }
  if (reasonCode === "NO_FACE_REFERENCE") {
    return "Wajah tidak terdeteksi pada foto resmi kampus";
  }
  if (reasonCode === "MULTI_FACE_REFERENCE") {
    return "Foto resmi kampus memuat lebih dari satu wajah";
  }
  if (reasonCode === "BAD_IMAGE") {
    return "Format gambar tidak valid";
  }
  if (reasonCode === "REFERENCE_FETCH_FAILED") {
    return "Foto resmi kampus tidak dapat diakses";
  }
  if (reasonCode === "LOW_SCORE") {
    return "Wajah tidak cocok dengan foto resmi";
  }
  return "Wajah tidak cocok dengan foto resmi";
}

function requestClientIp(req: express.Request) {
  const forwarded = req.headers["x-forwarded-for"];
  if (typeof forwarded === "string" && forwarded.trim()) {
    return forwarded.split(",")[0]?.trim() || null;
  }
  if (Array.isArray(forwarded) && forwarded.length > 0) {
    return forwarded[0]?.split(",")[0]?.trim() || null;
  }
  return req.socket.remoteAddress ?? null;
}

async function createVoteVerificationRecord(
  data: Prisma.StudentVoteVerificationUncheckedCreateInput
) {
  try {
    return await prisma.studentVoteVerification.create({
      data,
      select: { id: true },
    });
  } catch (err) {
    if (
      err instanceof Prisma.PrismaClientKnownRequestError &&
      err.code === "P2002"
    ) {
      return null;
    }
    throw err;
  }
}

async function setWebAuthnChallenge(
  studentId: number,
  purpose: string,
  challenge: string
) {
  await prisma.student.update({
    where: { id: studentId },
    data: {
      webAuthnChallenge: challenge,
      webAuthnChallengePurpose: purpose,
      webAuthnChallengeExpiresAt: buildChallengeExpiry(),
    },
  });
}

async function consumeWebAuthnChallenge(
  studentId: number,
  purpose: string
): Promise<string | null> {
  const student = await prisma.student.findUnique({
    where: { id: studentId },
    select: {
      webAuthnChallenge: true,
      webAuthnChallengePurpose: true,
      webAuthnChallengeExpiresAt: true,
    },
  });
  if (!student?.webAuthnChallenge) return null;
  if (student.webAuthnChallengePurpose !== purpose) return null;
  if (challengeExpired(student.webAuthnChallengeExpiresAt)) {
    await prisma.student.update({
      where: { id: studentId },
      data: {
        webAuthnChallenge: null,
        webAuthnChallengePurpose: null,
        webAuthnChallengeExpiresAt: null,
      },
    });
    return null;
  }
  const challenge = student.webAuthnChallenge;
  await prisma.student.update({
    where: { id: studentId },
    data: {
      webAuthnChallenge: null,
      webAuthnChallengePurpose: null,
      webAuthnChallengeExpiresAt: null,
    },
  });
  return challenge;
}

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

router.get("/auth/webauthn/status", requireAuth, async (req: AuthRequest, res) => {
  const student = await prisma.student.findUnique({
    where: { id: req.user!.id },
    select: {
      webAuthnCredentialId: true,
      webAuthnRegisteredAt: true,
    },
  });

  return res.json({
    ok: true,
    requiredForVote: WEBAUTHN_REQUIRED_FOR_VOTE,
    registered: Boolean(student?.webAuthnCredentialId),
    registeredAt: student?.webAuthnRegisteredAt?.toISOString() ?? null,
  });
});

router.post(
  "/auth/webauthn/register/options",
  requireAuth,
  async (req: AuthRequest, res) => {
    if (!(await ensureVerifiedStudent(req, res))) return;

    const student = await prisma.student.findUnique({
      where: { id: req.user!.id },
      select: {
        webAuthnCredentialId: true,
        webAuthnTransports: true,
      },
    });
    if (!student) {
      return res.status(404).json({ ok: false, reason: "Mahasiswa tidak ditemukan" });
    }
    if (student.webAuthnCredentialId) {
      return res.status(409).json({ ok: false, reason: "Passkey sudah terdaftar" });
    }

    const options = await createRegistrationOptions({
      nim: req.user!.nim,
      excludeCredentialId: student.webAuthnCredentialId,
      excludeTransports: parseWebAuthnTransports(student.webAuthnTransports),
    });
    await setWebAuthnChallenge(req.user!.id, WEBAUTHN_PURPOSE_REGISTER, options.challenge);
    return res.json({ ok: true, options });
  }
);

router.post(
  "/auth/webauthn/register/verify",
  requireAuth,
  async (req: AuthRequest, res) => {
    if (!(await ensureVerifiedStudent(req, res))) return;
    const challenge = await consumeWebAuthnChallenge(
      req.user!.id,
      WEBAUTHN_PURPOSE_REGISTER
    );
    if (!challenge) {
      return res.status(400).json({
        ok: false,
        reason: "Challenge passkey tidak valid atau kadaluarsa",
      });
    }

    try {
      const { verified, result } = await validateRegistrationResponse({
        response: req.body?.credential,
        expectedChallenge: challenge,
      });
      if (!verified || !result) {
        return res.status(400).json({ ok: false, reason: "Registrasi passkey gagal" });
      }

      await prisma.student.update({
        where: { id: req.user!.id },
        data: {
          webAuthnCredentialId: result.credentialId,
          webAuthnPublicKey: result.publicKey,
          webAuthnCounter: result.counter,
          webAuthnDeviceType: result.deviceType,
          webAuthnBackedUp: result.backedUp,
          webAuthnTransports: serializeWebAuthnTransports(result.transports),
          webAuthnRegisteredAt: new Date(),
        },
      });

      logger.info(
        {
          event: "webauthn.registered",
          nim: req.user!.nim,
          studentId: req.user!.id,
        },
        "student passkey registered"
      );
      return res.json({ ok: true });
    } catch (err) {
      logger.warn(
        {
          err,
          event: "webauthn.register_failed",
          nim: req.user!.nim,
        },
        "student passkey registration failed"
      );
      return res.status(400).json({ ok: false, reason: "Registrasi passkey gagal" });
    }
  }
);

router.post(
  "/auth/webauthn/assert/options",
  requireAuth,
  async (req: AuthRequest, res) => {
    if (!(await ensureVerifiedStudent(req, res))) return;
    const student = await prisma.student.findUnique({
      where: { id: req.user!.id },
      select: {
        webAuthnCredentialId: true,
        webAuthnTransports: true,
      },
    });

    if (!student?.webAuthnCredentialId) {
      return res.status(404).json({
        ok: false,
        reason: "Passkey belum terdaftar. Aktivasi dulu di halaman profil.",
      });
    }

    const options = await createAuthenticationOptions({
      credentialId: student.webAuthnCredentialId,
      transports: parseWebAuthnTransports(student.webAuthnTransports),
    });
    await setWebAuthnChallenge(req.user!.id, WEBAUTHN_PURPOSE_ASSERT_VOTE, options.challenge);

    return res.json({ ok: true, options });
  }
);

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

router.post("/auth/vote-verify", requireAuth, async (req: AuthRequest, res) => {
  if (!walletClient || !VOTING_CONTRACT_ADDRESS) {
    return res.status(500).json({ ok: false, reason: "Relayer not configured" });
  }
  if (!(await ensureVerifiedStudent(req, res))) return;

  const electionIdRaw = req.body?.electionId;
  const candidateIdRaw = req.body?.candidateId;
  const faceAssertionToken = String(req.body?.faceAssertionToken ?? "").trim();
  const selfieDataUrl =
    typeof req.body?.selfieDataUrl === "string" ? req.body.selfieDataUrl : undefined;
  const webauthnCredential = req.body?.webauthnCredential;

  if (!electionIdRaw || !candidateIdRaw || !faceAssertionToken) {
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
  const assertionTokenHash = keccak256(new TextEncoder().encode(faceAssertionToken));
  const ip = requestClientIp(req);
  const userAgentHeader = req.headers["user-agent"];
  const userAgent = Array.isArray(userAgentHeader)
    ? userAgentHeader.join(", ")
    : userAgentHeader ?? null;

  logger.info(
    {
      event: "vote.verify.requested",
      nim: req.user!.nim,
      electionId: electionId.toString(),
      candidateId: candidateId.toString(),
      ip,
    },
      "vote verification requested"
  );

  const replayFound = await prisma.studentVoteVerification.findFirst({
    where: { assertionTokenHash },
    select: { id: true },
  });
  if (replayFound) {
    logger.warn(
      {
        event: "vote.verify.replay_rejected",
        nim: req.user!.nim,
        electionId: electionId.toString(),
        candidateId: candidateId.toString(),
        verificationId: replayFound.id,
      },
      "replayed face assertion token rejected"
    );
    return res.status(409).json({
      ok: false,
      reason: "Token verifikasi sudah digunakan",
      verificationId: replayFound.id,
    });
  }

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

  let reference: CampusFaceReference | null = null;
  try {
    reference = await campusGetFaceReference(req.user!.nim);
  } catch (err) {
    logger.error({ err, nim: req.user!.nim }, "vote.verify.reference_error");
    return res
      .status(503)
      .json({ ok: false, reason: "Gagal mengambil foto resmi dari campus service" });
  }

  if (!reference) {
    logger.warn(
      {
        event: "vote.verify.reference_missing",
        nim: req.user!.nim,
        electionId: electionId.toString(),
      },
      "official photo missing"
    );
    const rejected = await createVoteVerificationRecord({
      studentId: req.user!.id,
      nim: req.user!.nim,
      electionId,
      candidateId,
      provider: "face-reference",
      providerRequestId: null,
      livenessPassed: false,
      faceMatchScore: null,
      decision: "REJECTED",
      reasonCode: "NO_REFERENCE_PHOTO",
      ip,
      userAgent,
      assertionTokenHash,
    });
    if (!rejected) {
      return res.status(409).json({
        ok: false,
        reason: "Token verifikasi sudah digunakan",
      });
    }
    return res.status(404).json({
      ok: false,
      reason: "Foto resmi kampus tidak ditemukan",
      verificationId: rejected.id,
    });
  }

  let decision: FaceVerificationDecision;
  try {
    decision = await verifyFaceForVote({
      nim: req.user!.nim,
      faceAssertionToken,
      referenceUrl: reference.referenceUrl,
      selfieDataUrl,
    });
  } catch (err) {
    logger.error(
      {
        err,
        event: "vote.verify.provider_fail",
        nim: req.user!.nim,
        electionId: electionId.toString(),
      },
      "face provider verification failed"
    );
    const rejected = await createVoteVerificationRecord({
      studentId: req.user!.id,
      nim: req.user!.nim,
      electionId,
      candidateId,
      provider: "face-provider",
      providerRequestId: null,
      livenessPassed: false,
      faceMatchScore: null,
      decision: "REJECTED",
      reasonCode: "PROVIDER_ERROR",
      ip,
      userAgent,
      assertionTokenHash,
    });
    if (!rejected) {
      return res.status(409).json({
        ok: false,
        reason: "Token verifikasi sudah digunakan",
      });
    }
    return res.status(503).json({
      ok: false,
      reason: "Layanan verifikasi wajah tidak tersedia",
      verificationId: rejected.id,
    });
  }

  logger.info(
    {
      event: decision.approved ? "vote.verify.provider_ok" : "vote.verify.rejected",
      nim: req.user!.nim,
      electionId: electionId.toString(),
      candidateId: candidateId.toString(),
      provider: decision.provider,
      providerRequestId: decision.providerRequestId,
      livenessPassed: decision.livenessPassed,
      faceMatchScore: decision.faceMatchScore,
      reasonCode: decision.reasonCode,
      modelVersion: decision.modelVersion ?? null,
    },
    "face provider verification evaluated"
  );

  const verification = await createVoteVerificationRecord({
    studentId: req.user!.id,
    nim: req.user!.nim,
    electionId,
    candidateId,
    provider: decision.provider,
    providerRequestId: decision.providerRequestId,
    livenessPassed: decision.livenessPassed,
    faceMatchScore: decision.faceMatchScore,
    decision: decision.approved ? "APPROVED" : "REJECTED",
    reasonCode: decision.reasonCode,
    ip,
    userAgent,
    assertionTokenHash,
  });
  if (!verification) {
    return res.status(409).json({
      ok: false,
      reason: "Token verifikasi sudah digunakan",
    });
  }

  if (!decision.approved) {
    const reason = mapFaceRejectReason(decision.reasonCode);
    return res.status(403).json({
      ok: false,
      reason,
      verificationId: verification.id,
      reasonCode: decision.reasonCode,
      faceMatchScore: decision.faceMatchScore,
      threshold: FACE_MATCH_THRESHOLD,
    });
  }

  const student = await prisma.student.findUnique({
    where: { id: req.user!.id },
    select: {
      webAuthnCredentialId: true,
      webAuthnPublicKey: true,
      webAuthnCounter: true,
      webAuthnTransports: true,
    },
  });

  if (WEBAUTHN_REQUIRED_FOR_VOTE && !student?.webAuthnCredentialId) {
    return res.status(412).json({
      ok: false,
      reason: "Passkey belum terdaftar. Aktivasi fingerprint dulu di halaman profil.",
      verificationId: verification.id,
    });
  }

  if (student?.webAuthnCredentialId) {
    if (!student.webAuthnPublicKey) {
      return res.status(412).json({
        ok: false,
        reason: "Passkey tidak valid. Registrasi ulang passkey di halaman profil.",
        verificationId: verification.id,
      });
    }

    if (!webauthnCredential || typeof webauthnCredential !== "object") {
      return res.status(400).json({
        ok: false,
        reason: "Verifikasi fingerprint diperlukan sebelum vote.",
        verificationId: verification.id,
      });
    }

    const challenge = await consumeWebAuthnChallenge(
      req.user!.id,
      WEBAUTHN_PURPOSE_ASSERT_VOTE
    );
    if (!challenge) {
      return res.status(400).json({
        ok: false,
        reason: "Challenge fingerprint tidak valid atau kadaluarsa.",
        verificationId: verification.id,
      });
    }

    try {
      const verified = await validateAuthenticationResponse({
        response: webauthnCredential,
        expectedChallenge: challenge,
        credentialId: student.webAuthnCredentialId,
        publicKey: student.webAuthnPublicKey,
        counter: student.webAuthnCounter,
        transports: parseWebAuthnTransports(student.webAuthnTransports),
      });
      if (!verified.verified) {
        return res.status(403).json({
          ok: false,
          reason: "Fingerprint/passkey tidak valid.",
          verificationId: verification.id,
        });
      }
      await prisma.student.update({
        where: { id: req.user!.id },
        data: { webAuthnCounter: verified.newCounter },
      });
      logger.info(
        {
          event: "vote.verify.passkey_ok",
          nim: req.user!.nim,
          electionId: electionId.toString(),
          candidateId: candidateId.toString(),
        },
        "vote passkey challenge verified"
      );
    } catch (err) {
      logger.warn(
        {
          err,
          event: "vote.verify.passkey_rejected",
          nim: req.user!.nim,
          electionId: electionId.toString(),
          candidateId: candidateId.toString(),
        },
        "vote passkey verification failed"
      );
      return res.status(403).json({
        ok: false,
        reason: "Fingerprint/passkey tidak valid.",
        verificationId: verification.id,
      });
    }
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
    logger.info(
      {
        event: "vote.verify.approved",
        nim: req.user!.nim,
        electionId: electionId.toString(),
        candidateId: candidateId.toString(),
        verificationId: verification.id,
        txHash: hash,
        modelVersion: decision.modelVersion ?? null,
      },
      "vote relay submitted after verification"
    );
    return res.json({ ok: true, txHash: hash, hash, verificationId: verification.id });
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
