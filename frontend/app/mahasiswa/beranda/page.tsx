"use client";

import { useRouter } from "next/navigation";
import {
  ActiveEventSummary,
  VerificationStepper,
} from "@/components/student/StudentSections";
import { useStudent, VerificationStatus } from "@/components/student/StudentProvider";

export default function StudentHomePage() {
  const router = useRouter();
  const { verificationStatus } = useStudent();

  return (
    <div className="space-y-6">
      <div>
        <p className="text-xs font-semibold uppercase tracking-[0.3em] text-slate-400">
          Beranda
        </p>
        <h2 className="mt-2 text-xl font-semibold text-slate-900">
          Ringkasan Mahasiswa
        </h2>
        <p className="mt-1 text-sm text-slate-500">
          Pantau status verifikasi dan event aktif.
        </p>
      </div>

      <VerificationStepper status={(verificationStatus ?? "NONE") as VerificationStatus} />
      <ActiveEventSummary onGoVote={() => router.push("/mahasiswa/event")} />
    </div>
  );
}
