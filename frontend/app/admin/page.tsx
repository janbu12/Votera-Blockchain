"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useAccount, useChainId, useReadContract } from "wagmi";
import { useEffect } from "react";
import { AdminPanel } from "@/components/admin/AdminPanel";
import { Connection } from "@/components/connection";
import { WalletOptions } from "@/components/wallet-option";
import { VOTING_ABI, VOTING_ADDRESS, VOTING_CHAIN_ID } from "@/lib/contract";
import { clearAdminProfile } from "@/components/auth/admin-auth";

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
          <div className="flex items-center gap-3">
            {useRelayer && (
              <button
                onClick={() => {
                  fetch("/api/admin/logout", { method: "POST" }).catch(() => {});
                  clearAdminProfile();
                  router.push("/login");
                }}
                className="text-xs font-semibold text-slate-500 transition hover:text-slate-700"
              >
                Logout Admin
              </button>
            )}
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
        </div>

        <div className="mt-6">
          {useRelayer ? (
            <div className="rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">
              Mode relayer admin aktif. Transaksi dibayar backend.
            </div>
          ) : isConnected ? (
            <Connection />
          ) : (
            <WalletOptions />
          )}
        </div>

        {!useRelayer && !isConnected ? (
          <p className="mt-4 text-sm text-slate-500">
            Hubungkan wallet admin untuk melanjutkan.
          </p>
        ) : !useRelayer && !isSupportedChain ? (
          <p className="mt-4 text-sm text-rose-600">
            Jaringan tidak sesuai. Gunakan Localhost 8545 (chainId 31337).
          </p>
        ) : !useRelayer && !isAdmin ? (
          <p className="mt-4 text-sm text-rose-600">
            Wallet ini bukan admin kontrak. Silakan ganti wallet.
          </p>
        ) : (
          <div className="mt-6 space-y-6">
            <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-[0.3em] text-slate-400">
                    Admin Tools
                  </p>
                  <h2 className="mt-2 text-lg font-semibold text-slate-900">
                    Verifikasi Mahasiswa
                  </h2>
                  <p className="mt-1 text-sm text-slate-500">
                    Review upload kartu mahasiswa dan selfie.
                  </p>
                </div>
                <Link
                  href="/admin/verifications"
                  className="rounded-lg bg-slate-900 px-4 py-2 text-xs font-semibold text-white transition hover:bg-slate-800"
                >
                  Buka Panel Verifikasi
                </Link>
              </div>
            </div>
            <AdminPanel />
          </div>
        )}
      </div>
    </div>
  );
}
