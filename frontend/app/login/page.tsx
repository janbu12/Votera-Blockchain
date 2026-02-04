"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { saveStudentAuth } from "@/components/auth/student-auth";
import { clearAdminProfile, saveAdminProfile } from "@/components/auth/admin-auth";

export default function LoginPage() {
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
  const [adminUsername, setAdminUsername] = useState(
    process.env.NEXT_PUBLIC_ADMIN_USERNAME ?? "admin"
  );
  const [adminPassword, setAdminPassword] = useState("");
  const [adminMsg, setAdminMsg] = useState<string | null>(null);

  async function loginAdmin() {
    setAdminMsg(null);
    try {
      const res = await fetch("/api/admin/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username: adminUsername, password: adminPassword }),
      });
      const data = await res.json();
      if (!res.ok) {
        setAdminMsg(data?.reason ?? "Login admin gagal");
        return;
      }
      saveAdminProfile({ username: adminUsername });
      router.push("/admin");
    } catch {
      setAdminMsg("Gagal menghubungi backend");
    }
  }

  return (
    <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
      <h2 className="text-lg font-semibold text-slate-900">Login Admin</h2>
      <p className="mt-1 text-sm text-slate-500">
        Login admin untuk mengelola event, kandidat, dan verifikasi.
      </p>

      <div className="mt-5">
        <div className="space-y-3">
          <input
            value={adminUsername}
            onChange={(e) => setAdminUsername(e.target.value)}
            placeholder="Username admin"
            className="w-full rounded-xl border border-slate-200 px-4 py-3 text-sm shadow-sm outline-none focus:border-slate-400"
          />
          <input
            value={adminPassword}
            onChange={(e) => setAdminPassword(e.target.value)}
            placeholder="Password admin"
            type="password"
            className="w-full rounded-xl border border-slate-200 px-4 py-3 text-sm shadow-sm outline-none focus:border-slate-400"
          />
          <div className="flex items-center gap-2">
            <button
              onClick={loginAdmin}
              className="flex-1 rounded-xl bg-slate-900 px-4 py-3 text-sm font-semibold text-white transition hover:bg-slate-800"
            >
              Login Admin
            </button>
            <button
              onClick={() => {
                fetch("/api/admin/logout", { method: "POST" }).catch(() => {});
                clearAdminProfile();
                setAdminPassword("");
              }}
              className="rounded-xl border border-slate-200 px-4 py-3 text-sm font-semibold text-slate-600 transition hover:bg-slate-50"
            >
              Clear
            </button>
          </div>
          {adminMsg && <p className="text-xs text-rose-600">{adminMsg}</p>}
        </div>
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
      const res = await fetch("/api/student/login", {
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
