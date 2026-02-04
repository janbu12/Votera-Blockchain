import { publicClient } from "../blockchain";
import { prisma } from "../db";
import { VOTING_CONTRACT_ADDRESS } from "../config";
import { VOTING_ADMIN_ABI } from "../abi";

export function toCsvRow(values: Array<string | number | boolean | null | undefined>) {
  return values
    .map((value) => {
      if (value === null || value === undefined) return "";
      const raw = String(value);
      if (/[",\n]/.test(raw)) {
        return `"${raw.replace(/"/g, '""')}"`;
      }
      return raw;
    })
    .join(",");
}

export async function markElectionOpened(electionId: bigint) {
  await prisma.electionState.upsert({
    where: { electionId },
    update: { openedOnce: true, openedAt: new Date() },
    create: { electionId, openedOnce: true, openedAt: new Date() },
  });
}

export async function isElectionLocked(electionId: bigint) {
  const state = await prisma.electionState.findUnique({
    where: { electionId },
    select: { openedOnce: true },
  });
  if (state?.openedOnce) return true;
  if (!VOTING_CONTRACT_ADDRESS) return false;
  try {
    const election = await publicClient.readContract({
      address: VOTING_CONTRACT_ADDRESS as `0x${string}`,
      abi: VOTING_ADMIN_ABI,
      functionName: "getElection",
      args: [electionId],
    });
    const mode = Number(election[2]);
    return mode === 1;
  } catch {
    return false;
  }
}

export async function fetchElectionSnapshot(electionId: bigint) {
  if (!VOTING_CONTRACT_ADDRESS) {
    throw new Error("Contract not configured");
  }
  const election = await publicClient.readContract({
    address: VOTING_CONTRACT_ADDRESS as `0x${string}`,
    abi: VOTING_ADMIN_ABI,
    functionName: "getElection",
    args: [electionId],
  });
  const [title, isOpen, mode, startTime, endTime, candidatesCount] = election;
  const startMs = startTime ? Number(startTime) * 1000 : 0;
  const endMs = endTime ? Number(endTime) * 1000 : 0;
  const total = Number(candidatesCount ?? 0n);
  const candidates: Array<{
    id: string;
    name: string;
    voteCount: number;
    isActive: boolean;
  }> = [];
  let totalVotes = 0;
  for (let i = 1; i <= total; i += 1) {
    const candidate = await publicClient.readContract({
      address: VOTING_CONTRACT_ADDRESS as `0x${string}`,
      abi: VOTING_ADMIN_ABI,
      functionName: "getCandidate",
      args: [electionId, BigInt(i)],
    });
    const [cid, name, voteCount, isActive] = candidate;
    const countNum = Number(voteCount ?? 0n);
    totalVotes += countNum;
    candidates.push({
      id: String(cid),
      name: String(name),
      voteCount: countNum,
      isActive: Boolean(isActive),
    });
  }
  return {
    title: String(title),
    isOpen: Boolean(isOpen),
    mode: Number(mode),
    startMs,
    endMs,
    candidates,
    totalVotes,
  };
}
