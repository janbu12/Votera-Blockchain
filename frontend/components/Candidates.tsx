"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { readContractQueryKey } from "@wagmi/core/query";
import {
  useAccount,
  useReadContract,
  useWaitForTransactionReceipt,
  useWriteContract,
} from "wagmi";
import { VOTING_ABI, VOTING_ADDRESS } from "@/lib/contract";
import { formatTxToast } from "@/lib/tx";
import { useToast } from "@/components/ToastProvider";
import { Modal } from "@/components/Modal";

export function Candidates({
  electionId,
  showSelector = true,
}: {
  electionId?: bigint;
  showSelector?: boolean;
}) {
  const { data: count, isLoading, error } = useReadContract({
    address: VOTING_ADDRESS,
    abi: VOTING_ABI,
    functionName: "electionsCount",
  });

  const electionIds = useMemo(() => {
    const n = Number(count ?? BigInt(0));
    return Array.from({ length: n }, (_, i) => BigInt(i + 1));
  }, [count]);

  const [selectedId, setSelectedId] = useState<bigint | null>(null);
  const resolvedElectionId = electionId ?? selectedId;

  useEffect(() => {
    if (selectedId == null && electionIds.length > 0) {
      setSelectedId(electionIds[0]);
    }
  }, [electionIds, selectedId]);

  if (isLoading) return <p>Loading elections...</p>;
  if (error) return <p className="text-sm text-red-600">Error: {error.message}</p>;
  if (!count || count === BigInt(0)) return <p>Belum ada pemilihan.</p>;

  return (
    <div className="mt-6 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
      <h2 className="text-lg font-semibold text-slate-900">Daftar Pemilihan</h2>
      {showSelector && (
        <div className="mt-4 flex flex-wrap items-center gap-3 text-sm">
          <span className="text-slate-500">Pilih event</span>
          <select
            value={selectedId?.toString() ?? ""}
            onChange={(e) => setSelectedId(BigInt(e.target.value))}
            className="rounded-lg border border-slate-200 px-3 py-2 text-sm shadow-sm outline-none focus:border-slate-400"
          >
            {electionIds.map((id) => (
              <option key={id.toString()} value={id.toString()}>
                #{id.toString()}
              </option>
            ))}
          </select>
        </div>
      )}

      {resolvedElectionId ? (
        <ElectionCandidates electionId={resolvedElectionId} />
      ) : (
        <p className="mt-4 text-sm text-slate-500">
          Pilih pemilihan untuk melihat kandidat.
        </p>
      )}
    </div>
  );
}

function ElectionCandidates({ electionId }: { electionId: bigint }) {
  const { data: election, isLoading, error } = useReadContract({
    address: VOTING_ADDRESS,
    abi: VOTING_ABI,
    functionName: "getElection",
    args: [electionId],
    query: { refetchInterval: 10000 },
  });
  const [nimVoted, setNimVoted] = useState(false);
  const [checkingNimVote, setCheckingNimVote] = useState(false);
  const [schedule, setSchedule] = useState<{
    opensAt: string | null;
    closesAt: string | null;
    mode?: number;
    isOpen?: boolean;
  } | null>(null);
  const [scheduleLoading, setScheduleLoading] = useState(false);

  useEffect(() => {
    let ignore = false;
    setCheckingNimVote(true);
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
        if (!ignore) setCheckingNimVote(false);
      });

    return () => {
      ignore = true;
    };
  }, [electionId]);

  useEffect(() => {
    let ignore = false;
    setScheduleLoading(true);
    fetch(`/api/student/elections/schedule/${electionId.toString()}`)
      .then((res) => res.json().then((data) => ({ ok: res.ok, data })))
      .then((result) => {
        if (ignore) return;
        if (result.ok) {
          setSchedule(result.data?.schedule ?? null);
        } else {
          setSchedule(null);
        }
      })
      .catch(() => {
        if (!ignore) setSchedule(null);
      })
      .finally(() => {
        if (!ignore) setScheduleLoading(false);
      });
    return () => {
      ignore = true;
    };
  }, [electionId]);

  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    const id = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(id);
  }, []);

  if (isLoading) return <p className="text-sm text-slate-500">Loading election...</p>;
  if (error) return <p className="text-sm text-red-600">Error: {error.message}</p>;
  if (!election) return null;

  const [title, isOpen, _mode, _startTime, _endTime, candidatesCount] = election;

  const ids = useMemo(() => {
    const n = Number(candidatesCount ?? BigInt(0));
    return Array.from({ length: n }, (_, i) => BigInt(i + 1));
  }, [candidatesCount]);

  const opensAt = schedule?.opensAt ? new Date(schedule.opensAt) : null;
  const closesAt = schedule?.closesAt ? new Date(schedule.closesAt) : null;
  const countdownText = formatCountdown(now, opensAt, closesAt);

  return (
    <div className="mt-6">
      <h3 className="text-base font-semibold text-slate-900">
        {title}{" "}
        <span className={isOpen ? "text-emerald-600" : "text-slate-400"}>
          ({isOpen ? "Open" : "Closed"})
        </span>
      </h3>
      <div className="mt-2 flex flex-wrap items-center gap-3 text-xs text-slate-500">
        {scheduleLoading ? (
          <span>Memuat jadwal...</span>
        ) : schedule ? (
          <>
            <span>
              Buka:{" "}
              {opensAt ? opensAt.toLocaleString("id-ID") : "Belum diatur"}
            </span>
            <span>
              Tutup:{" "}
              {closesAt ? closesAt.toLocaleString("id-ID") : "Belum diatur"}
            </span>
            {countdownText && (
              <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[11px] font-semibold text-slate-600">
                {countdownText}
              </span>
            )}
          </>
        ) : (
          <span>Jadwal belum diatur</span>
        )}
      </div>
      {candidatesCount === BigInt(0) ? (
        <p className="mt-3 text-sm text-slate-500">
          Belum ada kandidat untuk event ini.
        </p>
      ) : (
        <ul className="mt-4 space-y-3">
          {ids.map((id) => (
            <CandidateRow
              key={`${electionId.toString()}-${id.toString()}`}
              electionId={electionId}
              id={id}
              isOpen={isOpen}
              nimAlreadyVoted={nimVoted}
              onNimVoted={() => setNimVoted(true)}
            />
          ))}
        </ul>
      )}
      {checkingNimVote && (
        <p className="mt-2 text-xs text-slate-400">Memeriksa status voting...</p>
      )}
    </div>
  );
}

function CandidateRow({
  electionId,
  id,
  isOpen,
  nimAlreadyVoted,
  onNimVoted,
}: {
  electionId: bigint;
  id: bigint;
  isOpen: boolean;
  nimAlreadyVoted: boolean;
  onNimVoted: () => void;
}) {
  const { address } = useAccount();
  const useWalletMode = false;

  const { data, isLoading, error, refetch } = useReadContract({
    address: VOTING_ADDRESS,
    abi: VOTING_ABI,
    functionName: "getCandidate",
    args: [electionId, id],
  });

  const { data: voted } = useReadContract({
    address: VOTING_ADDRESS,
    abi: VOTING_ABI,
    functionName: "hasVoted",
    args: address ? [electionId, address] : undefined,
    query: { enabled: useWalletMode && !!address },
  });

  const alreadyVoted = useWalletMode
    ? voted === true || nimAlreadyVoted
    : nimAlreadyVoted;

  const { data: hash, isPending, writeContract, error: writeError } =
    useWriteContract();
  const [relayHash, setRelayHash] = useState<`0x${string}` | null>(null);
  const activeHash = useWalletMode ? hash : relayHash;
  const {
    data: voteReceipt,
    isLoading: isConfirming,
    isSuccess: isVoteSuccess,
  } = useWaitForTransactionReceipt({
    hash: activeHash ?? undefined,
    confirmations: 1,
    query: { enabled: !!activeHash },
  });

  const queryClient = useQueryClient();
  const { push } = useToast();
  const [isSigning, setIsSigning] = useState(false);
  const handledHashRef = useRef<`0x${string}` | null>(null);
  const [isProfileOpen, setIsProfileOpen] = useState(false);
  const [profileLoading, setProfileLoading] = useState(false);
  const [profileError, setProfileError] = useState<string | null>(null);
  const backendBase = process.env.NEXT_PUBLIC_BACKEND_URL ?? "http://localhost:4000";
  const [profile, setProfile] = useState<{
    tagline: string | null;
    about: string | null;
    visi: string | null;
    misi: string | null;
    programKerja: string | null;
    photoUrl?: string | null;
  } | null>(null);
  const [photoUrl, setPhotoUrl] = useState<string | null>(null);

  useEffect(() => {
    if (isVoteSuccess && activeHash) {
      if (handledHashRef.current === activeHash) return;
      handledHashRef.current = activeHash;
      queryClient.invalidateQueries({
        queryKey: readContractQueryKey({
          address: VOTING_ADDRESS,
          abi: VOTING_ABI,
          functionName: "getCandidate",
          args: [electionId, id],
        }),
      });
      if (address) {
        queryClient.invalidateQueries({
          queryKey: readContractQueryKey({
            address: VOTING_ADDRESS,
            abi: VOTING_ABI,
            functionName: "hasVoted",
            args: [electionId, address],
          }),
        });
      }
      push(
        formatTxToast("Voting berhasil", activeHash, voteReceipt?.blockNumber),
        "success"
      );
      if (useWalletMode && activeHash) {
        fetch("/api/student/vote-log", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            electionId: electionId.toString(),
            candidateId: id.toString(),
            txHash: activeHash,
          }),
        }).catch(() => {});
      }
      onNimVoted();
    }
  }, [
    isVoteSuccess,
    activeHash,
    queryClient,
    electionId,
    id,
    address,
    push,
    onNimVoted,
  ]);

  useEffect(() => {
    if (isUserRejectedError(writeError)) {
      push("Transaksi dibatalkan", "info");
      return;
    }
    if (writeError && isKnownVoteError(writeError)) {
      push("NIM sudah voting", "info");
      return;
    }
    if (writeError) {
      push("Voting gagal", "error");
    }
  }, [writeError, push]);

  const openProfile = async () => {
    setIsProfileOpen(true);
    setProfileError(null);
    setProfileLoading(true);
    try {
      const res = await fetch(
        `/api/student/candidates/${electionId.toString()}/${id.toString()}`
      );
      const data = await res.json();
      if (!res.ok) {
        setProfileError(data?.reason ?? "Gagal memuat profil kandidat");
        setProfile(null);
      } else {
        if (data?.profile?.photoUrl && data.profile.photoUrl.startsWith("/")) {
          data.profile.photoUrl = `${backendBase}${data.profile.photoUrl}`;
        }
        setProfile(data?.profile ?? null);
      }
    } catch {
      setProfileError("Gagal menghubungi backend");
      setProfile(null);
    } finally {
      setProfileLoading(false);
    }
  };

  useEffect(() => {
    let ignore = false;
    fetch(`/api/student/candidates/${electionId.toString()}/${id.toString()}`)
      .then((res) => res.json().then((data) => ({ ok: res.ok, data })))
      .then((result) => {
        if (ignore) return;
        if (result.ok && result.data?.profile?.photoUrl) {
          const raw = result.data.profile.photoUrl;
          const resolved = raw.startsWith("/") ? `${backendBase}${raw}` : raw;
          setPhotoUrl(resolved);
        }
      })
      .catch(() => {
        if (!ignore) setPhotoUrl(null);
      });
    return () => {
      ignore = true;
    };
  }, [backendBase, electionId, id]);

  if (isLoading) return <li className="text-sm">Loading kandidat #{id.toString()}...</li>;
  if (error)
    return (
      <li className="text-sm text-red-600">
        Error kandidat #{id.toString()}: {error.message}
      </li>
    );
  if (!data) return null;

  const [cid, name, voteCount, isActive] = data;
  if (!isActive) return null;
  const disabled =
    !isOpen || alreadyVoted || isPending || isConfirming || isSigning;

    return (
      <li className="rounded-xl border border-slate-200 bg-slate-50 p-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            {photoUrl ? (
              <img
                src={photoUrl}
                alt={`Foto ${name}`}
                className="h-12 w-12 rounded-full object-cover"
              />
            ) : (
              <div className="flex h-12 w-12 items-center justify-center rounded-full bg-white text-[10px] text-slate-400">
                Foto
              </div>
            )}
            <div>
              <p className="text-sm font-semibold text-slate-900">{name}</p>
              <p className="text-xs text-slate-500">Profil & visi misi kandidat.</p>
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            <button
              onClick={openProfile}
              className="rounded-lg border border-slate-300 px-3 py-2 text-xs font-semibold text-slate-600 transition hover:bg-white"
            >
              Lihat Profil
          </button>
          <button
            onClick={async () => {
              setIsSigning(true);
              try {
                if (useWalletMode) {
                  if (!address) {
                    push("Wallet belum terhubung", "info");
                    return;
                  }
                  const res = await fetch("/api/student/vote-signature", {
                    method: "POST",
                    headers: {
                      "Content-Type": "application/json",
                    },
                    body: JSON.stringify({
                      electionId: electionId.toString(),
                      voterAddress: address,
                    }),
                  });
                  const data = await res.json();
                  if (!res.ok) {
                    if (data?.reason?.toLowerCase?.().includes("nim sudah voting")) {
                      push("NIM sudah voting", "info");
                      onNimVoted();
                      return;
                    }
                    if (res.status === 401) {
                      push("Login mahasiswa diperlukan", "info");
                    } else {
                      push(data?.reason ?? "Gagal membuat signature", "error");
                    }
                    return;
                  }

                  writeContract({
                    address: VOTING_ADDRESS,
                    abi: VOTING_ABI,
                    functionName: "vote",
                    args: [
                      electionId,
                      cid,
                      data.nimHash,
                      BigInt(data.deadline),
                      data.signature,
                    ],
                  });
                } else {
                  const res = await fetch("/api/student/vote-relay", {
                    method: "POST",
                    headers: {
                      "Content-Type": "application/json",
                    },
                    body: JSON.stringify({
                      electionId: electionId.toString(),
                      candidateId: cid.toString(),
                    }),
                  });
                  const data = await res.json();
                  if (!res.ok) {
                    if (data?.reason?.toLowerCase?.().includes("nim sudah voting")) {
                      push("NIM sudah voting", "info");
                      onNimVoted();
                      return;
                    }
                    if (res.status === 401) {
                      push("Login mahasiswa diperlukan", "info");
                    } else {
                      push(data?.reason ?? "Gagal submit vote", "error");
                    }
                    return;
                  }
                  setRelayHash(data.hash as `0x${string}`);
                }
              } catch {
                push("Gagal menghubungi backend", "error");
              } finally {
                setIsSigning(false);
              }
            }}
            disabled={disabled}
            title={
              !isOpen
                ? "Pemilihan masih ditutup"
                : alreadyVoted
                ? "Kamu sudah melakukan voting"
                : ""
            }
            className={`rounded-lg px-3 py-2 text-xs font-semibold transition ${
              disabled
                ? "cursor-not-allowed bg-slate-200 text-slate-500"
                : "bg-slate-900 text-white hover:bg-slate-800"
            }`}
          >
            {!isOpen
              ? "Ditutup"
              : alreadyVoted
              ? "Sudah Voting"
              : isSigning
              ? useWalletMode
                ? "Menyiapkan signature..."
                : "Mengirim vote..."
              : isPending
              ? "Menunggu MetaMask..."
              : isConfirming
              ? "Mengonfirmasi..."
              : "Vote"}
          </button>

          <button
            onClick={() => {
              refetch();
            }}
            className="rounded-lg border border-slate-300 px-3 py-2 text-xs font-semibold text-slate-600 transition hover:bg-white"
          >
            Refresh
          </button>
        </div>
      </div>

      {writeError &&
        !isUserRejectedError(writeError) &&
        !isKnownVoteError(writeError) && (
          <p className="mt-2 text-xs text-red-600">{writeError.message}</p>
        )}

      <Modal
        open={isProfileOpen}
        title="Profil Kandidat"
        description={name}
        onClose={() => setIsProfileOpen(false)}
        widthClassName="max-w-2xl"
      >
        <div className="space-y-3 text-sm text-slate-600">
          {profileLoading ? (
            <p>Memuat profil...</p>
          ) : profileError ? (
            <p className="text-rose-600">{profileError}</p>
          ) : (
            <>
              {profile?.photoUrl && (
                <div className="overflow-hidden rounded-xl border border-slate-200 bg-slate-50">
                  <img
                    src={profile.photoUrl}
                    alt={`Foto ${name}`}
                    className="w-full object-contain"
                  />
                </div>
              )}
              <section className="rounded-xl border border-slate-200 bg-slate-50 p-3">
                <p className="text-xs font-semibold text-slate-700">Tagline</p>
                <p className="mt-1 text-sm text-slate-600 whitespace-pre-line">
                  {profile?.tagline || "Belum diisi"}
                </p>
              </section>
              <section className="rounded-xl border border-slate-200 bg-white p-3">
                <p className="text-xs font-semibold text-slate-700">Tentang</p>
                <p className="mt-1 text-sm text-slate-600 whitespace-pre-line">
                  {profile?.about || "Belum diisi"}
                </p>
              </section>
              <section className="rounded-xl border border-slate-200 bg-white p-3">
                <p className="text-xs font-semibold text-slate-700">Visi</p>
                <p className="mt-1 text-sm text-slate-600 whitespace-pre-line">
                  {profile?.visi || "Belum diisi"}
                </p>
              </section>
              <section className="rounded-xl border border-slate-200 bg-white p-3">
                <p className="text-xs font-semibold text-slate-700">Misi</p>
                <p className="mt-1 text-sm text-slate-600 whitespace-pre-line">
                  {profile?.misi || "Belum diisi"}
                </p>
              </section>
              <section className="rounded-xl border border-slate-200 bg-white p-3">
                <p className="text-xs font-semibold text-slate-700">
                  Program Kerja
                </p>
                <p className="mt-1 text-sm text-slate-600 whitespace-pre-line">
                  {profile?.programKerja || "Belum diisi"}
                </p>
              </section>
            </>
          )}
          <div className="flex justify-end pt-2">
            <button
              onClick={() => setIsProfileOpen(false)}
              className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-600 transition hover:bg-slate-50"
            >
              Tutup
            </button>
          </div>
        </div>
      </Modal>
    </li>
  );
}

function isUserRejectedError(error: unknown) {
  if (!error || typeof error !== "object") return false;
  const message =
    "message" in error && typeof error.message === "string"
      ? error.message
      : "";
  return (
    message.toLowerCase().includes("user rejected") ||
    message.toLowerCase().includes("user denied") ||
    message.toLowerCase().includes("denied transaction signature")
  );
}

function isKnownVoteError(error: unknown) {
  if (!error || typeof error !== "object") return false;
  const message =
    "message" in error && typeof error.message === "string"
      ? error.message.toLowerCase()
      : "";
  return message.includes("nim already voted") || message.includes("already voted");
}

function formatCountdown(
  now: number,
  opensAt: Date | null,
  closesAt: Date | null
) {
  const nowMs = now;
  const openMs = opensAt?.getTime() ?? null;
  const closeMs = closesAt?.getTime() ?? null;

  if (openMs && nowMs < openMs) {
    const diff = openMs - nowMs;
    return `Mulai ${formatDuration(diff)}`;
  }
  if (closeMs && nowMs < closeMs) {
    const diff = closeMs - nowMs;
    return `Sisa ${formatDuration(diff)}`;
  }
  if (closeMs && nowMs >= closeMs) {
    return "Jadwal berakhir";
  }
  return null;
}

function formatDuration(ms: number) {
  const totalSeconds = Math.max(0, Math.floor(ms / 1000));
  const days = Math.floor(totalSeconds / 86400);
  const hours = Math.floor((totalSeconds % 86400) / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  if (days > 0) return `${days}h ${hours}j ${minutes}m`;
  if (hours > 0) return `${hours}j ${minutes}m`;
  if (minutes > 0) return `${minutes}m ${seconds}d`;
  return `${seconds}d`;
}
