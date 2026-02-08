import { walletClient, publicClient } from "../blockchain";
import { VOTING_CONTRACT_ADDRESS } from "../config";
import { VOTING_ADMIN_ABI } from "../abi";
import logger from "../logger";

let autoCloseRunning = false;

export async function autoCloseExpiredElections() {
  if (autoCloseRunning) return;
  if (!walletClient || !VOTING_CONTRACT_ADDRESS) return;
  autoCloseRunning = true;
  try {
    const count = await publicClient.readContract({
      address: VOTING_CONTRACT_ADDRESS as `0x${string}`,
      abi: VOTING_ADMIN_ABI,
      functionName: "electionsCount",
    });
    const total = Number(count ?? 0n);
    if (!Number.isFinite(total) || total <= 0) return;
    const nowSec = BigInt(Math.floor(Date.now() / 1000));
    for (let i = 1; i <= total; i += 1) {
      const election = await publicClient.readContract({
        address: VOTING_CONTRACT_ADDRESS as `0x${string}`,
        abi: VOTING_ADMIN_ABI,
        functionName: "getElection",
        args: [BigInt(i)],
      });
      const [, isOpen, mode, , endTime] = election;
      if (!isOpen) continue;
      if (Number(mode) !== 0) continue; // manual only
      if (!endTime || endTime === 0n) continue;
      if (nowSec <= endTime) continue;
      try {
        const hash = await walletClient.writeContract({
          chain: null,
          address: VOTING_CONTRACT_ADDRESS as `0x${string}`,
          abi: VOTING_ADMIN_ABI,
          functionName: "closeElection",
          args: [BigInt(i)],
        });
        logger.info({ electionId: i, hash }, "auto-close election closed");
      } catch (err) {
        logger.error({ err, electionId: i }, "auto-close failed to close");
      }
    }
  } catch (err) {
    logger.error({ err }, "auto-close poll failed");
  } finally {
    autoCloseRunning = false;
  }
}
