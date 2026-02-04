"use client";

import { useEffect, useRef, useState } from "react";
import { useReadContract } from "wagmi";
import { VOTING_ABI, VOTING_ADDRESS } from "@/lib/contract";
import { CandidateList } from "./CandidateList";
import { useAdminSession } from "@/components/auth/useAdminSession";

type Props = {
  electionId: bigint;
  onAddCandidate: () => void;
  onSchedule: () => void;
  onMetaChange: (meta: {
    title: string;
    isOpen: boolean;
    mode: number;
    endTime: bigint;
    startTime: bigint;
    candidatesCount: bigint;
  }) => void;
  onToggleStatus: (isOpen: boolean) => void;
  isStatusPending: boolean;
};

export function ElectionRow({
  electionId,
  onAddCandidate,
  onSchedule,
  onMetaChange,
  onToggleStatus,
  isStatusPending,
}: Props) {
  const useRelayer = true;
  const { isAdminAuthed } = useAdminSession();
  const [isLocked, setIsLocked] = useState(false);
  const { data: election } = useReadContract({
    address: VOTING_ADDRESS,
    abi: VOTING_ABI,
    functionName: "getElection",
    args: [electionId],
    query: { enabled: true, refetchInterval: 10000 },
  });

  const onMetaChangeRef = useRef(onMetaChange);
  useEffect(() => {
    onMetaChangeRef.current = onMetaChange;
  }, [onMetaChange]);

  useEffect(() => {
    if (!election) return;
    const [nextTitle, nextIsOpen, nextMode, nextStartTime, nextEndTime, nextCandidatesCount] =
      election;
    onMetaChangeRef.current({
      title: nextTitle as string,
      isOpen: !!nextIsOpen,
      mode: Number(nextMode),
      endTime: nextEndTime as bigint,
      startTime: nextStartTime as bigint,
      candidatesCount: nextCandidatesCount as bigint,
    });
  }, [election]);

  useEffect(() => {
    let ignore = false;
    if (!useRelayer || !isAdminAuthed) {
      setIsLocked(false);
      return undefined;
    }
    fetch(`/api/admin/elections/state/${electionId.toString()}`)
      .then((res) => res.json().then((data) => ({ ok: res.ok, data })))
      .then((result) => {
        if (ignore) return;
        if (result.ok) {
          setIsLocked(!!result.data?.state?.openedOnce);
        }
      })
      .catch(() => {
        if (ignore) return;
      });
    return () => {
      ignore = true;
    };
  }, [electionId, isAdminAuthed, useRelayer]);

  if (!election) {
    return (
      <div className="rounded-lg border border-slate-200 bg-slate-50 p-4 text-sm text-slate-500">
        Memuat event #{electionId.toString()}...
      </div>
    );
  }

  const [
    title,
    isOpen,
    mode,
    _startTime,
    _endTime,
    candidatesCount,
    activeCandidatesCount,
  ] = election;
  const canOpen = activeCandidatesCount > BigInt(0);
  const isScheduled = Number(mode) === 1;
  const effectiveLocked = isScheduled || isLocked;
  const canEdit = !effectiveLocked;

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
          <div className="flex flex-col items-end gap-1">
            <button
              onClick={onAddCandidate}
              disabled={!canEdit}
              className="rounded-lg border border-slate-300 px-3 py-2 text-xs font-semibold text-slate-600 transition hover:bg-white disabled:cursor-not-allowed disabled:opacity-60"
              title={
                effectiveLocked
                  ? "Event sudah pernah dibuka. Edit kandidat dikunci."
                  : undefined
              }
            >
              Tambah Kandidat
            </button>
          </div>
          <button
            onClick={onSchedule}
            className="rounded-lg border border-amber-200 px-3 py-2 text-xs font-semibold text-amber-700 transition hover:bg-amber-50"
          >
            Atur Jadwal
          </button>
          {effectiveLocked && (
            <span className="rounded-full border border-amber-200 bg-amber-50 px-2 py-1 text-[10px] font-semibold uppercase tracking-wide text-amber-700">
              Terkunci
            </span>
          )}
          <button
            onClick={() => onToggleStatus(isOpen)}
            disabled={isScheduled || isStatusPending || (!isOpen && !canOpen)}
            className={`relative h-8 w-14 rounded-full transition ${
              isOpen ? "bg-emerald-500" : "bg-slate-300"
            } ${
              isScheduled || isStatusPending || (!isOpen && !canOpen) ? "opacity-60" : ""
            }`}
            title={
              isScheduled
                ? "Mode terjadwal tidak bisa toggle manual"
                : !isOpen && !canOpen
                ? "Tambahkan kandidat dulu"
                : "Ganti status"
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
            {isScheduled ? "Scheduled" : isOpen ? "Open" : "Closed"}
          </span>
        </div>
      </div>

      <CandidateList
        electionId={electionId}
        candidatesCount={candidatesCount}
        isOpen={isOpen}
        isLocked={effectiveLocked}
      />
    </div>
  );
}
