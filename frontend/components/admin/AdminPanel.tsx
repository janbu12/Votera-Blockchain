"use client";

import { useMemo } from "react";
import { useAccount, useChainId, useReadContract } from "wagmi";
import { VOTING_ABI, VOTING_ADDRESS, VOTING_CHAIN_ID } from "@/lib/contract";
import { useAdminSession } from "@/components/auth/useAdminSession";
import { AdminActions } from "./AdminActions";

export function AdminPanel() {
  const { address } = useAccount();
  const chainId = useChainId();
  const isSupportedChain = chainId === VOTING_CHAIN_ID;
  const adminMode = (process.env.NEXT_PUBLIC_ADMIN_MODE ?? "wallet").toLowerCase();
  const useRelayer = adminMode === "relayer";
  const { isAdminAuthed } = useAdminSession();
  const { data: electionsCount } = useReadContract({
    address: VOTING_ADDRESS,
    abi: VOTING_ABI,
    functionName: "electionsCount",
    query: { enabled: useRelayer || (!!address && isSupportedChain) },
  });
  const { data: adminAddress } = useReadContract({
    address: VOTING_ADDRESS,
    abi: VOTING_ABI,
    functionName: "admin",
    query: { enabled: useRelayer || (!!address && isSupportedChain) },
  });

  const isAdmin = useRelayer
    ? isAdminAuthed
    : !!address &&
      !!adminAddress &&
      address.toLowerCase() === String(adminAddress).toLowerCase();

  const electionIds = useMemo(() => {
    const n = Number(electionsCount ?? 0n);
    return Array.from({ length: n }, (_, i) => BigInt(i + 1));
  }, [electionsCount]);

  if (!useRelayer && !address) return null;

  return (
    <div className="mt-8 border-t border-slate-200 pt-6">
      <h2 className="text-xl font-semibold text-slate-900">Admin Panel</h2>
      <p className="mt-2 text-sm text-slate-600">
        Status:{" "}
        <span
          className={`font-semibold ${
            isAdmin ? "text-emerald-600" : "text-slate-400"
          }`}
        >
          {useRelayer ? "Relayer" : isAdmin ? "Admin" : "Bukan admin"}
        </span>
      </p>
      {isAdmin ? (
        <AdminActions electionIds={electionIds} />
      ) : (
        <p className="mt-3 text-sm text-slate-500">
          Hanya admin yang bisa mengelola event.
        </p>
      )}
    </div>
  );
}
