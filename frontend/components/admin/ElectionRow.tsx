"use client";

import { useChainId, useReadContract } from "wagmi";
import { VOTING_ABI, VOTING_ADDRESS, VOTING_CHAIN_ID } from "@/lib/contract";
import { CandidateList } from "./CandidateList";

type Props = {
  electionId: bigint;
  onAddCandidate: () => void;
  onToggleStatus: (isOpen: boolean) => void;
  isStatusPending: boolean;
};

export function ElectionRow({
  electionId,
  onAddCandidate,
  onToggleStatus,
  isStatusPending,
}: Props) {
  const chainId = useChainId();
  const isSupportedChain = chainId === VOTING_CHAIN_ID;
  const { data: election } = useReadContract({
    address: VOTING_ADDRESS,
    abi: VOTING_ABI,
    functionName: "elections",
    args: [electionId],
    query: { enabled: isSupportedChain },
  });

  if (!election) {
    return (
      <div className="rounded-lg border border-slate-200 bg-slate-50 p-4 text-sm text-slate-500">
        Memuat event #{electionId.toString()}...
      </div>
    );
  }

  const [title, isOpen, candidatesCount, activeCandidatesCount] = election;
  const canOpen = activeCandidatesCount > 0n;

  return (
    <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <p className="text-sm font-semibold text-slate-900">{title}</p>
          <p className="text-xs text-slate-500">
            ID {electionId.toString()} • Kandidat{" "}
            {candidatesCount.toString()} • Aktif{" "}
            {activeCandidatesCount.toString()}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <button
            onClick={onAddCandidate}
            className="rounded-lg border border-slate-300 px-3 py-2 text-xs font-semibold text-slate-600 transition hover:bg-white"
          >
            Tambah Kandidat
          </button>
          <button
            onClick={() => onToggleStatus(isOpen)}
            disabled={isStatusPending || (!isOpen && !canOpen)}
            className={`relative h-8 w-14 rounded-full transition ${
              isOpen ? "bg-emerald-500" : "bg-slate-300"
            } ${isStatusPending || (!isOpen && !canOpen) ? "opacity-60" : ""}`}
            title={
              !isOpen && !canOpen ? "Tambahkan kandidat dulu" : "Ganti status"
            }
            type="button"
          >
            <span
              className={`absolute top-1 h-6 w-6 rounded-full bg-white shadow transition ${
                isOpen ? "left-7" : "left-1"
              }`}
            />
          </button>
          <span className="text-xs font-semibold text-slate-500">
            {isOpen ? "Open" : "Closed"}
          </span>
        </div>
      </div>

      <CandidateList
        electionId={electionId}
        candidatesCount={candidatesCount}
        isOpen={isOpen}
      />
    </div>
  );
}
