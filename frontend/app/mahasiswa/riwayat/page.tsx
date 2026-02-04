"use client";

import { VoteHistoryPanel } from "@/components/student/StudentSections";
import { useStudent } from "@/components/student/StudentProvider";

export default function StudentHistoryPage() {
  const { voteHistory, voteHistoryLoading } = useStudent();

  return (
    <div className="space-y-6">
      <div>
        <p className="text-xs font-semibold uppercase tracking-[0.3em] text-slate-400">
          Riwayat
        </p>
        <h2 className="mt-2 text-xl font-semibold text-slate-900">
          Riwayat Voting
        </h2>
        <p className="mt-1 text-sm text-slate-500">
          Event yang pernah kamu ikuti beserta tx hash.
        </p>
      </div>

      <VoteHistoryPanel items={voteHistory} loading={voteHistoryLoading} />
    </div>
  );
}
