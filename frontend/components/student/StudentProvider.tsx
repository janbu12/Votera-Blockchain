"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import { useRouter } from "next/navigation";
import {
  clearStudentAuth,
  saveStudentAuth,
} from "@/components/auth/student-auth";

export type VerificationStatus = "NONE" | "PENDING" | "VERIFIED" | "REJECTED";

export type VoteHistoryItem = {
  electionId: string;
  candidateId: string;
  txHash: string;
  mode: string;
  createdAt: string;
};

type StudentContextValue = {
  loading: boolean;
  nim: string | null;
  mustChangePassword: boolean;
  verificationStatus: VerificationStatus | null;
  verificationReason: string | null;
  verificationLoading: boolean;
  refreshVerification: () => Promise<void>;
  voteHistory: VoteHistoryItem[];
  voteHistoryLoading: boolean;
  refreshVoteHistory: () => Promise<void>;
  uploading: boolean;
  uploadMsg: string | null;
  cardPreview: string | null;
  selfiePreview: string | null;
  onCardFileChange: (file: File | null) => void;
  onSelfieFileChange: (file: File | null) => void;
  uploadVerification: () => Promise<void>;
  newPassword: string;
  confirmPassword: string;
  onNewPasswordChange: (value: string) => void;
  onConfirmPasswordChange: (value: string) => void;
  passwordMessage: string | null;
  passwordLoading: boolean;
  submitPasswordChange: () => Promise<void>;
};

const StudentContext = createContext<StudentContextValue | null>(null);

export function StudentProvider({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [nim, setNim] = useState<string | null>(null);
  const [mustChangePassword, setMustChangePassword] = useState(false);
  const [verificationStatus, setVerificationStatus] =
    useState<VerificationStatus | null>(null);
  const [verificationReason, setVerificationReason] = useState<string | null>(null);
  const [verificationLoading, setVerificationLoading] = useState(false);

  const [voteHistory, setVoteHistory] = useState<VoteHistoryItem[]>([]);
  const [voteHistoryLoading, setVoteHistoryLoading] = useState(false);

  const [uploading, setUploading] = useState(false);
  const [uploadMsg, setUploadMsg] = useState<string | null>(null);
  const [cardFile, setCardFile] = useState<File | null>(null);
  const [selfieFile, setSelfieFile] = useState<File | null>(null);
  const [cardPreview, setCardPreview] = useState<string | null>(null);
  const [selfiePreview, setSelfiePreview] = useState<string | null>(null);

  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [passwordMessage, setPasswordMessage] = useState<string | null>(null);
  const [passwordLoading, setPasswordLoading] = useState(false);

  const refreshMe = useCallback(async () => {
    try {
      const res = await fetch("/api/student/me");
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data?.reason ?? "Unauthorized");
      }
      setNim(data.nim ?? null);
      setMustChangePassword(!!data.mustChangePassword);
      if (data.verificationStatus) {
        setVerificationStatus(data.verificationStatus as VerificationStatus);
      }
      saveStudentAuth({
        nim: data.nim ?? "",
        mustChangePassword: !!data.mustChangePassword,
      });
    } catch {
      clearStudentAuth();
      router.push("/login");
    }
  }, [router]);

  const refreshVerification = useCallback(async () => {
    setVerificationLoading(true);
    try {
      const res = await fetch("/api/student/verification/status");
      const data = await res.json();
      if (res.ok) {
        setVerificationStatus(
          (data.verificationStatus ?? "NONE") as VerificationStatus
        );
        setVerificationReason(data.verificationRejectReason ?? null);
      }
    } finally {
      setVerificationLoading(false);
    }
  }, []);

  const refreshVoteHistory = useCallback(async () => {
    setVoteHistoryLoading(true);
    try {
      const res = await fetch("/api/student/vote-history");
      const data = await res.json();
      if (res.ok) {
        setVoteHistory(data.items ?? []);
      } else {
        setVoteHistory([]);
      }
    } finally {
      setVoteHistoryLoading(false);
    }
  }, []);

  useEffect(() => {
    let ignore = false;
    (async () => {
      setLoading(true);
      await refreshMe();
      if (!ignore) {
        await Promise.all([refreshVerification(), refreshVoteHistory()]);
      }
      if (!ignore) setLoading(false);
    })();
    return () => {
      ignore = true;
    };
  }, [refreshMe, refreshVerification, refreshVoteHistory]);

  useEffect(() => {
    if (verificationStatus !== "PENDING") return;
    const id = window.setInterval(() => {
      refreshVerification();
      refreshMe();
    }, 5000);
    return () => window.clearInterval(id);
  }, [verificationStatus, refreshMe, refreshVerification]);

  useEffect(() => {
    if (!cardFile) {
      setCardPreview(null);
      return;
    }
    const url = URL.createObjectURL(cardFile);
    setCardPreview(url);
    return () => {
      URL.revokeObjectURL(url);
    };
  }, [cardFile]);

  useEffect(() => {
    if (!selfieFile) {
      setSelfiePreview(null);
      return;
    }
    const url = URL.createObjectURL(selfieFile);
    setSelfiePreview(url);
    return () => {
      URL.revokeObjectURL(url);
    };
  }, [selfieFile]);

  const uploadVerification = useCallback(async () => {
    setUploadMsg(null);
    if (!cardFile || !selfieFile) {
      setUploadMsg("Foto kartu dan selfie wajib diisi.");
      return;
    }
    setUploading(true);
    try {
      const formData = new FormData();
      formData.append("card", cardFile);
      formData.append("selfie", selfieFile);
      const res = await fetch("/api/student/verification/upload", {
        method: "POST",
        body: formData,
      });
      const data = await res.json();
      if (!res.ok) {
        setUploadMsg(data?.reason ?? "Gagal mengirim verifikasi");
        return;
      }
      setUploadMsg("Verifikasi berhasil dikirim.");
      setCardFile(null);
      setSelfieFile(null);
      await refreshVerification();
      await refreshMe();
    } catch {
      setUploadMsg("Gagal menghubungi backend");
    } finally {
      setUploading(false);
    }
  }, [cardFile, selfieFile, refreshMe, refreshVerification]);

  const submitPasswordChange = useCallback(async () => {
    setPasswordMessage(null);
    if (newPassword.length < 8) {
      setPasswordMessage("Password minimal 8 karakter.");
      return;
    }
    if (newPassword !== confirmPassword) {
      setPasswordMessage("Konfirmasi password tidak cocok.");
      return;
    }
    setPasswordLoading(true);
    try {
      const res = await fetch("/api/student/change-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ newPassword }),
      });
      const data = await res.json();
      if (!res.ok) {
        setPasswordMessage(data?.reason ?? "Gagal menyimpan password");
        return;
      }
      setPasswordMessage("Password berhasil diubah.");
      setNewPassword("");
      setConfirmPassword("");
      setMustChangePassword(false);
      await refreshMe();
    } catch {
      setPasswordMessage("Gagal menghubungi backend");
    } finally {
      setPasswordLoading(false);
    }
  }, [confirmPassword, newPassword, refreshMe]);

  const value = useMemo<StudentContextValue>(
    () => ({
      loading,
      nim,
      mustChangePassword,
      verificationStatus,
      verificationReason,
      verificationLoading,
      refreshVerification,
      voteHistory,
      voteHistoryLoading,
      refreshVoteHistory,
      uploading,
      uploadMsg,
      cardPreview,
      selfiePreview,
      onCardFileChange: setCardFile,
      onSelfieFileChange: setSelfieFile,
      uploadVerification,
      newPassword,
      confirmPassword,
      onNewPasswordChange: setNewPassword,
      onConfirmPasswordChange: setConfirmPassword,
      passwordMessage,
      passwordLoading,
      submitPasswordChange,
    }),
    [
      loading,
      nim,
      mustChangePassword,
      verificationStatus,
      verificationReason,
      verificationLoading,
      refreshVerification,
      voteHistory,
      voteHistoryLoading,
      refreshVoteHistory,
      uploading,
      uploadMsg,
      cardPreview,
      selfiePreview,
      uploadVerification,
      newPassword,
      confirmPassword,
      passwordMessage,
      passwordLoading,
      submitPasswordChange,
    ]
  );

  return <StudentContext.Provider value={value}>{children}</StudentContext.Provider>;
}

export function useStudent() {
  const ctx = useContext(StudentContext);
  if (!ctx) {
    throw new Error("useStudent must be used within StudentProvider");
  }
  return ctx;
}
