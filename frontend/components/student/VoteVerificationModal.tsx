"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Modal } from "@/components/Modal";

type VoteVerificationPayload = {
  faceAssertionToken: string;
  selfieDataUrl?: string;
};

type VoteVerificationResult = {
  ok: boolean;
  reason?: string;
  faceMatchScore?: number;
  threshold?: number;
};

type VoteVerificationModalProps = {
  open: boolean;
  onClose: () => void;
  onSubmit: (payload: VoteVerificationPayload) => Promise<VoteVerificationResult>;
  candidateName: string;
  maxAttempts?: number;
};

function getProviderMode() {
  return (process.env.NEXT_PUBLIC_FACE_PROVIDER_MODE ?? "mock").toLowerCase();
}

function generateAssertionNonce() {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return `nonce:${crypto.randomUUID()}`;
  }
  return `nonce:${Date.now()}:${Math.random().toString(16).slice(2)}`;
}

export function VoteVerificationModal({
  open,
  onClose,
  onSubmit,
  candidateName,
  maxAttempts = 3,
}: VoteVerificationModalProps) {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const [capturedSelfie, setCapturedSelfie] = useState<string | null>(null);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [attempts, setAttempts] = useState(0);
  const [cameraReady, setCameraReady] = useState(false);
  const providerMode = useMemo(() => getProviderMode(), []);
  const remainingAttempts = Math.max(0, maxAttempts - attempts);

  const stopStream = () => {
    if (!streamRef.current) return;
    streamRef.current.getTracks().forEach((track) => track.stop());
    streamRef.current = null;
    setCameraReady(false);
  };

  useEffect(() => {
    if (!open) {
      stopStream();
      setCapturedSelfie(null);
      setCameraError(null);
      setSubmitError(null);
      setSubmitting(false);
      setAttempts(0);
      return;
    }

    let cancelled = false;
    const startCamera = async () => {
      try {
        if (!navigator.mediaDevices?.getUserMedia) {
          setCameraError("Perangkat tidak mendukung akses kamera.");
          return;
        }
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: "user", width: { ideal: 720 }, height: { ideal: 720 } },
          audio: false,
        });
        if (cancelled) {
          stream.getTracks().forEach((track) => track.stop());
          return;
        }
        streamRef.current = stream;
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          await videoRef.current.play().catch(() => {});
        }
        setCameraReady(true);
      } catch {
        setCameraError("Kamera gagal dibuka. Izinkan akses kamera lalu coba lagi.");
      }
    };

    startCamera();
    return () => {
      cancelled = true;
      stopStream();
    };
  }, [open]);

  const captureSelfie = () => {
    if (!videoRef.current) return;
    const video = videoRef.current;
    const canvas = document.createElement("canvas");
    canvas.width = video.videoWidth || 720;
    canvas.height = video.videoHeight || 720;
    const ctx = canvas.getContext("2d");
    if (!ctx) {
      setCameraError("Gagal mengambil frame kamera.");
      return;
    }
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
    const dataUrl = canvas.toDataURL("image/jpeg", 0.92);
    setCapturedSelfie(dataUrl);
    setSubmitError(null);
  };

  const submitVerification = async () => {
    if (!capturedSelfie || submitting) return;
    if (attempts >= maxAttempts) {
      setSubmitError("Batas percobaan verifikasi tercapai.");
      return;
    }
    setSubmitting(true);
    setSubmitError(null);
    try {
      const faceAssertionToken =
        providerMode === "mock"
          ? `mock:pass:${generateAssertionNonce()}`
          : generateAssertionNonce();
      const result = await onSubmit({
        faceAssertionToken,
        selfieDataUrl: capturedSelfie,
      });
      if (result.ok) {
        onClose();
        return;
      }
      setAttempts((prev) => prev + 1);
      const reason = result.reason ?? "Verifikasi wajah gagal.";
      if (typeof result.faceMatchScore === "number") {
        const thresholdLabel =
          typeof result.threshold === "number" ? result.threshold.toFixed(2) : "-";
        setSubmitError(
          `${reason} Skor kemiripan: ${result.faceMatchScore.toFixed(
            2
          )} (threshold ${thresholdLabel}).`
        );
      } else {
        setSubmitError(reason);
      }
    } catch {
      setAttempts((prev) => prev + 1);
      setSubmitError("Verifikasi gagal. Silakan coba lagi.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Verifikasi Selfie Sebelum Vote"
      description={`Validasi identitas untuk vote kandidat ${candidateName}.`}
      widthClassName="max-w-xl"
    >
      <div className="space-y-4">
        <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
          <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-slate-500">
            Capture -&gt; Verify -&gt; Submit
          </p>
          <p className="mt-1 text-xs text-slate-600">
            Maksimal {maxAttempts} percobaan per aksi vote.
          </p>
          <p className="mt-1 text-xs text-slate-500">
            Sisa percobaan: {remainingAttempts}
          </p>
        </div>

        {cameraError ? (
          <div className="rounded-xl border border-rose-200 bg-rose-50 p-3 text-sm text-rose-700">
            {cameraError}
          </div>
        ) : (
          <div className="rounded-xl border border-slate-200 bg-slate-100 p-2">
            {capturedSelfie ? (
              <img
                src={capturedSelfie}
                alt="Selfie terambil"
                className="h-64 w-full rounded-lg object-cover"
              />
            ) : (
              <video
                ref={videoRef}
                muted
                playsInline
                className="h-64 w-full rounded-lg bg-slate-200 object-cover"
              />
            )}
          </div>
        )}

        {submitError && (
          <div className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-xs text-rose-700">
            {submitError}
          </div>
        )}

        <div className="flex flex-wrap justify-end gap-2">
          <button
            onClick={onClose}
            className="rounded-lg border border-slate-300 px-4 py-2 text-xs font-semibold text-slate-600 transition hover:bg-slate-50"
          >
            Batal
          </button>
          {!capturedSelfie ? (
            <button
              onClick={captureSelfie}
              disabled={!cameraReady}
              className="rounded-lg bg-slate-900 px-4 py-2 text-xs font-semibold text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:bg-slate-400"
            >
              Ambil Selfie
            </button>
          ) : (
            <>
              <button
                onClick={() => setCapturedSelfie(null)}
                disabled={submitting}
                className="rounded-lg border border-slate-300 px-4 py-2 text-xs font-semibold text-slate-600 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60"
              >
                Ulangi
              </button>
              <button
                onClick={submitVerification}
                disabled={submitting || attempts >= maxAttempts}
                className="rounded-lg bg-emerald-600 px-4 py-2 text-xs font-semibold text-white transition hover:bg-emerald-500 disabled:cursor-not-allowed disabled:bg-slate-400"
              >
                {submitting ? "Memverifikasi..." : "Verifikasi & Vote"}
              </button>
            </>
          )}
        </div>
      </div>
    </Modal>
  );
}
