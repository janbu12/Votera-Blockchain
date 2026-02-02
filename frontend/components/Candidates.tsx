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
import { loadStudentAuth } from "@/components/auth/student-auth";

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
    const n = Number(count ?? 0n);
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
  if (!count || count === 0n) return <p>Belum ada pemilihan.</p>;

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
    functionName: "elections",
    args: [electionId],
  });
  const [nimVoted, setNimVoted] = useState(false);
  const [checkingNimVote, setCheckingNimVote] = useState(false);

  useEffect(() => {
    const auth = loadStudentAuth();
    if (!auth) return;
    let ignore = false;
    setCheckingNimVote(true);
    fetch("http://localhost:4000/auth/vote-status", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${auth.token}`,
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

  if (isLoading) return <p className="text-sm text-slate-500">Loading election...</p>;
  if (error) return <p className="text-sm text-red-600">Error: {error.message}</p>;
  if (!election) return null;

  const [title, isOpen, candidatesCount] = election;

  const ids = useMemo(() => {
    const n = Number(candidatesCount ?? 0n);
    return Array.from({ length: n }, (_, i) => BigInt(i + 1));
  }, [candidatesCount]);

  return (
    <div className="mt-6">
      <h3 className="text-base font-semibold text-slate-900">
        {title}{" "}
        <span className={isOpen ? "text-emerald-600" : "text-slate-400"}>
          ({isOpen ? "Open" : "Closed"})
        </span>
      </h3>
      {candidatesCount === 0n ? (
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
  const studentMode =
    (process.env.NEXT_PUBLIC_STUDENT_MODE ?? "wallet").toLowerCase();
  const useWalletMode = studentMode !== "relayer";

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
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <p className="text-sm font-semibold text-slate-900">{name}</p>
          <p className="text-xs text-slate-500">
            Votes: {voteCount.toString()} • ID {cid.toString()}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            onClick={async () => {
              const auth = loadStudentAuth();
              if (!auth) {
                push("Login mahasiswa diperlukan", "info");
                return;
              }
              setIsSigning(true);
              try {
                if (useWalletMode) {
                  if (!address) {
                    push("Wallet belum terhubung", "info");
                    return;
                  }
                  const res = await fetch(
                    "http://localhost:4000/auth/vote-signature",
                    {
                      method: "POST",
                      headers: {
                        "Content-Type": "application/json",
                        Authorization: `Bearer ${auth.token}`,
                      },
                      body: JSON.stringify({
                        electionId: electionId.toString(),
                        voterAddress: address,
                      }),
                    }
                  );
                  const data = await res.json();
                  if (!res.ok) {
                    if (data?.reason?.toLowerCase?.().includes("nim sudah voting")) {
                      push("NIM sudah voting", "info");
                      onNimVoted();
                      return;
                    }
                    push(data?.reason ?? "Gagal membuat signature", "error");
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
                  const res = await fetch(
                    "http://localhost:4000/auth/vote-relay",
                    {
                      method: "POST",
                      headers: {
                        "Content-Type": "application/json",
                        Authorization: `Bearer ${auth.token}`,
                      },
                      body: JSON.stringify({
                        electionId: electionId.toString(),
                        candidateId: cid.toString(),
                      }),
                    }
                  );
                  const data = await res.json();
                  if (!res.ok) {
                    if (data?.reason?.toLowerCase?.().includes("nim sudah voting")) {
                      push("NIM sudah voting", "info");
                      onNimVoted();
                      return;
                    }
                    push(data?.reason ?? "Gagal submit vote", "error");
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
