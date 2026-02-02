"use client";

import { useEffect, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { readContractQueryKey } from "@wagmi/core/query";
import {
  useChainId,
  useReadContract,
  useWaitForTransactionReceipt,
  useWriteContract,
} from "wagmi";
import { VOTING_ABI, VOTING_ADDRESS, VOTING_CHAIN_ID } from "@/lib/contract";
import { formatTxToast } from "@/lib/tx";
import { useToast } from "@/components/ToastProvider";
import { EditCandidateModal } from "./EditCandidateModal";
import { isUserRejectedError } from "./utils";

type Props = {
  electionId: bigint;
  candidateId: bigint;
  isOpen: boolean;
};

export function CandidateAdminRow({ electionId, candidateId, isOpen }: Props) {
  const chainId = useChainId();
  const isSupportedChain = chainId === VOTING_CHAIN_ID;
  const { data } = useReadContract({
    address: VOTING_ADDRESS,
    abi: VOTING_ABI,
    functionName: "getCandidate",
    args: [electionId, candidateId],
    query: { enabled: isSupportedChain },
  });

  const { push } = useToast();
  const [isEditOpen, setIsEditOpen] = useState(false);
  const [editName, setEditName] = useState("");

  const {
    data: editHash,
    isPending: isEditing,
    writeContract: updateCandidate,
    error: editError,
  } = useWriteContract();
  const {
    data: editReceipt,
    isLoading: isEditConfirming,
    isSuccess: isEditSuccess,
  } =
    useWaitForTransactionReceipt({
      hash: editHash,
      confirmations: 1,
      query: { enabled: !!editHash },
    });

  const {
    data: hideHash,
    isPending: isHiding,
    writeContract: hideCandidate,
    error: hideError,
  } = useWriteContract();
  const {
    data: hideReceipt,
    isLoading: isHideConfirming,
    isSuccess: isHideSuccess,
  } =
    useWaitForTransactionReceipt({
      hash: hideHash,
      confirmations: 1,
      query: { enabled: !!hideHash },
    });

  const queryClient = useQueryClient();

  useEffect(() => {
    if (isEditSuccess) {
      queryClient.invalidateQueries({
        queryKey: readContractQueryKey({
          address: VOTING_ADDRESS,
          abi: VOTING_ABI,
          functionName: "getCandidate",
          args: [electionId, candidateId],
        }),
      });
      push(
        formatTxToast(
          "Kandidat berhasil diupdate",
          editHash,
          editReceipt?.blockNumber
        ),
        "success"
      );
      setTimeout(() => {
        setIsEditOpen(false);
      }, 0);
    }
  }, [isEditSuccess, queryClient, electionId, candidateId, push]);

  useEffect(() => {
    if (isHideSuccess) {
      queryClient.invalidateQueries({
        queryKey: readContractQueryKey({
          address: VOTING_ADDRESS,
          abi: VOTING_ABI,
          functionName: "getCandidate",
          args: [electionId, candidateId],
        }),
      });
      queryClient.invalidateQueries({
        queryKey: readContractQueryKey({
          address: VOTING_ADDRESS,
          abi: VOTING_ABI,
          functionName: "elections",
          args: [electionId],
        }),
      });
      push(
        formatTxToast(
          "Kandidat disembunyikan",
          hideHash,
          hideReceipt?.blockNumber
        ),
        "success"
      );
    }
  }, [isHideSuccess, queryClient, electionId, candidateId, push]);

  useEffect(() => {
    if (isUserRejectedError(editError) || isUserRejectedError(hideError)) {
      push("Transaksi dibatalkan", "info");
    }
  }, [editError, hideError, push]);

  if (!data) {
    return (
      <div className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs text-slate-500">
        Memuat kandidat #{candidateId.toString()}...
      </div>
    );
  }

  const [cid, name, voteCount, isActive] = data;
  const disabled = isOpen || !isActive;

  return (
    <div className="rounded-lg border border-slate-200 bg-white px-3 py-3">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-sm font-semibold text-slate-900">
            {name}{" "}
            {!isActive && (
              <span className="ml-2 rounded-full bg-slate-200 px-2 py-0.5 text-[10px] font-semibold uppercase text-slate-500">
                Hidden
              </span>
            )}
          </p>
          <p className="text-xs text-slate-500">
            ID {cid.toString()} • Votes {voteCount.toString()}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <button
            onClick={() => {
              setEditName(name);
              setIsEditOpen(true);
            }}
            disabled={disabled}
            className="rounded-md border border-slate-300 px-3 py-1.5 text-xs font-semibold text-slate-600 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:text-slate-400"
          >
            Edit
          </button>
          <button
            onClick={() => {
              if (!window.confirm("Sembunyikan kandidat ini?")) return;
              hideCandidate({
                address: VOTING_ADDRESS,
                abi: VOTING_ABI,
                functionName: "hideCandidate",
                args: [electionId, cid],
              });
            }}
            disabled={disabled || isHiding || isHideConfirming}
            className="rounded-md border border-rose-200 px-3 py-1.5 text-xs font-semibold text-rose-600 transition hover:bg-rose-50 disabled:cursor-not-allowed disabled:text-rose-300"
          >
            {isHiding || isHideConfirming ? "Memproses..." : "Hide"}
          </button>
        </div>
      </div>

      {(editError || hideError) &&
        !isUserRejectedError(editError) &&
        !isUserRejectedError(hideError) && (
          <p className="mt-2 text-xs text-red-600">
            {(editError || hideError)?.message}
          </p>
        )}

      <EditCandidateModal
        open={isEditOpen}
        candidateName={editName}
        onCandidateNameChange={setEditName}
        onClose={() => setIsEditOpen(false)}
        onSave={() =>
          updateCandidate({
            address: VOTING_ADDRESS,
            abi: VOTING_ABI,
            functionName: "updateCandidate",
            args: [electionId, cid, editName.trim()],
          })
        }
        isSaving={isEditing || isEditConfirming}
      />
    </div>
  );
}
