"use client";

import { useEffect, useMemo, useState } from "react";
import { useToast } from "@/components/ToastProvider";
import { loadAdminProfile, saveAdminProfile } from "@/components/auth/admin-auth";
import { useAdminSession } from "@/components/auth/useAdminSession";

type VerificationStatus = "NONE" | "PENDING" | "VERIFIED" | "REJECTED";

type VerificationItem = {
  id: number;
  nim: string;
  verificationStatus: VerificationStatus;
  verificationSubmittedAt: string | null;
  verificationSelfiePath: string | null;
  verificationRejectReason: string | null;
  campusName: string | null;
  campusOfficialPhotoUrl: string | null;
};

type Counts = Record<VerificationStatus, number>;

const API_BASE = "http://localhost:4000";

function fmtDate(value?: string | null) {
  if (!value) return "-";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "-";
  return date.toLocaleString("id-ID", {
    dateStyle: "medium",
    timeStyle: "short",
  });
}

function fileUrl(pathValue?: string | null) {
  if (!pathValue) return null;
  const cleaned = pathValue.replace(/^\/+/, "");
  return `${API_BASE}/${cleaned}`;
}

export default function VerificationAdminPage() {
  const useRelayer = true;
  const { push } = useToast();

  const { isAdminAuthed, refresh } = useAdminSession();
  const [adminUsername, setAdminUsername] = useState(
    process.env.NEXT_PUBLIC_ADMIN_USERNAME ?? "admin"
  );
  const [adminPassword, setAdminPassword] = useState("");
  const [showAdminKey, setShowAdminKey] = useState(false);
  const [status, setStatus] = useState<"PENDING" | "VERIFIED" | "REJECTED" | "ALL">(
    "PENDING"
  );
  const [items, setItems] = useState<VerificationItem[]>([]);
  const [counts, setCounts] = useState<Counts>({
    NONE: 0,
    PENDING: 0,
    VERIFIED: 0,
    REJECTED: 0,
  });
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState("");
  const [rejectReason, setRejectReason] = useState<Record<number, string>>({});
  const [adminKeyError, setAdminKeyError] = useState<string | null>(null);
  const [actionLoading, setActionLoading] = useState<
    Record<number, "approve" | "reject" | null>
  >({});

  useEffect(() => {
    const profile = loadAdminProfile();
    if (profile?.username) {
      setAdminUsername(profile.username);
    }
  }, []);

  const fetchCounts = () => {
    if (!isAdminAuthed) return;
    fetch(`/api/admin/verifications?status=ALL&includeCampus=0`)
      .then((res) => res.json().then((data) => ({ ok: res.ok, data })))
      .then((result) => {
        if (!result.ok) {
          setAdminKeyError(result.data?.reason ?? "Login admin tidak valid");
          return;
        }
        setAdminKeyError(null);
        const nextCounts: Counts = {
          NONE: 0,
          PENDING: 0,
          VERIFIED: 0,
          REJECTED: 0,
        };
        for (const item of result.data.items ?? []) {
          const key = item.verificationStatus as VerificationStatus;
          if (nextCounts[key] !== undefined) nextCounts[key] += 1;
        }
        setCounts(nextCounts);
      })
      .catch(() => {});
  };

  const fetchItems = () => {
    if (!isAdminAuthed) return;
    setLoading(true);
    fetch(`/api/admin/verifications?status=${status}`)
      .then((res) => res.json().then((data) => ({ ok: res.ok, data })))
      .then((result) => {
        if (result.ok) {
          setItems(result.data.items ?? []);
          setAdminKeyError(null);
        } else {
          push(result.data?.reason ?? "Gagal memuat verifikasi", "error");
          setAdminKeyError(result.data?.reason ?? "Login admin tidak valid");
        }
      })
      .catch(() => {
        push("Gagal menghubungi backend", "error");
      })
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    fetchCounts();
  }, [isAdminAuthed]);

  useEffect(() => {
    fetchItems();
  }, [isAdminAuthed, status, push]);

  useEffect(() => {
    if (!isAdminAuthed) return;
    const id = window.setInterval(() => {
      fetchCounts();
      fetchItems();
    }, 10000);
    return () => window.clearInterval(id);
  }, [isAdminAuthed, status]);

  const filteredItems = useMemo(() => {
    const term = search.trim().toLowerCase();
    if (!term) return items;
    return items.filter((item) => item.nim.toLowerCase().includes(term));
  }, [items, search]);

  async function approve(id: number) {
    if (!isAdminAuthed) return;
    setActionLoading((prev) => ({ ...prev, [id]: "approve" }));
    try {
      const res = await fetch(`/api/admin/verifications/${id}/approve`, {
        method: "POST",
      });
      const data = await res.json();
      if (!res.ok) {
        push(data?.reason ?? "Gagal approve", "error");
        return;
      }
      push("Mahasiswa terverifikasi", "success");
      setItems((prev) => prev.filter((item) => item.id !== id));
      fetchCounts();
    } finally {
      setActionLoading((prev) => ({ ...prev, [id]: null }));
    }
  }

  async function reject(id: number) {
    if (!isAdminAuthed) return;
    const reason = (rejectReason[id] ?? "").trim() || "Ditolak";
    setActionLoading((prev) => ({ ...prev, [id]: "reject" }));
    try {
      const res = await fetch(`/api/admin/verifications/${id}/reject`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ reason }),
      });
      const data = await res.json();
      if (!res.ok) {
        push(data?.reason ?? "Gagal reject", "error");
        return;
      }
      push("Verifikasi ditolak", "info");
      setItems((prev) => prev.filter((item) => item.id !== id));
      fetchCounts();
    } finally {
      setActionLoading((prev) => ({ ...prev, [id]: null }));
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.3em] text-amber-500">
            Admin Verification
          </p>
          <h1 className="mt-2 text-2xl font-semibold text-slate-900">
            Review Identitas Mahasiswa
          </h1>
          <p className="mt-2 max-w-2xl text-sm text-slate-500">
            Cocokkan foto resmi kampus dengan selfie terbaru sebelum approve.
          </p>
        </div>
        <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-xs text-slate-600">
          Mode relayer aktif: validasi admin via JWT.
        </div>
      </div>

        {!isAdminAuthed && (
          <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
            <div className="flex flex-wrap items-center justify-between gap-4">
              <div>
                <h2 className="text-sm font-semibold text-slate-900">
                  Akses Panel Verifikasi
                </h2>
                <p className="mt-1 text-xs text-slate-500">
                  Login admin diperlukan untuk mengelola verifikasi.
                </p>
              </div>
              <div className="w-full max-w-md space-y-3">
                <label className="text-xs font-semibold text-slate-600">
                  Username
                  <input
                    value={adminUsername}
                    onChange={(e) => setAdminUsername(e.target.value)}
                    placeholder="Username admin"
                    className="mt-2 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm shadow-sm outline-none focus:border-slate-400"
                  />
                </label>
                <label className="text-xs font-semibold text-slate-600">
                  Password
                  <div className="mt-2 flex items-center gap-2">
                    <input
                      value={adminPassword}
                      onChange={(e) => setAdminPassword(e.target.value)}
                      placeholder="Password admin"
                      className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm shadow-sm outline-none focus:border-slate-400"
                      type={showAdminKey ? "text" : "password"}
                      autoComplete="new-password"
                    />
                    <button
                      type="button"
                      onClick={() => setShowAdminKey((prev) => !prev)}
                      className="rounded-lg border border-slate-200 px-3 py-2 text-xs font-semibold text-slate-600 transition hover:bg-slate-50"
                    >
                      {showAdminKey ? "Sembunyikan" : "Lihat"}
                    </button>
                  </div>
                </label>
                <div className="flex flex-wrap items-center gap-2">
                  <button
                    type="button"
                    onClick={async () => {
                      try {
                        const res = await fetch(`/api/admin/login`, {
                          method: "POST",
                          headers: { "Content-Type": "application/json" },
                          body: JSON.stringify({
                            username: adminUsername,
                            password: adminPassword,
                          }),
                        });
                        const data = await res.json();
                        if (!res.ok) {
                          setAdminKeyError(data?.reason ?? "Login gagal");
                          return;
                        }
                        saveAdminProfile({ username: adminUsername });
                        refresh();
                        setAdminKeyError(null);
                        push("Login admin berhasil", "success");
                      } catch {
                        setAdminKeyError("Gagal menghubungi backend");
                      }
                    }}
                    className="rounded-lg bg-slate-900 px-4 py-2 text-xs font-semibold text-white transition hover:bg-slate-800"
                  >
                    Login Admin
                  </button>
                </div>
                {adminKeyError && (
                  <p className="text-xs text-rose-600">{adminKeyError}</p>
                )}
              </div>
            </div>
          </div>
        )}

        <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div className="flex flex-wrap gap-2">
              {(["PENDING", "VERIFIED", "REJECTED", "ALL"] as const).map((key) => {
                const label =
                  key === "ALL" ? "Semua" : key.charAt(0) + key.slice(1).toLowerCase();
                const count =
                  key === "ALL"
                    ? counts.PENDING + counts.VERIFIED + counts.REJECTED + counts.NONE
                    : counts[key];
                return (
                  <button
                    key={key}
                    onClick={() => setStatus(key)}
                    className={`rounded-full px-4 py-2 text-xs font-semibold transition ${
                      status === key
                        ? "bg-slate-900 text-white"
                        : "border border-slate-200 text-slate-600 hover:bg-slate-50"
                    }`}
                  >
                    {label}{" "}
                    <span className="ml-1 text-[10px] opacity-70">{count}</span>
                  </button>
                );
              })}
            </div>
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Cari NIM..."
              className="w-full max-w-xs rounded-xl border border-slate-200 px-3 py-2 text-sm shadow-sm outline-none focus:border-slate-400"
            />
          </div>

          {!isAdminAuthed ? (
            <p className="mt-4 text-sm text-slate-500">
              Login admin untuk memuat daftar verifikasi.
            </p>
          ) : loading ? (
            <p className="mt-4 text-sm text-slate-500">Memuat data...</p>
          ) : filteredItems.length === 0 ? (
            <p className="mt-4 text-sm text-slate-500">
              Tidak ada data verifikasi untuk status ini.
            </p>
          ) : (
            <div className="mt-6 grid gap-4 md:grid-cols-2">
              {filteredItems.map((item) => {
                const selfieUrl = fileUrl(item.verificationSelfiePath);
                const canReview =
                  item.verificationStatus === "PENDING" &&
                  !!item.campusOfficialPhotoUrl &&
                  !!selfieUrl;
                const isBusy = actionLoading[item.id] != null;
                const isApproving = actionLoading[item.id] === "approve";
                const isRejecting = actionLoading[item.id] === "reject";
                return (
                  <div
                    key={item.id}
                    className="rounded-2xl border border-slate-200 bg-slate-50 p-4"
                  >
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div>
                        <p className="text-sm font-semibold text-slate-900">
                          NIM {item.nim}
                        </p>
                        <p className="text-xs text-slate-500">
                          Diajukan: {fmtDate(item.verificationSubmittedAt)}
                        </p>
                      </div>
                      <span
                        className={`rounded-full px-3 py-1 text-[10px] font-semibold uppercase tracking-wide ${
                          item.verificationStatus === "VERIFIED"
                            ? "bg-emerald-100 text-emerald-700"
                            : item.verificationStatus === "REJECTED"
                            ? "bg-rose-100 text-rose-700"
                            : "bg-amber-100 text-amber-700"
                        }`}
                      >
                        {item.verificationStatus}
                      </span>
                    </div>

                    <div className="mt-4 grid gap-3 sm:grid-cols-2">
                      <div className="overflow-hidden rounded-xl border border-slate-200 bg-white">
                        {item.campusOfficialPhotoUrl ? (
                          <img
                            src={item.campusOfficialPhotoUrl}
                            alt={`Foto resmi ${item.nim}`}
                            className="h-40 w-full object-cover"
                          />
                        ) : (
                          <div className="flex h-40 items-center justify-center text-xs text-slate-400">
                            Foto resmi kampus tidak tersedia
                          </div>
                        )}
                        <div className="border-t border-slate-200 px-3 py-2 text-[11px] font-semibold text-slate-500">
                          Foto resmi kampus {item.campusName ? `- ${item.campusName}` : ""}
                        </div>
                      </div>
                      <div className="overflow-hidden rounded-xl border border-slate-200 bg-white">
                        {selfieUrl ? (
                          <img
                            src={selfieUrl}
                            alt={`Selfie ${item.nim}`}
                            className="h-40 w-full object-cover"
                          />
                        ) : (
                          <div className="flex h-40 items-center justify-center text-xs text-slate-400">
                            Selfie belum diupload
                          </div>
                        )}
                        <div className="border-t border-slate-200 px-3 py-2 text-[11px] font-semibold text-slate-500">
                          Selfie mahasiswa
                        </div>
                      </div>
                    </div>

                    {item.verificationRejectReason && (
                      <p className="mt-3 text-xs text-rose-600">
                        Alasan: {item.verificationRejectReason}
                      </p>
                    )}

                    <div className="mt-4 flex flex-wrap items-center gap-2">
                      <button
                        onClick={() => approve(item.id)}
                        disabled={!canReview || isBusy}
                        className="rounded-lg bg-emerald-600 px-3 py-2 text-xs font-semibold text-white transition hover:bg-emerald-700 disabled:cursor-not-allowed disabled:bg-emerald-300"
                      >
                        {isApproving ? "Menyetujui..." : "Approve"}
                      </button>
                      <button
                        onClick={() => reject(item.id)}
                        disabled={item.verificationStatus !== "PENDING" || isBusy}
                        className="rounded-lg border border-rose-200 px-3 py-2 text-xs font-semibold text-rose-600 transition hover:bg-rose-50 disabled:cursor-not-allowed disabled:border-rose-100 disabled:text-rose-300"
                      >
                        {isRejecting ? "Menolak..." : "Reject"}
                      </button>
                      <input
                        value={rejectReason[item.id] ?? ""}
                        onChange={(e) =>
                          setRejectReason((prev) => ({
                            ...prev,
                            [item.id]: e.target.value,
                          }))
                        }
                        placeholder="Alasan penolakan"
                        disabled={isBusy}
                        className="flex-1 rounded-lg border border-slate-200 px-3 py-2 text-xs disabled:bg-slate-100"
                      />
                      {selfieUrl && (
                        <a
                          href={selfieUrl}
                          target="_blank"
                          rel="noreferrer"
                          className="text-xs font-semibold text-slate-500 hover:text-slate-700"
                        >
                          Buka selfie
                        </a>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

    </div>
  );
}
