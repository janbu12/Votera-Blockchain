"use client";

import { useRouter } from "next/navigation";
import { useAccount, useChainId, useReadContract } from "wagmi";
import { useEffect } from "react";
import { AdminPanel } from "@/components/admin/AdminPanel";
import { VOTING_ABI, VOTING_ADDRESS, VOTING_CHAIN_ID } from "@/lib/contract";

export default function AdminPage() {
  const router = useRouter();
  const { address, isConnected } = useAccount();
  const chainId = useChainId();
  const isSupportedChain = chainId === VOTING_CHAIN_ID;
  const adminMode = (process.env.NEXT_PUBLIC_ADMIN_MODE ?? "wallet").toLowerCase();
  const useRelayer = adminMode === "relayer";
  const { data: adminAddress } = useReadContract({
    address: VOTING_ADDRESS,
    abi: VOTING_ABI,
    functionName: "admin",
    query: { enabled: !useRelayer && isConnected && isSupportedChain },
  });

  const isAdmin =
    !!address &&
    !!adminAddress &&
    address.toLowerCase() === String(adminAddress).toLowerCase();

  useEffect(() => {
    if (!useRelayer) return;
    fetch("/api/admin/me")
      .then((res) => {
        if (!res.ok) {
          router.replace("/login");
        }
      })
      .catch(() => {
        router.replace("/login");
      });
  }, [useRelayer, router]);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.3em] text-amber-500">
            Admin Dashboard
          </p>
          <h1 className="mt-2 text-2xl font-semibold text-slate-900">
            Kelola Event Pemilihan
          </h1>
          <p className="mt-1 text-sm text-slate-500">
            Pantau status event, kandidat, dan validasi admin secara real-time.
          </p>
        </div>
        <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-xs text-slate-600">
          {useRelayer
            ? "Mode relayer aktif: transaksi dibayar backend."
            : "Mode wallet aktif: gunakan Metamask admin."}
        </div>
      </div>

      {!useRelayer && !isConnected ? (
        <p className="text-sm text-slate-500">
          Hubungkan wallet admin untuk melanjutkan.
        </p>
      ) : !useRelayer && !isSupportedChain ? (
        <p className="text-sm text-rose-600">
          Jaringan tidak sesuai. Gunakan Localhost 8545 (chainId 31337).
        </p>
      ) : !useRelayer && !isAdmin ? (
        <p className="text-sm text-rose-600">
          Wallet ini bukan admin kontrak. Silakan ganti wallet.
        </p>
      ) : (
        <AdminPanel />
      )}
    </div>
  );
}
