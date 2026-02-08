"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useConnection, useReadContract } from "wagmi";
import { VOTING_ABI, VOTING_ADDRESS } from "@/lib/contract";
import { Candidates } from "@/components/Candidates";

export function VerificationStepper({
  status,
}: {
  status: "NONE" | "PENDING" | "VERIFIED" | "REJECTED" | null;
}) {
  const steps = [
    { key: "UPLOAD", label: "Upload" },
    { key: "PENDING", label: "Pending" },
    { key: "VERIFIED", label: "Verified" },
  ];

  const isPending = status === "PENDING";
  const activeIndex =
    status === "VERIFIED" ? 2 : status === "PENDING" ? 1 : 0;

  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-4">
      <p className="text-xs font-semibold uppercase tracking-[0.3em] text-slate-400">
        Status Verifikasi
      </p>
      <div className="mt-4 flex flex-wrap items-center gap-3 sm:flex-nowrap">
        {steps.map((step, index) => {
          const isActive = index <= activeIndex;
          const isCurrent = index === activeIndex;
          return (
            <div key={step.key} className="flex min-w-0 items-center gap-3">
              <div
                className={`grid h-8 w-8 place-items-center rounded-full text-xs font-semibold ${
                  isActive
                    ? isPending && isCurrent
                      ? "bg-amber-500 text-white"
                      : "bg-emerald-600 text-white"
                    : "bg-slate-200 text-slate-500"
                }`}
              >
                {index + 1}
              </div>
              <div className="min-w-[64px] text-xs font-semibold text-slate-600">
                {step.label}
              </div>
              {index < steps.length - 1 && (
                <div
                  className={`h-0.5 flex-1 rounded-full ${
                    index < activeIndex
                      ? isPending
                        ? "bg-amber-400"
                        : "bg-emerald-500"
                      : "bg-slate-200"
                  }`}
                />
              )}
            </div>
          );
        })}
      </div>
      {status === "REJECTED" && (
        <p className="mt-3 text-xs text-rose-600">
          Verifikasi ditolak. Upload ulang dengan data yang jelas.
        </p>
      )}
    </div>
  );
}

export function VoteHistoryPanel({
  items,
  loading,
}: {
  items: {
    electionId: string;
    candidateId: string;
    txHash: string;
    mode: string;
    createdAt: string;
  }[];
  loading: boolean;
}) {
  if (loading) {
    return (
      <div className="rounded-2xl border border-slate-200 bg-white p-4 text-sm text-slate-500">
        Memuat riwayat voting...
      </div>
    );
  }

  if (items.length === 0) {
    return (
      <div className="rounded-2xl border border-slate-200 bg-white p-4 text-sm text-slate-500">
        Belum ada riwayat voting.
      </div>
    );
  }

  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-4">
      <p className="text-xs font-semibold uppercase tracking-[0.3em] text-slate-400">
        Riwayat Voting
      </p>
      <div className="mt-4 space-y-3">
        {items.map((item) => (
          <VoteHistoryRow key={`${item.txHash}-${item.electionId}`} item={item} />
        ))}
      </div>
    </div>
  );
}

function VoteHistoryRow({
  item,
}: {
  item: {
    electionId: string;
    candidateId: string;
    txHash: string;
    mode: string;
    createdAt: string;
  };
}) {
  const explorerBase = process.env.NEXT_PUBLIC_BLOCK_EXPLORER_URL ?? "";
  const electionId = BigInt(item.electionId);
  const candidateId = BigInt(item.candidateId);
  const { data: election } = useReadContract({
    address: VOTING_ADDRESS,
    abi: VOTING_ABI,
    functionName: "getElection",
    args: [electionId],
    query: { refetchInterval: 10000 },
  });
  const { data: candidate } = useReadContract({
    address: VOTING_ADDRESS,
    abi: VOTING_ABI,
    functionName: "getCandidate",
    args: [electionId, candidateId],
  });

  const title = election ? String(election[0]) : `Event #${item.electionId}`;
  const candidateName = candidate ? String(candidate[1]) : `Kandidat #${item.candidateId}`;
  const shortHash = `${item.txHash.slice(0, 6)}...${item.txHash.slice(-4)}`;
  const explorerUrl =
    explorerBase && item.txHash ? `${explorerBase}/tx/${item.txHash}` : null;

  return (
    <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-slate-200 bg-slate-50 p-3 text-xs text-slate-600">
      <div>
        <p className="text-sm font-semibold text-slate-900">{title}</p>
        <p className="text-xs text-slate-500">
          {candidateName} • {new Date(item.createdAt).toLocaleString("id-ID")}
        </p>
        <p className="mt-1 text-[10px] uppercase text-slate-400">
          Mode: {item.mode}
        </p>
      </div>
      <div className="text-right text-[11px] text-slate-500">
        {explorerUrl ? (
          <a
            href={explorerUrl}
            target="_blank"
            rel="noreferrer"
            className="font-semibold text-slate-700 hover:text-slate-900"
          >
            Tx {shortHash}
          </a>
        ) : (
          <>Tx {shortHash}</>
        )}
      </div>
    </div>
  );
}

export function NoticeCard({ text }: { text: string }) {
  return (
    <div className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-700">
      {text}
    </div>
  );
}

export function ActiveEventSummary({ onGoVote }: { onGoVote: () => void }) {
  const [count, setCount] = useState<number | null>(null);
  const [loading, setLoading] = useState(false);
  const pollIntervalMs = 10000;

  useEffect(() => {
    let ignore = false;
    const fetchStatus = () => {
      setLoading(true);
      fetch("/api/public/progress")
        .then((res) => res.json().then((data) => ({ ok: res.ok, data })))
        .then((result) => {
          if (ignore) return;
          if (result.ok) {
            setCount((result.data.items ?? []).length);
          } else {
            setCount(0);
          }
        })
        .catch(() => {
          if (!ignore) setCount(0);
        })
        .finally(() => {
          if (!ignore) setLoading(false);
        });
    };
    fetchStatus();
    const id = window.setInterval(fetchStatus, pollIntervalMs);
    return () => {
      ignore = true;
      window.clearInterval(id);
    };
  }, []);

  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-4">
      <p className="text-xs font-semibold uppercase tracking-[0.3em] text-slate-400">
        Status Voting Aktif
      </p>
      <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
        <p className="text-sm text-slate-600">
          {loading
            ? "Memuat status..."
            : count === 0
            ? "Belum ada event aktif saat ini."
            : `${count} event aktif sedang berlangsung.`}
        </p>
        <button
          onClick={onGoVote}
          className="rounded-lg bg-slate-900 px-4 py-2 text-xs font-semibold text-white transition hover:bg-slate-800"
        >
          Mulai Voting
        </button>
      </div>
    </div>
  );
}

export function ProfileCard({
  nim,
  campusName,
  status,
  reason,
}: {
  nim: string;
  campusName: string | null;
  status: string | null;
  reason: string | null;
}) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-4 text-sm text-slate-600">
      <p>
        NIM: <span className="font-semibold">{nim}</span>
      </p>
      <p className="mt-1">
        Nama kampus: <span className="font-semibold">{campusName ?? "-"}</span>
      </p>
      <p className="mt-1">
        Status verifikasi: <span className="font-semibold">{status ?? "-"}</span>
      </p>
      {reason && (
        <p className="mt-1 text-xs text-rose-600">Alasan ditolak: {reason}</p>
      )}
    </div>
  );
}

export function OpenElections({ onSelect }: { onSelect: (id: bigint) => void }) {
  const { isConnected } = useConnection();
  const { data: count, isLoading, error } = useReadContract({
    address: VOTING_ADDRESS,
    abi: VOTING_ABI,
    functionName: "electionsCount",
    query: { refetchInterval: 10000 },
  });

  const electionIds = useMemo(() => {
    const n = Number(count ?? BigInt(0));
    return Array.from({ length: n }, (_, i) => BigInt(i + 1));
  }, [count]);

  if (isLoading) return <p className="text-sm text-slate-500">Memuat event...</p>;
  if (error) return <p className="text-sm text-red-600">Error: {error.message}</p>;
  if (!count || count === BigInt(0)) {
    return <p className="text-sm text-slate-500">Belum ada pemilihan.</p>;
  }

  return (
    <div className="space-y-3">
      <h2 className="text-lg font-semibold text-slate-900">Event Dibuka</h2>
      <div className="grid gap-3 md:grid-cols-2">
        {electionIds.map((id) => (
          <OpenElectionCard key={id.toString()} electionId={id} onSelect={onSelect} />
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
    functionName: "getElection",
    args: [electionId],
    query: { refetchInterval: 10000 },
  });
  const [nimVoted, setNimVoted] = useState(false);
  const [checkingVote, setCheckingVote] = useState(false);
  const pollIntervalMs = 5000;

  useEffect(() => {
    let ignore = false;
    const fetchVoteStatus = () => {
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
    };
    fetchVoteStatus();
    const id = window.setInterval(fetchVoteStatus, pollIntervalMs);
    return () => {
      ignore = true;
      window.clearInterval(id);
    };
  }, [electionId]);

  if (!election) {
    return (
      <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
        <p className="text-sm text-slate-500">Memuat event...</p>
      </div>
    );
  }

  const [title, isOpen, _mode, _startTime, _endTime, candidatesCount, activeCandidatesCount] =
    election;
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
      <div className="mt-4 rounded-xl border border-slate-100 bg-slate-50 p-3 text-xs text-slate-600">
        Perolehan suara disembunyikan hingga hasil dipublikasikan.
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


export function VerificationCard({
  status,
  reason,
  campusName,
  campusOfficialPhotoUrl,
  uploading,
  uploadMsg,
  onUpload,
  onSelfieFileChange,
  selfiePreview,
}: {
  status: "NONE" | "PENDING" | "VERIFIED" | "REJECTED" | null;
  reason: string | null;
  campusName: string | null;
  campusOfficialPhotoUrl: string | null;
  uploading: boolean;
  uploadMsg: string | null;
  onUpload: () => void;
  onSelfieFileChange: (file: File | null) => void;
  selfiePreview: string | null;
}) {
  const isRejected = status === "REJECTED";
  const isPending = status === "PENDING";

  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-sm font-semibold text-slate-900">
            Verifikasi Identitas Mahasiswa
          </p>
          <p className="mt-1 text-xs text-slate-500">
            Foto resmi kampus dipakai sebagai acuan. Upload selfie terbaru untuk verifikasi.
          </p>
          {isRejected && reason && (
            <p className="mt-2 text-xs text-rose-600">Alasan: {reason}</p>
          )}
          {isPending && (
            <p className="mt-2 text-xs text-amber-600">
              Menunggu konfirmasi admin.
            </p>
          )}
        </div>
        <span className="rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1 text-[10px] font-semibold uppercase text-emerald-700">
          {status ?? "NONE"}
        </span>
      </div>
      <div className="mt-4 grid gap-4 md:grid-cols-2">
        <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4 text-sm text-slate-600">
          <span className="text-xs font-semibold text-slate-700">
            Foto Resmi Kampus {campusName ? `- ${campusName}` : ""}
          </span>
          <div className="mt-3 h-32 overflow-hidden rounded-xl border border-dashed border-slate-200 bg-white">
            {campusOfficialPhotoUrl ? (
              <img
                src={campusOfficialPhotoUrl}
                alt="Foto resmi kampus"
                className="h-full w-full object-cover"
              />
            ) : (
              <div className="flex h-full items-center justify-center text-xs text-slate-300">
                Foto resmi kampus belum tersedia
              </div>
            )}
          </div>
        </div>
        <UploadCard
          label="Foto Selfie"
          preview={selfiePreview}
          onChange={onSelfieFileChange}
        />
      </div>
      <div className="mt-4 flex flex-wrap items-center gap-2">
        <button
          onClick={onUpload}
          disabled={uploading || isPending}
          className="rounded-xl bg-slate-900 px-4 py-2 text-sm font-semibold text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:bg-slate-400"
        >
          {uploading ? "Mengirim..." : isPending ? "Menunggu" : "Kirim Verifikasi"}
        </button>
        {uploadMsg && <p className="text-xs text-slate-500">{uploadMsg}</p>}
      </div>
    </div>
  );
}

function UploadCard({
  label,
  preview,
  onChange,
}: {
  label: string;
  preview: string | null;
  onChange: (file: File | null) => void;
}) {
  return (
    <label className="rounded-2xl border border-slate-200 bg-slate-50 p-4 text-sm text-slate-600">
      <span className="text-xs font-semibold text-slate-700">{label}</span>
      <div className="mt-2 flex items-center justify-between gap-2">
        <span className="text-xs text-slate-400">
          {preview ? "Foto siap" : "Belum ada file"}
        </span>
        <span className="rounded-lg border border-slate-200 bg-white px-3 py-1 text-xs font-semibold text-slate-600">
          Pilih Foto
        </span>
      </div>
      <input
        type="file"
        accept="image/*"
        className="sr-only"
        onChange={(e) => onChange(e.target.files?.[0] ?? null)}
      />
      <div className="mt-3 h-32 overflow-hidden rounded-xl border border-dashed border-slate-200 bg-white">
        {preview ? (
          <img src={preview} alt={`Preview ${label}`} className="h-full w-full object-cover" />
        ) : (
          <div className="flex h-full items-center justify-center text-xs text-slate-300">
            Preview {label}
          </div>
        )}
      </div>
    </label>
  );
}

export function ChangePasswordCard({
  nim,
  newPassword,
  confirmPassword,
  onNewPasswordChange,
  onConfirmPasswordChange,
  message,
  loading,
  onSubmit,
  onLogout,
}: {
  nim: string;
  newPassword: string;
  confirmPassword: string;
  onNewPasswordChange: (value: string) => void;
  onConfirmPasswordChange: (value: string) => void;
  message: string | null;
  loading: boolean;
  onSubmit: () => void;
  onLogout: () => void;
}) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.3em] text-slate-400">
            Wajib
          </p>
          <h2 className="mt-2 text-lg font-semibold text-slate-900">
            Ubah Password Wajib
          </h2>
          <p className="mt-1 text-xs text-slate-500">NIM: {nim}</p>
        </div>
        <button
          onClick={onLogout}
          className="rounded-xl border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-600 transition hover:bg-slate-50"
        >
          Logout
        </button>
      </div>
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
        <button
          onClick={onSubmit}
          disabled={loading}
          className="rounded-xl bg-slate-900 px-4 py-2 text-sm font-semibold text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:bg-slate-400"
        >
          {loading ? "Menyimpan..." : "Simpan Password"}
        </button>
        {message && <p className="text-xs text-rose-600">{message}</p>}
      </div>
    </div>
  );
}

export function ResultsLinks() {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-4 text-sm text-slate-600">
      Hasil resmi tersedia di halaman publik:
      <div className="mt-3 flex flex-wrap gap-2">
        <Link
          href="/hasil"
          className="rounded-lg bg-slate-900 px-4 py-2 text-xs font-semibold text-white transition hover:bg-slate-800"
        >
          Lihat Hasil Resmi
        </Link>
        <Link
          href="/progres"
          className="rounded-lg border border-slate-300 px-4 py-2 text-xs font-semibold text-slate-600 transition hover:bg-slate-50"
        >
          Lihat Progress Publik
        </Link>
      </div>
    </div>
  );
}
