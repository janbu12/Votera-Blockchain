"use client";

import { useEffect, useMemo, useState } from "react";
import { useToast } from "@/components/ToastProvider";

type AdminUser = {
  id: number;
  username: string;
  role: string;
  isActive: boolean;
  createdAt: string;
};

export default function AdminUsersPage() {
  const { push } = useToast();
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [role, setRole] = useState<string | null>(null);
  const [roleError, setRoleError] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [createOpen, setCreateOpen] = useState(false);
  const [newUsername, setNewUsername] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [newRole, setNewRole] = useState("admin");
  const [resetTarget, setResetTarget] = useState<AdminUser | null>(null);
  const [resetPassword, setResetPassword] = useState("");

  const loadUsers = () => {
    setLoading(true);
    setError(null);
    fetch("/api/admin/users")
      .then((res) => res.json().then((data) => ({ ok: res.ok, data })))
      .then((result) => {
        if (result.ok) {
          setUsers(result.data.users ?? []);
        } else {
          setError(result.data?.reason ?? "Gagal memuat admin");
        }
      })
      .catch(() => setError("Gagal menghubungi backend"))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    fetch("/api/admin/me")
      .then((res) => res.json().then((data) => ({ ok: res.ok, data })))
      .then((result) => {
        if (result.ok) {
          setRole(result.data.role ?? "admin");
        } else {
          setRoleError(result.data?.reason ?? "Gagal memuat role");
        }
      })
      .catch(() => setRoleError("Gagal menghubungi backend"));
  }, []);

  useEffect(() => {
    if (role === "superadmin") {
      loadUsers();
    }
  }, [role]);

  const filtered = useMemo(() => {
    const term = search.trim().toLowerCase();
    if (!term) return users;
    return users.filter((user) => user.username.toLowerCase().includes(term));
  }, [search, users]);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.3em] text-amber-500">
            Admin Management
          </p>
          <h1 className="mt-2 text-2xl font-semibold text-slate-900">
            Kelola Admin
          </h1>
          <p className="mt-2 text-sm text-slate-500">
            Hanya superadmin yang bisa menambah atau menonaktifkan admin.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Cari username..."
            className="w-full max-w-xs rounded-xl border border-slate-200 px-3 py-2 text-sm shadow-sm outline-none focus:border-slate-400"
          />
          <button
            onClick={() => setCreateOpen(true)}
            className="rounded-lg bg-slate-900 px-4 py-2 text-xs font-semibold text-white transition hover:bg-slate-800"
            disabled={role !== "superadmin"}
          >
            Tambah Admin
          </button>
        </div>
      </div>

      {roleError && (
        <div className="rounded-2xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-600">
          {roleError}
        </div>
      )}
      {role && role !== "superadmin" && (
        <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-700">
          Hanya superadmin yang bisa mengelola akun admin.
        </div>
      )}
      {error && (
        <div className="rounded-2xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-600">
          {error}
        </div>
      )}

      <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        {role !== "superadmin" ? (
          <p className="text-sm text-slate-500">Akses dibatasi.</p>
        ) : loading ? (
          <p className="text-sm text-slate-500">Memuat admin...</p>
        ) : filtered.length === 0 ? (
          <p className="text-sm text-slate-500">Belum ada admin.</p>
        ) : (
          <div className="space-y-3">
            {filtered.map((user) => (
              <div
                key={user.id}
                className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm"
              >
                <div>
                  <p className="font-semibold text-slate-900">{user.username}</p>
                  <p className="text-xs text-slate-500">
                    Role: {user.role} • Dibuat{" "}
                    {new Date(user.createdAt).toLocaleDateString("id-ID")}
                  </p>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <span
                    className={`rounded-full px-3 py-1 text-[10px] font-semibold uppercase tracking-wide ${
                      user.isActive
                        ? "bg-emerald-100 text-emerald-700"
                        : "bg-slate-200 text-slate-600"
                    }`}
                  >
                    {user.isActive ? "Aktif" : "Nonaktif"}
                  </span>
                  <button
                    onClick={() => setResetTarget(user)}
                    className="rounded-lg border border-slate-300 px-3 py-1.5 text-xs font-semibold text-slate-600 transition hover:bg-slate-50"
                    disabled={role !== "superadmin"}
                  >
                    Reset Password
                  </button>
                  <button
                    onClick={async () => {
                      const res = await fetch(`/api/admin/users/${user.id}/toggle`, {
                        method: "POST",
                      });
                      const data = await res.json();
                      if (!res.ok) {
                        push(data?.reason ?? "Gagal ubah status admin", "error");
                        return;
                      }
                      push("Status admin diperbarui", "success");
                      setUsers((prev) =>
                        prev.map((item) =>
                          item.id === user.id
                            ? { ...item, isActive: data?.isActive ?? !item.isActive }
                            : item
                        )
                      );
                    }}
                    className="rounded-lg border border-amber-200 px-3 py-1.5 text-xs font-semibold text-amber-700 transition hover:bg-amber-50"
                    disabled={role !== "superadmin"}
                  >
                    {user.isActive ? "Nonaktifkan" : "Aktifkan"}
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {createOpen && (
        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h2 className="text-sm font-semibold text-slate-900">Tambah Admin</h2>
            <button
              onClick={() => setCreateOpen(false)}
              className="text-xs font-semibold text-slate-500 hover:text-slate-700"
            >
              Tutup
            </button>
          </div>
          <div className="mt-4 grid gap-3 md:grid-cols-3">
            <input
              value={newUsername}
              onChange={(e) => setNewUsername(e.target.value)}
              placeholder="Username"
              className="rounded-xl border border-slate-200 px-3 py-2 text-sm shadow-sm outline-none focus:border-slate-400"
            />
            <input
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              placeholder="Password"
              type="password"
              className="rounded-xl border border-slate-200 px-3 py-2 text-sm shadow-sm outline-none focus:border-slate-400"
            />
            <select
              value={newRole}
              onChange={(e) => setNewRole(e.target.value)}
              className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm shadow-sm outline-none focus:border-slate-400"
            >
              <option value="admin">Admin</option>
              <option value="superadmin">Superadmin</option>
            </select>
          </div>
          <div className="mt-4 flex justify-end gap-2">
            <button
              onClick={() => setCreateOpen(false)}
              className="rounded-lg border border-slate-300 px-3 py-2 text-xs font-semibold text-slate-600 transition hover:bg-slate-50"
            >
              Batal
            </button>
            <button
              onClick={async () => {
                const res = await fetch("/api/admin/users", {
                  method: "POST",
                  headers: { "Content-Type": "application/json" },
                  body: JSON.stringify({
                    username: newUsername,
                    password: newPassword,
                    role: newRole,
                  }),
                });
                const data = await res.json();
                if (!res.ok) {
                  push(data?.reason ?? "Gagal membuat admin", "error");
                  return;
                }
                push("Admin baru dibuat", "success");
                setNewUsername("");
                setNewPassword("");
                setNewRole("admin");
                setCreateOpen(false);
                loadUsers();
              }}
              className="rounded-lg bg-slate-900 px-4 py-2 text-xs font-semibold text-white transition hover:bg-slate-800"
              disabled={role !== "superadmin"}
            >
              Simpan
            </button>
          </div>
        </div>
      )}

      {resetTarget && (
        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h2 className="text-sm font-semibold text-slate-900">
              Reset password: {resetTarget.username}
            </h2>
            <button
              onClick={() => setResetTarget(null)}
              className="text-xs font-semibold text-slate-500 hover:text-slate-700"
            >
              Tutup
            </button>
          </div>
          <div className="mt-4 flex flex-wrap items-center gap-2">
            <input
              value={resetPassword}
              onChange={(e) => setResetPassword(e.target.value)}
              placeholder="Password baru"
              type="password"
              className="w-full max-w-sm rounded-xl border border-slate-200 px-3 py-2 text-sm shadow-sm outline-none focus:border-slate-400"
            />
            <button
              onClick={async () => {
                const res = await fetch(
                  `/api/admin/users/${resetTarget.id}/reset-password`,
                  {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ password: resetPassword }),
                  }
                );
                const data = await res.json();
                if (!res.ok) {
                  push(data?.reason ?? "Gagal reset password", "error");
                  return;
                }
                push("Password berhasil direset", "success");
                setResetPassword("");
                setResetTarget(null);
              }}
              className="rounded-lg border border-slate-300 px-3 py-2 text-xs font-semibold text-slate-600 transition hover:bg-slate-50"
              disabled={role !== "superadmin"}
            >
              Simpan
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
