"use client";

import {
  NoticeCard,
  ProfileCard,
  VerificationCard,
  VerificationStepper,
} from "@/components/student/StudentSections";
import { useStudent, VerificationStatus } from "@/components/student/StudentProvider";

export default function StudentProfilePage() {
  const {
    nim,
    verificationStatus,
    verificationReason,
    uploading,
    uploadMsg,
    cardPreview,
    selfiePreview,
    onCardFileChange,
    onSelfieFileChange,
    uploadVerification,
  } = useStudent();

  const status = (verificationStatus ?? "NONE") as VerificationStatus;

  return (
    <div className="space-y-6">
      <div>
        <p className="text-xs font-semibold uppercase tracking-[0.3em] text-slate-400">
          Profil
        </p>
        <h2 className="mt-2 text-xl font-semibold text-slate-900">
          Data Mahasiswa
        </h2>
        <p className="mt-1 text-sm text-slate-500">
          Kelola data diri dan verifikasi identitas.
        </p>
      </div>

      <ProfileCard nim={nim ?? "-"} status={status} reason={verificationReason} />
      <VerificationStepper status={status} />

      {status === "PENDING" ? (
        <NoticeCard text="Verifikasi sedang diproses. Tunggu konfirmasi admin." />
      ) : status === "VERIFIED" ? (
        <NoticeCard text="Verifikasi sudah disetujui. Kamu bisa mulai voting." />
      ) : (
        <VerificationCard
          status={status}
          reason={verificationReason}
          uploading={uploading}
          uploadMsg={uploadMsg}
          onUpload={uploadVerification}
          onCardFileChange={onCardFileChange}
          onSelfieFileChange={onSelfieFileChange}
          cardPreview={cardPreview}
          selfiePreview={selfiePreview}
        />
      )}
    </div>
  );
}
