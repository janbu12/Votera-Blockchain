"use client";

import { useEffect, useState } from "react";
import { startRegistration } from "@simplewebauthn/browser";
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
    campusName,
    campusOfficialPhotoUrl,
    verificationStatus,
    verificationReason,
    uploading,
    uploadMsg,
    selfiePreview,
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

      <ProfileCard
        nim={nim ?? "-"}
        campusName={campusName}
        status={status}
        reason={verificationReason}
      />
      <VerificationStepper status={status} />

      {status === "PENDING" ? (
        <NoticeCard text="Verifikasi sedang diproses. Tunggu konfirmasi admin." />
      ) : status === "VERIFIED" ? (
        <>
          <NoticeCard text="Verifikasi sudah disetujui. Kamu bisa mulai voting." />
          <PasskeyCard />
        </>
      ) : (
        <VerificationCard
          status={status}
          reason={verificationReason}
          campusName={campusName}
          campusOfficialPhotoUrl={campusOfficialPhotoUrl}
          uploading={uploading}
          uploadMsg={uploadMsg}
          onUpload={uploadVerification}
          onSelfieFileChange={onSelfieFileChange}
          selfiePreview={selfiePreview}
        />
      )}
    </div>
  );
}

function PasskeyCard() {
  const [loading, setLoading] = useState(true);
  const [registered, setRegistered] = useState(false);
  const [requiredForVote, setRequiredForVote] = useState(true);
  const [message, setMessage] = useState<string | null>(null);
  const [registering, setRegistering] = useState(false);

  const refreshStatus = async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/student/webauthn/status");
      const data = await res.json().catch(() => ({}));
      if (res.ok) {
        setRegistered(Boolean(data?.registered));
        setRequiredForVote(Boolean(data?.requiredForVote));
      } else {
        setMessage(data?.reason ?? "Gagal memuat status passkey.");
      }
    } catch {
      setMessage("Gagal memuat status passkey.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void refreshStatus();
  }, []);

  const registerPasskey = async () => {
    if (
      typeof window === "undefined" ||
      typeof window.PublicKeyCredential === "undefined" ||
      typeof navigator.credentials?.create !== "function"
    ) {
      setMessage("Perangkat ini tidak mendukung passkey/fingerprint.");
      return;
    }
    setRegistering(true);
    setMessage(null);
    try {
      const optionsRes = await fetch("/api/student/webauthn/register/options", {
        method: "POST",
      });
      const optionsData = await optionsRes.json().catch(() => ({}));
      if (!optionsRes.ok || !optionsData?.options) {
        setMessage(optionsData?.reason ?? "Gagal membuat challenge passkey.");
        return;
      }
      const credential = await startRegistration({
        optionsJSON: optionsData.options,
      });
      const verifyRes = await fetch("/api/student/webauthn/register/verify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ credential }),
      });
      const verifyData = await verifyRes.json().catch(() => ({}));
      if (!verifyRes.ok) {
        setMessage(verifyData?.reason ?? "Registrasi passkey gagal.");
        return;
      }
      setMessage("Passkey berhasil diaktifkan.");
      await refreshStatus();
    } catch {
      setMessage("Registrasi passkey dibatalkan atau gagal.");
    } finally {
      setRegistering(false);
    }
  };

  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-4">
      <p className="text-xs font-semibold uppercase tracking-[0.3em] text-slate-400">
        Fingerprint / Passkey
      </p>
      <p className="mt-2 text-sm text-slate-600">
        Status:{" "}
        <span className="font-semibold text-slate-900">
          {loading ? "Memuat..." : registered ? "Aktif" : "Belum aktif"}
        </span>
      </p>
      <p className="mt-1 text-xs text-slate-500">
        {requiredForVote
          ? "Passkey wajib sebelum vote."
          : "Passkey opsional, tetapi direkomendasikan."}
      </p>
      {message && (
        <p className="mt-2 text-xs text-slate-600">{message}</p>
      )}
      {!registered && !loading && (
        <button
          onClick={registerPasskey}
          disabled={registering}
          className="mt-3 rounded-lg bg-slate-900 px-4 py-2 text-xs font-semibold text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:bg-slate-400"
        >
          {registering ? "Menyiapkan passkey..." : "Aktifkan Fingerprint/Passkey"}
        </button>
      )}
    </div>
  );
}
