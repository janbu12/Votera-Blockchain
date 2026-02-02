"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useConnection, useReadContract } from "wagmi";
import { Candidates } from "@/components/Candidates";
import { Connection } from "@/components/connection";
import { WalletOptions } from "@/components/wallet-option";
import { VOTING_ABI, VOTING_ADDRESS } from "@/lib/contract";
import {
  clearStudentAuth,
  loadStudentAuth,
  saveStudentAuth,
} from "@/components/auth/student-auth";

export default function MahasiswaPage() {
  const router = useRouter();
  const [auth, setAuth] = useState(() => loadStudentAuth());
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [changeMsg, setChangeMsg] = useState<string | null>(null);
  const [changing, setChanging] = useState(false);
  const { isConnected } = useConnection();
  const studentMode =
    (process.env.NEXT_PUBLIC_STUDENT_MODE ?? "wallet").toLowerCase();
  const useWalletMode = studentMode !== "relayer";
  const requireVerification =
    (process.env.NEXT_PUBLIC_REQUIRE_STUDENT_VERIFICATION ?? "false").toLowerCase() ===
    "true";
  const [activeElectionId, setActiveElectionId] = useState<bigint | null>(null);
  const [verificationStatus, setVerificationStatus] = useState<
    "NONE" | "PENDING" | "VERIFIED" | "REJECTED" | null
  >(null);
  const [verificationReason, setVerificationReason] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [uploadMsg, setUploadMsg] = useState<string | null>(null);
  const [cardFile, setCardFile] = useState<File | null>(null);
  const [selfieFile, setSelfieFile] = useState<File | null>(null);

  useEffect(() => {
    let ignore = false;
    fetch("/api/student/me")
      .then((res) => res.json().then((data) => ({ ok: res.ok, data })))
      .then((result) => {
        if (ignore) return;
        if (result.ok) {
          const nextAuth = {
            nim: result.data.nim,
            mustChangePassword: !!result.data.mustChangePassword,
          };
          saveStudentAuth(nextAuth);
          setAuth(nextAuth);
          if (requireVerification) {
            setVerificationStatus(result.data.verificationStatus);
          }
        } else {
          setAuth(null);
        }
      })
      .catch(() => {
        if (!ignore) setAuth(null);
      });
    return () => {
      ignore = true;
    };
  }, [requireVerification]);

  useEffect(() => {
    if (!requireVerification) return;
    let ignore = false;
    fetch("/api/student/verification/status")
      .then((res) => res.json().then((data) => ({ ok: res.ok, data })))
      .then((result) => {
        if (ignore) return;
        if (result.ok) {
          setVerificationStatus(result.data.verificationStatus);
          setVerificationReason(result.data.verificationRejectReason ?? null);
        } else {
          setVerificationStatus("NONE");
        }
      })
      .catch(() => {
        if (!ignore) setVerificationStatus("NONE");
      });
    return () => {
      ignore = true;
    };
  }, [requireVerification]);

  return (
    <div className="min-h-screen bg-slate-50 px-6 py-10">
      <div className="mx-auto max-w-4xl">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.3em] text-slate-400">
              Mahasiswa
            </p>
            <h1 className="mt-2 text-2xl font-semibold text-slate-900">
              Voting BEM
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
          {useWalletMode ? (
            isConnected ? (
              <Connection />
            ) : (
              <WalletOptions />
            )
          ) : (
            <div className="rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">
              Mode relayer aktif. Mahasiswa tidak perlu connect wallet.
            </div>
          )}
        </div>

        {!auth ? (
          <div className="mt-4 rounded-2xl border border-slate-200 bg-white p-5 text-sm text-slate-600">
            Kamu belum login. Silakan kembali ke halaman login mahasiswa.
            <div className="mt-3">
              <button
                onClick={() => {
                  if (typeof window !== "undefined") {
                    window.sessionStorage.setItem("forceDisconnect", "1");
                  }
                  router.push("/login");
                }}
                className="rounded-lg bg-slate-900 px-4 py-2 text-xs font-semibold text-white transition hover:bg-slate-800"
              >
                Ke Login
              </button>
            </div>
          </div>
        ) : requireVerification && verificationStatus !== "VERIFIED" ? (
          <VerificationCard
            status={verificationStatus}
            reason={verificationReason}
            uploading={uploading}
            uploadMsg={uploadMsg}
            onUpload={async () => {
              if (!cardFile || !selfieFile) {
                setUploadMsg("Lengkapi foto kartu dan selfie.");
                return;
              }
              setUploading(true);
              setUploadMsg(null);
              try {
                const form = new FormData();
                form.append("card", cardFile);
                form.append("selfie", selfieFile);
                const res = await fetch("/api/student/verification/upload", {
                  method: "POST",
                  body: form,
                });
                const data = await res.json();
                if (!res.ok) {
                  setUploadMsg(data?.reason ?? "Gagal upload verifikasi");
                  return;
                }
                setUploadMsg("Berhasil dikirim. Menunggu verifikasi admin.");
                setVerificationStatus("PENDING");
              } catch {
                setUploadMsg("Gagal menghubungi backend");
              } finally {
                setUploading(false);
              }
            }}
            onCardFileChange={setCardFile}
            onSelfieFileChange={setSelfieFile}
          />
        ) : auth.mustChangePassword ? (
          <ChangePasswordCard
            nim={auth.nim}
            newPassword={newPassword}
            confirmPassword={confirmPassword}
            onNewPasswordChange={setNewPassword}
            onConfirmPasswordChange={setConfirmPassword}
            message={changeMsg}
            loading={changing}
            onLogout={() => {
              fetch("/api/student/logout", { method: "POST" }).catch(() => {});
              clearStudentAuth();
              setAuth(null);
              router.push("/login");
            }}
            onSubmit={async () => {
              setChangeMsg(null);
              if (newPassword.length < 8) {
                setChangeMsg("Password minimal 8 karakter.");
                return;
              }
              if (newPassword !== confirmPassword) {
                setChangeMsg("Konfirmasi password tidak cocok.");
                return;
              }
              setChanging(true);
              try {
                const res = await fetch("/api/student/change-password", {
                  method: "POST",
                  headers: { "Content-Type": "application/json" },
                  body: JSON.stringify({ newPassword }),
                });
                const data = await res.json();
                if (!res.ok) {
                  setChangeMsg(data?.reason ?? "Gagal mengubah password");
                  return;
                }
                const nextAuth = {
                  ...auth,
                  mustChangePassword: false,
                };
                saveStudentAuth(nextAuth);
                setAuth(nextAuth);
                setNewPassword("");
                setConfirmPassword("");
              } catch {
                setChangeMsg(
                  "Backend tidak bisa diakses. Pastikan backend jalan di :4000"
                );
              } finally {
                setChanging(false);
              }
            }}
          />
        ) : useWalletMode && !isConnected ? (
          <p className="mt-4 text-sm text-slate-500">
            Hubungkan wallet untuk mulai voting.
          </p>
        ) : (
          <div className="mt-6 space-y-4">
            <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-700">
              ✅ Login sebagai <span className="font-semibold">{auth.nim}</span>
            </div>
            {activeElectionId ? (
              <div className="space-y-4">
                <button
                  onClick={() => setActiveElectionId(null)}
                  className="text-xs font-semibold text-slate-500 transition hover:text-slate-700"
                >
                  ← Kembali ke daftar event
                </button>
                <Candidates electionId={activeElectionId} showSelector={false} />
              </div>
            ) : (
              <OpenElections onSelect={setActiveElectionId} />
            )}
          </div>
        )}
      </div>
    </div>
  );
}

function VerificationCard({
  status,
  reason,
  uploading,
  uploadMsg,
  onUpload,
  onCardFileChange,
  onSelfieFileChange,
}: {
  status: "NONE" | "PENDING" | "VERIFIED" | "REJECTED" | null;
  reason: string | null;
  uploading: boolean;
  uploadMsg: string | null;
  onUpload: () => void;
  onCardFileChange: (file: File | null) => void;
  onSelfieFileChange: (file: File | null) => void;
}) {
  return (
    <div className="mt-6 rounded-2xl border border-slate-200 bg-white p-5">
      <h3 className="text-sm font-semibold text-slate-900">
        Verifikasi Identitas Mahasiswa
      </h3>
      <p className="mt-2 text-xs text-slate-500">
        Upload foto kartu mahasiswa dan selfie untuk verifikasi.
      </p>

      {status === "PENDING" && (
        <p className="mt-3 text-xs text-amber-600">
          Status: Menunggu verifikasi admin.
        </p>
      )}
      {status === "REJECTED" && (
        <p className="mt-3 text-xs text-rose-600">
          Status: Ditolak. {reason ? `Alasan: ${reason}` : ""}
        </p>
      )}

      <div className="mt-4 grid gap-3 sm:grid-cols-2">
        <label className="text-xs font-semibold text-slate-600">
          Foto Kartu Mahasiswa
          <input
            type="file"
            accept="image/*"
            onChange={(e) => onCardFileChange(e.target.files?.[0] ?? null)}
            className="mt-2 block w-full text-xs"
          />
        </label>
        <label className="text-xs font-semibold text-slate-600">
          Foto Selfie
          <input
            type="file"
            accept="image/*"
            onChange={(e) => onSelfieFileChange(e.target.files?.[0] ?? null)}
            className="mt-2 block w-full text-xs"
          />
        </label>
      </div>

      <div className="mt-4 flex items-center gap-3">
        <button
          onClick={onUpload}
          disabled={uploading}
          className="rounded-lg bg-slate-900 px-4 py-2 text-xs font-semibold text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:bg-slate-400"
        >
          {uploading ? "Mengirim..." : "Kirim Verifikasi"}
        </button>
        {uploadMsg && <p className="text-xs text-slate-500">{uploadMsg}</p>}
      </div>
    </div>
  );
}

function ChangePasswordCard({
  nim,
  newPassword,
  confirmPassword,
  onNewPasswordChange,
  onConfirmPasswordChange,
  message,
  loading,
  onLogout,
  onSubmit,
}: {
  nim: string;
  newPassword: string;
  confirmPassword: string;
  onNewPasswordChange: (value: string) => void;
  onConfirmPasswordChange: (value: string) => void;
  message: string | null;
  loading: boolean;
  onLogout: () => void;
  onSubmit: () => void;
}) {
  return (
    <div className="mt-4 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
      <h2 className="text-lg font-semibold text-slate-900">
        Ubah Password Wajib
      </h2>
      <p className="mt-1 text-sm text-slate-500">
        Halo {nim}, kamu wajib mengganti password sebelum voting.
      </p>

      <div className="mt-4 space-y-3">
        <input
          value={newPassword}
          onChange={(e) => onNewPasswordChange(e.target.value)}
          type="password"
          placeholder="Password baru"
          className="w-full rounded-xl border border-slate-200 px-4 py-3 text-sm shadow-sm outline-none focus:border-slate-400"
        />
        <input
          value={confirmPassword}
          onChange={(e) => onConfirmPasswordChange(e.target.value)}
          type="password"
          placeholder="Konfirmasi password"
          className="w-full rounded-xl border border-slate-200 px-4 py-3 text-sm shadow-sm outline-none focus:border-slate-400"
        />
        <div className="flex flex-wrap gap-2">
          <button
            onClick={onSubmit}
            disabled={loading}
            className="rounded-xl bg-slate-900 px-4 py-2 text-sm font-semibold text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:bg-slate-400"
          >
            {loading ? "Menyimpan..." : "Simpan Password"}
          </button>
          <button
            onClick={onLogout}
            className="rounded-xl border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-600 transition hover:bg-slate-50"
          >
            Logout
          </button>
        </div>
        {message && <p className="text-xs text-rose-600">{message}</p>}
      </div>
    </div>
  );
}

function OpenElections({ onSelect }: { onSelect: (id: bigint) => void }) {
  const { data: count, isLoading, error } = useReadContract({
    address: VOTING_ADDRESS,
    abi: VOTING_ABI,
    functionName: "electionsCount",
  });

  const electionIds = useMemo(() => {
    const n = Number(count ?? 0n);
    return Array.from({ length: n }, (_, i) => BigInt(i + 1));
  }, [count]);

  if (isLoading) return <p className="text-sm text-slate-500">Memuat event...</p>;
  if (error) return <p className="text-sm text-red-600">Error: {error.message}</p>;
  if (!count || count === 0n) {
    return <p className="text-sm text-slate-500">Belum ada pemilihan.</p>;
  }

  return (
    <div className="space-y-3">
      <h2 className="text-lg font-semibold text-slate-900">Event Dibuka</h2>
      <div className="grid gap-3 md:grid-cols-2">
        {electionIds.map((id) => (
          <OpenElectionCard
            key={id.toString()}
            electionId={id}
            onSelect={onSelect}
          />
        ))}
      </div>
    </div>
  );
}

function OpenElectionCard({
  electionId,
  onSelect,
}: {
  electionId: bigint;
  onSelect: (id: bigint) => void;
}) {
  const { data: election } = useReadContract({
    address: VOTING_ADDRESS,
    abi: VOTING_ABI,
    functionName: "elections",
    args: [electionId],
  });
  const [nimVoted, setNimVoted] = useState(false);
  const [checkingVote, setCheckingVote] = useState(false);

  useEffect(() => {
    let ignore = false;
    setCheckingVote(true);
    fetch("/api/student/vote-status", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ electionId: electionId.toString() }),
    })
      .then((res) => res.json().then((data) => ({ ok: res.ok, data })))
      .then((result) => {
        if (ignore) return;
        if (result.ok && result.data?.alreadyVoted === true) {
          setNimVoted(true);
        } else if (result.ok) {
          setNimVoted(false);
        }
      })
      .finally(() => {
        if (!ignore) setCheckingVote(false);
      });

    return () => {
      ignore = true;
    };
  }, [electionId]);

  if (!election) {
    return (
      <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
        <p className="text-sm text-slate-500">Memuat event...</p>
      </div>
    );
  }

  const [title, isOpen, candidatesCount, activeCandidatesCount] = election;
  if (!isOpen) return null;

  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <p className="text-sm text-emerald-600">Open</p>
            {nimVoted && (
              <span className="rounded-full bg-slate-200 px-2 py-0.5 text-[10px] font-semibold uppercase text-slate-600">
                Sudah Vote
              </span>
            )}
          </div>
          <h3 className="mt-1 text-base font-semibold text-slate-900">{title}</h3>
          <p className="text-xs text-slate-500">
            Kandidat aktif: {activeCandidatesCount.toString()}
          </p>
        </div>
        <span className="rounded-full bg-emerald-50 px-3 py-1 text-xs font-semibold text-emerald-700">
          #{electionId.toString()}
        </span>
      </div>
      <div className="mt-4 space-y-2 rounded-xl border border-slate-100 bg-slate-50 p-3 text-xs text-slate-600">
        <p className="font-semibold text-slate-500">Perolehan suara</p>
        <CandidateCounts electionId={electionId} candidatesCount={candidatesCount} />
      </div>
      {checkingVote && (
        <p className="mt-2 text-[11px] text-slate-400">Memeriksa status voting...</p>
      )}
      <button
        onClick={() => onSelect(electionId)}
        disabled={nimVoted}
        className="mt-4 w-full rounded-lg bg-slate-900 px-4 py-2 text-sm font-semibold text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:bg-slate-300"
      >
        {nimVoted ? "Sudah Voting" : "Masuk Voting"}
      </button>
    </div>
  );
}

function CandidateCounts({
  electionId,
  candidatesCount,
}: {
  electionId: bigint;
  candidatesCount: bigint;
}) {
  const ids = useMemo(() => {
    const n = Number(candidatesCount ?? 0n);
    return Array.from({ length: n }, (_, i) => BigInt(i + 1));
  }, [candidatesCount]);

  if (candidatesCount === 0n) {
    return <p className="text-slate-400">Belum ada kandidat.</p>;
  }

  return (
    <div className="space-y-1">
      {ids.map((id) => (
        <CandidateCountRow
          key={`${electionId.toString()}-${id.toString()}`}
          electionId={electionId}
          candidateId={id}
        />
      ))}
    </div>
  );
}

function CandidateCountRow({
  electionId,
  candidateId,
}: {
  electionId: bigint;
  candidateId: bigint;
}) {
  const { data } = useReadContract({
    address: VOTING_ADDRESS,
    abi: VOTING_ABI,
    functionName: "getCandidate",
    args: [electionId, candidateId],
  });

  if (!data) return <p>Memuat kandidat...</p>;

  const [, name, voteCount, isActive] = data;
  if (!isActive) return null;

  return (
    <div className="flex items-center justify-between gap-2">
      <span className="truncate">{name}</span>
      <span className="font-semibold text-slate-700">{voteCount.toString()}</span>
    </div>
  );
}
