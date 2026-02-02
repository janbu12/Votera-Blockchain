"use client";

import Link from "next/link";
import { useAccount, useChainId, useReadContract } from "wagmi";
import { AdminPanel } from "@/components/admin/AdminPanel";
import { Connection } from "@/components/connection";
import { WalletOptions } from "@/components/wallet-option";
import { VOTING_ABI, VOTING_ADDRESS, VOTING_CHAIN_ID } from "@/lib/contract";

export default function AdminPage() {
  const { address, isConnected } = useAccount();
  const chainId = useChainId();
  const isSupportedChain = chainId === VOTING_CHAIN_ID;
  const { data: adminAddress } = useReadContract({
    address: VOTING_ADDRESS,
    abi: VOTING_ABI,
    functionName: "admin",
    query: { enabled: isConnected && isSupportedChain },
  });

  const isAdmin =
    !!address &&
    !!adminAddress &&
    address.toLowerCase() === String(adminAddress).toLowerCase();

  return (
    <div className="min-h-screen bg-slate-50 px-6 py-10">
      <div className="mx-auto max-w-4xl">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.3em] text-slate-400">
              Admin Dashboard
            </p>
            <h1 className="mt-2 text-2xl font-semibold text-slate-900">
              Kelola Event Pemilihan
            </h1>
          </div>
          <Link
            href="/login"
            onClick={() => {
              if (typeof window !== "undefined") {
                window.sessionStorage.setItem("forceDisconnect", "1");
              }
            }}
            className="text-xs font-semibold text-slate-500 transition hover:text-slate-700"
          >
            Kembali ke Login
          </Link>
        </div>

        <div className="mt-6">
          {isConnected ? <Connection /> : <WalletOptions />}
        </div>

        {!isConnected ? (
          <p className="mt-4 text-sm text-slate-500">
            Hubungkan wallet admin untuk melanjutkan.
          </p>
        ) : !isSupportedChain ? (
          <p className="mt-4 text-sm text-rose-600">
            Jaringan tidak sesuai. Gunakan Localhost 8545 (chainId 31337).
          </p>
        ) : !isAdmin ? (
          <p className="mt-4 text-sm text-rose-600">
            Wallet ini bukan admin kontrak. Silakan ganti wallet.
          </p>
        ) : (
          <AdminPanel />
        )}
      </div>
    </div>
  );
}
