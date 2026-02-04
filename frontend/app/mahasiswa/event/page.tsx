"use client";

import { useMemo, useState } from "react";
import { Candidates } from "@/components/Candidates";
import { NoticeCard, OpenElections } from "@/components/student/StudentSections";
import { useStudent } from "@/components/student/StudentProvider";

export default function StudentEventPage() {
  const { verificationStatus } = useStudent();
  const [activeElectionId, setActiveElectionId] = useState<bigint | null>(null);

  const canVote = useMemo(() => {
    return verificationStatus === "VERIFIED";
  }, [verificationStatus]);

  return (
    <div className="space-y-6">
      <div>
        <p className="text-xs font-semibold uppercase tracking-[0.3em] text-slate-400">
          Event & Voting
        </p>
        <h2 className="mt-2 text-xl font-semibold text-slate-900">
          Daftar Event Aktif
        </h2>
        <p className="mt-1 text-sm text-slate-500">
          Pilih event yang sedang dibuka dan lakukan voting.
        </p>
      </div>

      {!canVote && (
        <NoticeCard
          text="Akun belum terverifikasi. Selesaikan verifikasi dulu sebelum voting."
        />
      )}

      {canVote && (
        <>
          <OpenElections onSelect={setActiveElectionId} />
          {activeElectionId ? (
            <Candidates electionId={activeElectionId} showSelector={false} />
          ) : (
            <div className="rounded-2xl border border-slate-200 bg-white p-4 text-sm text-slate-500">
              Pilih event untuk melihat kandidat.
            </div>
          )}
        </>
      )}
    </div>
  );
}
