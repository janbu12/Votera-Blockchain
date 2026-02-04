"use client";

import { useMemo } from "react";
import { CandidateAdminRow } from "./CandidateAdminRow";

type Props = {
  electionId: bigint;
  candidatesCount: bigint;
  isOpen: boolean;
  isLocked: boolean;
};

export function CandidateList({
  electionId,
  candidatesCount,
  isOpen,
  isLocked,
}: Props) {
  const ids = useMemo(() => {
    const n = Number(candidatesCount ?? BigInt(0));
    return Array.from({ length: n }, (_, i) => BigInt(i + 1));
  }, [candidatesCount]);

  if (candidatesCount === BigInt(0)) {
    return (
      <p className="mt-4 text-xs text-slate-500">
        Belum ada kandidat untuk event ini.
      </p>
    );
  }

  return (
    <div className="mt-4 space-y-2">
      {ids.map((id) => (
        <CandidateAdminRow
          key={`${electionId.toString()}-${id.toString()}`}
          electionId={electionId}
          candidateId={id}
          isOpen={isOpen}
          isLocked={isLocked}
        />
      ))}
    </div>
  );
}
