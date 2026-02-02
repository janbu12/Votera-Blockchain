"use client";

import { useEffect, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { readContractQueryKey } from "@wagmi/core/query";
import { useWaitForTransactionReceipt, useWriteContract } from "wagmi";
import { VOTING_ABI, VOTING_ADDRESS } from "@/lib/contract";
import { formatTxToast } from "@/lib/tx";
import { useAdminSession } from "@/components/auth/useAdminSession";
import { useToast } from "@/components/ToastProvider";
import { ElectionRow } from "./ElectionRow";
import { CandidateModal } from "./CandidateModal";
import { isUserRejectedError } from "./utils";

export function AdminActions({ electionIds }: { electionIds: bigint[] }) {
  const { push } = useToast();
  const adminMode = (process.env.NEXT_PUBLIC_ADMIN_MODE ?? "wallet").toLowerCase();
  const useRelayer = adminMode === "relayer";
  const { isAdminAuthed } = useAdminSession();
  const canRelay = useRelayer && isAdminAuthed;
  const [title, setTitle] = useState("");
  const [candidateName, setCandidateName] = useState("");
  const [activeElectionId, setActiveElectionId] = useState<bigint | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [statusElectionId, setStatusElectionId] = useState<bigint | null>(null);

  const [createRelayHash, setCreateRelayHash] = useState<`0x${string}` | null>(null);
  const [isCreatingRelayer, setIsCreatingRelayer] = useState(false);
  const {
    data: createHash,
    isPending: isCreatingWallet,
    writeContract: createElection,
    error: createError,
  } = useWriteContract();
  const activeCreateHash = useRelayer ? createRelayHash : createHash;
  const {
    data: createReceipt,
    isLoading: isCreateConfirming,
    isSuccess: isCreateSuccess,
  } = useWaitForTransactionReceipt({
    hash: activeCreateHash ?? undefined,
    confirmations: 1,
    query: { enabled: !!activeCreateHash },
  });

  const [statusRelayHash, setStatusRelayHash] = useState<`0x${string}` | null>(null);
  const [isChangingStatusRelayer, setIsChangingStatusRelayer] = useState(false);
  const {
    data: statusHash,
    isPending: isChangingStatusWallet,
    writeContract: changeStatus,
    error: statusError,
  } = useWriteContract();
  const activeStatusHash = useRelayer ? statusRelayHash : statusHash;
  const {
    data: statusReceipt,
    isLoading: isStatusConfirming,
    isSuccess: isStatusSuccess,
  } = useWaitForTransactionReceipt({
    hash: activeStatusHash ?? undefined,
    confirmations: 1,
    query: { enabled: !!activeStatusHash },
  });

  const queryClient = useQueryClient();

  useEffect(() => {
    if (isCreateSuccess) {
      queryClient.invalidateQueries({
        queryKey: readContractQueryKey({
          address: VOTING_ADDRESS,
          abi: VOTING_ABI,
          functionName: "electionsCount",
        }),
      });
      push(
        formatTxToast(
          "Event berhasil dibuat",
          activeCreateHash ?? undefined,
          createReceipt?.blockNumber
        ),
        "success"
      );
      setTimeout(() => {
        setTitle("");
      }, 0);
    }
  }, [isCreateSuccess, queryClient, push]);

  useEffect(() => {
    if (isStatusSuccess && statusElectionId) {
      queryClient.invalidateQueries({
        queryKey: readContractQueryKey({
          address: VOTING_ADDRESS,
          abi: VOTING_ABI,
          functionName: "elections",
          args: [statusElectionId],
        }),
      });
      push(
        formatTxToast(
          "Status pemilihan diperbarui",
          activeStatusHash ?? undefined,
          statusReceipt?.blockNumber
        ),
        "success"
      );
    }
  }, [isStatusSuccess, statusElectionId, queryClient, push]);

  useEffect(() => {
    if (isUserRejectedError(createError)) {
      push("Transaksi dibatalkan", "info");
    }
  }, [createError, push]);

  useEffect(() => {
    if (isUserRejectedError(statusError)) {
      push("Transaksi dibatalkan", "info");
    }
  }, [statusError, push]);

  async function callAdminRelayer<T>(endpoint: string, body: T) {
    if (!isAdminAuthed) {
      push("Login admin diperlukan", "error");
      return null;
    }
    try {
      const res = await fetch(endpoint, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (!res.ok) {
        push(data?.reason ?? "Gagal memproses transaksi", "error");
        return null;
      }
      return data as { hash?: `0x${string}` };
    } catch {
      push("Gagal menghubungi backend", "error");
      return null;
    }
  }

  return (
    <div className="mt-6 space-y-6">
      <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
        <h3 className="text-lg font-semibold text-slate-900">Buat Event Baru</h3>
        <p className="mt-1 text-sm text-slate-500">
          Contoh: Pemilihan BEM 2024
        </p>
        <div className="mt-4 flex flex-wrap gap-3">
          <input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Judul event"
            className="w-full max-w-md rounded-lg border border-slate-200 px-3 py-2 text-sm shadow-sm outline-none focus:border-slate-400"
          />
          <button
            onClick={() =>
              (async () => {
                if (useRelayer) {
                  if (!canRelay) {
                    push("Login admin diperlukan", "error");
                    return;
                  }
                  setIsCreatingRelayer(true);
                  const result = await callAdminRelayer("/api/admin/chain/create-election", {
                    title: title.trim(),
                  });
                  if (result?.hash) setCreateRelayHash(result.hash);
                  setIsCreatingRelayer(false);
                } else {
                  createElection({
                    address: VOTING_ADDRESS,
                    abi: VOTING_ABI,
                    functionName: "createElection",
                    args: [title.trim()],
                  });
                }
              })()
            }
            disabled={
              isCreatingWallet ||
              isCreatingRelayer ||
              isCreateConfirming ||
              title.trim().length === 0 ||
              (useRelayer && !canRelay)
            }
            className="rounded-lg bg-slate-900 px-4 py-2 text-sm font-semibold text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:bg-slate-400"
          >
            {isCreatingWallet || isCreatingRelayer
              ? useRelayer
                ? "Mengirim..."
                : "Menunggu MetaMask..."
              : isCreateConfirming
              ? "Mengonfirmasi..."
              : "Buat"}
          </button>
        </div>
        {createError && !isUserRejectedError(createError) && (
          <p className="mt-3 text-sm text-red-600">{createError.message}</p>
        )}
      </div>

      <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h3 className="text-lg font-semibold text-slate-900">
              Daftar Event
            </h3>
            <p className="text-sm text-slate-500">
              Kelola status pemilihan dan kandidat dari daftar event.
            </p>
          </div>
        </div>

        {electionIds.length === 0 ? (
          <p className="mt-4 text-sm text-slate-500">
            Belum ada event. Buat event terlebih dulu.
          </p>
        ) : (
          <div className="mt-4 space-y-3">
            {electionIds.map((id) => (
              <ElectionRow
                key={id.toString()}
                electionId={id}
                onAddCandidate={() => {
                  setActiveElectionId(id);
                  setCandidateName("");
                  setIsModalOpen(true);
                }}
                onToggleStatus={(isOpen) => {
                  setStatusElectionId(id);
                  if (useRelayer) {
                    if (!canRelay) {
                      push("Login admin diperlukan", "error");
                      return;
                    }
                    setIsChangingStatusRelayer(true);
                    callAdminRelayer(
                      isOpen
                        ? "/api/admin/chain/close-election"
                        : "/api/admin/chain/open-election",
                      { electionId: id.toString() }
                    ).then((result) => {
                      if (result?.hash) setStatusRelayHash(result.hash);
                      setIsChangingStatusRelayer(false);
                    });
                    return;
                  }
                  changeStatus({
                    address: VOTING_ADDRESS,
                    abi: VOTING_ABI,
                    functionName: isOpen ? "closeElection" : "openElection",
                    args: [id],
                  });
                }}
                isStatusPending={
                  isChangingStatusWallet || isChangingStatusRelayer || isStatusConfirming
                }
              />
            ))}
          </div>
        )}

        {statusError && !isUserRejectedError(statusError) && (
          <p className="mt-3 text-sm text-red-600">{statusError.message}</p>
        )}
      </div>

      <CandidateModal
        open={isModalOpen}
        electionIds={electionIds}
        activeElectionId={activeElectionId}
        candidateName={candidateName}
        onCandidateNameChange={setCandidateName}
        onClose={() => setIsModalOpen(false)}
      />
    </div>
  );
}
