"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useAccount, useChainId, useDisconnect, useReadContract } from "wagmi";
import { Connection } from "@/components/connection";
import { WalletOptions } from "@/components/wallet-option";
import { VOTING_ABI, VOTING_ADDRESS, VOTING_CHAIN_ID } from "@/lib/contract";
import { saveStudentAuth } from "@/components/auth/student-auth";

export default function LoginPage() {
  const { isConnected } = useAccount();
  const { disconnect } = useDisconnect();

  useEffect(() => {
    if (typeof window === "undefined") return;
    const shouldDisconnect = window.sessionStorage.getItem("forceDisconnect");
    if (shouldDisconnect === "1" && isConnected) {
      disconnect();
      window.sessionStorage.removeItem("forceDisconnect");
    }
  }, [isConnected, disconnect]);

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-slate-100 px-6 py-12">
      <div className="mx-auto max-w-5xl">
        <header className="mb-10 text-center">
          <p className="text-xs font-semibold uppercase tracking-[0.3em] text-slate-400">
            Voting BEM
          </p>
          <h1 className="mt-3 text-3xl font-semibold text-slate-900 sm:text-4xl">
            Masuk ke Sistem Pemilihan
          </h1>
          <p className="mt-3 text-sm text-slate-500">
            Pilih peran kamu untuk melanjutkan ke halaman yang sesuai.
          </p>
        </header>

        <div className="grid gap-6 lg:grid-cols-2">
          <AdminLoginCard />
          <MahasiswaLoginCard />
        </div>
      </div>
    </div>
  );
}

function AdminLoginCard() {
  const router = useRouter();
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
    <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
      <h2 className="text-lg font-semibold text-slate-900">Login Admin</h2>
      <p className="mt-1 text-sm text-slate-500">
        Gunakan wallet admin untuk membuat event dan mengelola kandidat.
      </p>

      <div className="mt-5 space-y-4">
        {isConnected ? <Connection /> : <WalletOptions />}
      </div>

      <div className="mt-5">
        <button
          onClick={() => router.push("/admin")}
          disabled={!isAdmin}
          className="w-full rounded-xl bg-slate-900 px-4 py-3 text-sm font-semibold text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:bg-slate-400"
        >
          {isAdmin ? "Masuk Admin" : "Hubungkan wallet admin dulu"}
        </button>
        {isConnected && !isSupportedChain && (
          <p className="mt-2 text-xs text-rose-600">
            Jaringan tidak sesuai. Gunakan Localhost 8545 (chainId 31337).
          </p>
        )}
        {isConnected && isSupportedChain && !isAdmin && (
          <p className="mt-2 text-xs text-slate-500">
            Wallet yang terhubung bukan admin kontrak.
          </p>
        )}
      </div>
    </section>
  );
}

function MahasiswaLoginCard() {
  const router = useRouter();
  const [nim, setNim] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  async function login() {
    setLoading(true);
    setMsg(null);
    try {
      const res = await fetch("http://localhost:4000/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ nim, password }),
      });
      const data = await res.json();

      if (!res.ok) {
        setMsg(data?.reason ?? "Gagal login");
        return;
      }

      saveStudentAuth({
        token: data.token,
        nim: nim.trim(),
        mustChangePassword: !!data.mustChangePassword,
      });
      router.push("/mahasiswa");
    } catch {
      setMsg("❌ Backend tidak bisa diakses. Pastikan backend jalan di :4000");
    } finally {
      setLoading(false);
    }
  }

  return (
    <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
      <h2 className="text-lg font-semibold text-slate-900">Login Mahasiswa</h2>
      <p className="mt-1 text-sm text-slate-500">
        Verifikasi NIM untuk masuk ke halaman voting mahasiswa.
      </p>

      <div className="mt-5 space-y-3">
        <input
          value={nim}
          onChange={(e) => setNim(e.target.value)}
          placeholder="Masukkan NIM"
          className="w-full rounded-xl border border-slate-200 px-4 py-3 text-sm shadow-sm outline-none focus:border-slate-400"
        />
        <input
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          type="password"
          placeholder="Password"
          className="w-full rounded-xl border border-slate-200 px-4 py-3 text-sm shadow-sm outline-none focus:border-slate-400"
        />
        <button
          onClick={login}
          disabled={loading || nim.trim().length === 0 || password.length === 0}
          className="w-full rounded-xl bg-slate-900 px-4 py-3 text-sm font-semibold text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:bg-slate-400"
        >
          {loading ? "Memproses..." : "Masuk Mahasiswa"}
        </button>
        {msg && <p className="text-xs text-slate-500">{msg}</p>}
      </div>
    </section>
  );
}
