"use client";

import { useEffect, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { readContractQueryKey } from "@wagmi/core/query";
import { useWaitForTransactionReceipt, useWriteContract } from "wagmi";
import { VOTING_ABI, VOTING_ADDRESS } from "@/lib/contract";
import { formatTxToast } from "@/lib/tx";
import { useToast } from "@/components/ToastProvider";
import { ElectionRow } from "./ElectionRow";
import { CandidateModal } from "./CandidateModal";
import { isUserRejectedError } from "./utils";

export function AdminActions({ electionIds }: { electionIds: bigint[] }) {
  const { push } = useToast();
  const [title, setTitle] = useState("");
  const [candidateName, setCandidateName] = useState("");
  const [activeElectionId, setActiveElectionId] = useState<bigint | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [statusElectionId, setStatusElectionId] = useState<bigint | null>(null);

  const {
    data: createHash,
    isPending: isCreating,
    writeContract: createElection,
    error: createError,
  } = useWriteContract();
  const {
    data: createReceipt,
    isLoading: isCreateConfirming,
    isSuccess: isCreateSuccess,
  } =
    useWaitForTransactionReceipt({
      hash: createHash,
      confirmations: 1,
      query: { enabled: !!createHash },
    });

  const {
    data: statusHash,
    isPending: isChangingStatus,
    writeContract: changeStatus,
    error: statusError,
  } = useWriteContract();
  const {
    data: statusReceipt,
    isLoading: isStatusConfirming,
    isSuccess: isStatusSuccess,
  } =
    useWaitForTransactionReceipt({
      hash: statusHash,
      confirmations: 1,
      query: { enabled: !!statusHash },
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
        formatTxToast("Event berhasil dibuat", createHash, createReceipt?.blockNumber),
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
          statusHash,
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
              createElection({
                address: VOTING_ADDRESS,
                abi: VOTING_ABI,
                functionName: "createElection",
                args: [title.trim()],
              })
            }
            disabled={isCreating || isCreateConfirming || title.trim().length === 0}
            className="rounded-lg bg-slate-900 px-4 py-2 text-sm font-semibold text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:bg-slate-400"
          >
            {isCreating
              ? "Menunggu MetaMask..."
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
                  changeStatus({
                    address: VOTING_ADDRESS,
                    abi: VOTING_ABI,
                    functionName: isOpen ? "closeElection" : "openElection",
                    args: [id],
                  });
                }}
                isStatusPending={isChangingStatus || isStatusConfirming}
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
