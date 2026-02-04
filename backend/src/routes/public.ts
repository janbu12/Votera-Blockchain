import express from "express";
import { prisma } from "../db";
import { VOTING_CONTRACT_ADDRESS } from "../config";
import { VOTING_ADMIN_ABI } from "../abi";
import { publicClient } from "../blockchain";

const router = express.Router();

router.get("/public/results", async (_req, res) => {
  try {
    const results = await prisma.electionResult.findMany({
      where: { published: true },
      orderBy: { publishedAt: "desc" },
    });
    return res.json({
      ok: true,
      items: results.map((result) => ({
        electionId: result.electionId.toString(),
        title: result.title,
        totalVotes: result.totalVotes,
        snapshotAt: result.snapshotAt.toISOString(),
        publishedAt: result.publishedAt ? result.publishedAt.toISOString() : null,
        results: result.results,
      })),
    });
  } catch (err) {
    console.error("public results failed", err);
    return res.status(500).json({ ok: false, reason: "Gagal memuat hasil" });
  }
});

router.get("/public/results/:electionId", async (req, res) => {
  try {
    const electionId = BigInt(req.params.electionId);
    const result = await prisma.electionResult.findUnique({
      where: { electionId, published: true },
    });
    if (!result) {
      return res.status(404).json({ ok: false, reason: "Hasil tidak ditemukan" });
    }
    return res.json({
      ok: true,
      result: {
        electionId: result.electionId.toString(),
        title: result.title,
        totalVotes: result.totalVotes,
        snapshotAt: result.snapshotAt.toISOString(),
        publishedAt: result.publishedAt ? result.publishedAt.toISOString() : null,
        results: result.results,
      },
    });
  } catch (err) {
    console.error("public results detail failed", err);
    return res.status(500).json({ ok: false, reason: "Gagal memuat hasil" });
  }
});

router.get("/public/progress", async (_req, res) => {
  if (!VOTING_CONTRACT_ADDRESS) {
    return res.status(500).json({ ok: false, reason: "Contract not configured" });
  }
  try {
    const count = await publicClient.readContract({
      address: VOTING_CONTRACT_ADDRESS as `0x${string}`,
      abi: VOTING_ADMIN_ABI,
      functionName: "electionsCount",
      args: [],
    });
    const total = Number(count ?? 0n);
    const items = [];
    for (let i = 1; i <= total; i += 1) {
      const election = await publicClient.readContract({
        address: VOTING_CONTRACT_ADDRESS as `0x${string}`,
        abi: VOTING_ADMIN_ABI,
        functionName: "getElection",
        args: [BigInt(i)],
      });
      const [title, isOpen, mode, startTime, endTime, candidatesCount] = election;
      const totalCandidates = Number(candidatesCount ?? 0n);
      const candidates = [];
      let totalVotes = 0;
      for (let c = 1; c <= totalCandidates; c += 1) {
        const candidate = await publicClient.readContract({
          address: VOTING_CONTRACT_ADDRESS as `0x${string}`,
          abi: VOTING_ADMIN_ABI,
          functionName: "getCandidate",
          args: [BigInt(i), BigInt(c)],
        });
        const [cid, _name, voteCount, isActive] = candidate;
        const votes = Number(voteCount ?? 0n);
        totalVotes += votes;
        candidates.push({
          id: String(cid),
          voteCount: votes,
          isActive: Boolean(isActive),
        });
      }
      const isProduction = Number(mode) === 1;
      const startSeconds = Number(startTime ?? 0n);
      const endSeconds = Number(endTime ?? 0n);
      const nowSeconds = Math.floor(Date.now() / 1000);
      const isWithinSchedule =
        !!startSeconds &&
        !!endSeconds &&
        nowSeconds >= startSeconds &&
        nowSeconds <= endSeconds;
      const isPublicLive = Boolean(isOpen) && isProduction && isWithinSchedule;

      if (isPublicLive) {
        items.push({
          electionId: String(i),
          title: String(title),
          isOpen: Boolean(isOpen),
          mode: Number(mode),
          startTime: startSeconds,
          endTime: endSeconds,
          totalVotes,
          candidates: candidates
            .filter((candidate) => candidate.isActive)
            .map(({ id, voteCount }) => ({ id, voteCount })),
        });
      }
    }
    return res.json({ ok: true, items });
  } catch (err) {
    console.error("public progress failed", err);
    return res.status(500).json({ ok: false, reason: "Gagal memuat progress" });
  }
});

export default router;
