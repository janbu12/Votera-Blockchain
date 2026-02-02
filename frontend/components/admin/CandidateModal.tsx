"use client";

import { useEffect, useRef, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { readContractQueryKey } from "@wagmi/core/query";
import { useWaitForTransactionReceipt, useWriteContract } from "wagmi";
import { VOTING_ABI, VOTING_ADDRESS } from "@/lib/contract";
import { formatTxToast } from "@/lib/tx";
import { useToast } from "@/components/ToastProvider";
import { Modal } from "@/components/Modal";
import { isUserRejectedError } from "./utils";

type Props = {
  open: boolean;
  electionIds: bigint[];
  activeElectionId: bigint | null;
  candidateName: string;
  onCandidateNameChange: (value: string) => void;
  onClose: () => void;
};

export function CandidateModal({
  open,
  electionIds,
  activeElectionId,
  candidateName,
  onCandidateNameChange,
  onClose,
}: Props) {
  const { push } = useToast();
  const [selectedElectionId, setSelectedElectionId] = useState<bigint | null>(
    activeElectionId ?? (electionIds[0] ?? null)
  );
  const handledHashRef = useRef<`0x${string}` | null>(null);

  useEffect(() => {
    if (activeElectionId != null) {
      setSelectedElectionId(activeElectionId);
    }
  }, [activeElectionId]);

  const {
    data: addHash,
    isPending: isAdding,
    writeContract: addCandidate,
    error: addError,
  } = useWriteContract();
  const {
    data: addReceipt,
    isLoading: isAddConfirming,
    isSuccess: isAddSuccess,
  } =
    useWaitForTransactionReceipt({
      hash: addHash,
      confirmations: 1,
      query: { enabled: !!addHash },
    });

  const queryClient = useQueryClient();

  useEffect(() => {
    if (isAddSuccess && selectedElectionId && addHash) {
      if (handledHashRef.current === addHash) return;
      handledHashRef.current = addHash;
      queryClient.invalidateQueries({
        queryKey: readContractQueryKey({
          address: VOTING_ADDRESS,
          abi: VOTING_ABI,
          functionName: "elections",
          args: [selectedElectionId],
        }),
      });
      push(
        formatTxToast(
          "Kandidat berhasil ditambah",
          addHash,
          addReceipt?.blockNumber
        ),
        "success"
      );
      setTimeout(() => {
        onClose();
      }, 0);
    }
  }, [isAddSuccess, selectedElectionId, addHash, onClose, queryClient, push]);

  useEffect(() => {
    if (isUserRejectedError(addError)) {
      push("Transaksi dibatalkan", "info");
    }
  }, [addError, push]);

  return (
    <Modal
      open={open}
      title="Tambah Kandidat"
      description="Pilih event lalu masukkan nama kandidat."
      onClose={onClose}
    >
      <div className="space-y-4">
        <label className="block text-xs font-semibold text-slate-500">
          Event
          <select
            value={selectedElectionId?.toString() ?? ""}
            onChange={(e) => setSelectedElectionId(BigInt(e.target.value))}
            className="mt-2 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm shadow-sm outline-none focus:border-slate-400"
          >
            {electionIds.map((id) => (
              <option key={id.toString()} value={id.toString()}>
                Event #{id.toString()}
              </option>
            ))}
          </select>
        </label>

        <label className="block text-xs font-semibold text-slate-500">
          Nama kandidat
          <input
            value={candidateName}
            onChange={(e) => onCandidateNameChange(e.target.value)}
            placeholder="Nama kandidat"
            className="mt-2 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm shadow-sm outline-none focus:border-slate-400"
          />
        </label>

        <div className="flex justify-end gap-2">
          <button
            onClick={onClose}
            className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-600 transition hover:bg-slate-50"
          >
            Batal
          </button>
          <button
            onClick={() => {
              if (!selectedElectionId) return;
              addCandidate({
                address: VOTING_ADDRESS,
                abi: VOTING_ABI,
                functionName: "addCandidate",
                args: [selectedElectionId, candidateName.trim()],
              });
            }}
            disabled={
              isAdding ||
              isAddConfirming ||
              !selectedElectionId ||
              candidateName.trim().length === 0
            }
            className="rounded-lg bg-slate-900 px-4 py-2 text-sm font-semibold text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:bg-slate-400"
          >
            {isAdding
              ? "Menunggu MetaMask..."
              : isAddConfirming
              ? "Mengonfirmasi..."
              : "Simpan"}
          </button>
        </div>

        {addError && !isUserRejectedError(addError) && (
          <p className="text-xs text-red-600">{addError.message}</p>
        )}
      </div>
    </Modal>
  );
}
