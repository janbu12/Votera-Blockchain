"use client";

import { useState } from "react";

const BACKEND_URL = (process.env.NEXT_PUBLIC_BACKEND_URL ?? "http://localhost:4000").replace(
  /\/+$/,
  ""
);

export function NimGate({
  onVerified,
}: {
  onVerified: (nim: string) => void;
}) {
  const [nim, setNim] = useState("");
  const [loading, setLoading] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  async function verify() {
    setLoading(true);
    setMsg(null);
    try {
      const res = await fetch(`${BACKEND_URL}/verify-nim`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ nim }),
      });
      const data = await res.json();

      if (!res.ok) {
        setMsg(data?.reason ?? "Gagal verifikasi");
        return;
      }

      if (data.ok) {
        setMsg("✅ NIM valid (mahasiswa aktif). Kamu boleh voting.");
        onVerified(nim.trim());
      } else {
        setMsg("❌ NIM tidak terdaftar / tidak aktif.");
      }
    } catch {
      setMsg("❌ Backend tidak bisa diakses. Periksa NEXT_PUBLIC_BACKEND_URL.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="mt-6 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
      <h2 className="text-lg font-semibold text-slate-900">Verifikasi NIM</h2>
      <p className="mt-1 text-sm text-slate-500">
        Masukkan NIM untuk melanjutkan ke halaman voting.
      </p>
      <div className="mt-4 flex flex-wrap gap-3">
        <input
          value={nim}
          onChange={(e) => setNim(e.target.value)}
          placeholder="Masukkan NIM"
          className="w-48 rounded-lg border border-slate-200 px-3 py-2 text-sm shadow-sm outline-none focus:border-slate-400"
        />
        <button
          onClick={verify}
          disabled={loading || nim.trim().length === 0}
          className="rounded-lg bg-slate-900 px-4 py-2 text-sm font-semibold text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:bg-slate-400"
        >
          {loading ? "Memverifikasi..." : "Verifikasi"}
        </button>
      </div>

      {msg && <p className="mt-3 text-sm text-slate-600">{msg}</p>}
    </div>
  );
}
