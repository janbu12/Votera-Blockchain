"use client";

import { useEffect, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { readContractQueryKey } from "@wagmi/core/query";
import { useReadContract, useWaitForTransactionReceipt, useWriteContract } from "wagmi";
import { VOTING_ABI, VOTING_ADDRESS } from "@/lib/contract";
import { formatTxToast } from "@/lib/tx";
import { useAdminSession } from "@/components/auth/useAdminSession";
import { useToast } from "@/components/ToastProvider";
import { EditCandidateModal } from "./EditCandidateModal";
import { isUserRejectedError } from "./utils";

type Props = {
  electionId: bigint;
  candidateId: bigint;
  isOpen: boolean;
  isLocked: boolean;
};

export function CandidateAdminRow({
  electionId,
  candidateId,
  isOpen,
  isLocked,
}: Props) {
  const useRelayer = true;
  const { isAdminAuthed } = useAdminSession();
  const canRelay = useRelayer && isAdminAuthed;
  const { data } = useReadContract({
    address: VOTING_ADDRESS,
    abi: VOTING_ABI,
    functionName: "getCandidate",
    args: [electionId, candidateId],
    query: { enabled: true },
  });

  const { push } = useToast();
  const [isEditOpen, setIsEditOpen] = useState(false);
  const [editName, setEditName] = useState("");
  const [profile, setProfile] = useState({
    tagline: "",
    about: "",
    visi: "",
    misi: "",
    programKerja: "",
    photoUrl: null as string | null,
  });
  const [isProfileLoading, setIsProfileLoading] = useState(false);
  const [isProfileSaving, setIsProfileSaving] = useState(false);
  const [isPhotoUploading, setIsPhotoUploading] = useState(false);
  const backendBase = process.env.NEXT_PUBLIC_BACKEND_URL ?? "http://localhost:4000";
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);

  const [editRelayHash, setEditRelayHash] = useState<`0x${string}` | null>(null);
  const [isEditingRelayer, setIsEditingRelayer] = useState(false);
  const {
    data: editHash,
    isPending: isEditingWallet,
    writeContract: updateCandidate,
    error: editError,
  } = useWriteContract();
  const activeEditHash = useRelayer ? editRelayHash : editHash;
  const {
    data: editReceipt,
    isLoading: isEditConfirming,
    isSuccess: isEditSuccess,
  } = useWaitForTransactionReceipt({
    hash: activeEditHash ?? undefined,
    confirmations: 1,
    query: { enabled: !!activeEditHash },
  });

  const [hideRelayHash, setHideRelayHash] = useState<`0x${string}` | null>(null);
  const [isHidingRelayer, setIsHidingRelayer] = useState(false);
  const {
    data: hideHash,
    isPending: isHidingWallet,
    writeContract: hideCandidate,
    error: hideError,
  } = useWriteContract();
  const activeHideHash = useRelayer ? hideRelayHash : hideHash;
  const {
    data: hideReceipt,
    isLoading: isHideConfirming,
    isSuccess: isHideSuccess,
  } = useWaitForTransactionReceipt({
    hash: activeHideHash ?? undefined,
    confirmations: 1,
    query: { enabled: !!activeHideHash },
  });

  const queryClient = useQueryClient();

  useEffect(() => {
    if (isEditSuccess) {
      queryClient.invalidateQueries({
        queryKey: readContractQueryKey({
          address: VOTING_ADDRESS,
          abi: VOTING_ABI,
          functionName: "getCandidate",
          args: [electionId, candidateId],
        }),
      });
      push(
        formatTxToast(
          "Kandidat berhasil diupdate",
          activeEditHash,
          editReceipt?.blockNumber
        ),
        "success"
      );
      setTimeout(() => {
        setIsEditOpen(false);
      }, 0);
    }
  }, [isEditSuccess, queryClient, electionId, candidateId, push]);

  useEffect(() => {
    if (isHideSuccess) {
      queryClient.invalidateQueries({
        queryKey: readContractQueryKey({
          address: VOTING_ADDRESS,
          abi: VOTING_ABI,
          functionName: "getCandidate",
          args: [electionId, candidateId],
        }),
      });
      queryClient.invalidateQueries({
        queryKey: readContractQueryKey({
          address: VOTING_ADDRESS,
          abi: VOTING_ABI,
          functionName: "getElection",
          args: [electionId],
        }),
      });
      push(
        formatTxToast(
          "Kandidat disembunyikan",
          activeHideHash,
          hideReceipt?.blockNumber
        ),
        "success"
      );
    }
  }, [isHideSuccess, queryClient, electionId, candidateId, push]);

  useEffect(() => {
    if (isUserRejectedError(editError) || isUserRejectedError(hideError)) {
      push("Transaksi dibatalkan", "info");
    }
  }, [editError, hideError, push]);

  async function callAdminRelayer<T>(endpoint: string, body: T) {
    if (!isAdminAuthed) {
      push("Login admin diperlukan", "error");
      return null;
    }
    try {
      const res = await fetch(endpoint, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (!res.ok) {
        push(data?.reason ?? "Gagal memproses transaksi", "error");
        return null;
      }
      return data as { hash?: `0x${string}` };
    } catch {
      push("Gagal menghubungi backend", "error");
      return null;
    }
  }

  async function callAdminApi<T, R>(endpoint: string, body?: T, method = "POST") {
    if (!isAdminAuthed) {
      push("Login admin diperlukan", "error");
      return null;
    }
    try {
      const res = await fetch(endpoint, {
        method,
        headers: method === "POST" ? { "Content-Type": "application/json" } : undefined,
        body: method === "POST" ? JSON.stringify(body ?? {}) : undefined,
      });
      const data = await res.json();
      if (!res.ok) {
        push(data?.reason ?? "Gagal memproses permintaan", "error");
        return null;
      }
      return data as R;
    } catch {
      push("Gagal menghubungi backend", "error");
      return null;
    }
  }

  const loadProfile = async () => {
    setIsProfileLoading(true);
    const result = await callAdminApi<null, { ok: boolean; profile: any }>(
      `/api/admin/candidates/profile/${electionId.toString()}/${cid.toString()}`,
      undefined,
      "GET"
    );
    if (result?.profile) {
      const rawPhoto = result.profile.photoUrl ?? null;
      const photoUrl =
        rawPhoto && rawPhoto.startsWith("/")
          ? `${backendBase}${rawPhoto}`
          : rawPhoto;
      setProfile({
        tagline: result.profile.tagline ?? "",
        about: result.profile.about ?? "",
        visi: result.profile.visi ?? "",
        misi: result.profile.misi ?? "",
        programKerja: result.profile.programKerja ?? "",
        photoUrl,
      });
      setAvatarUrl(photoUrl);
    } else {
      setProfile({
        tagline: "",
        about: "",
        visi: "",
        misi: "",
        programKerja: "",
        photoUrl: null,
      });
      setAvatarUrl(null);
    }
    setIsProfileLoading(false);
  };

  useEffect(() => {
    let ignore = false;
    if (!data || !isAdminAuthed) return;
    const [cid] = data;
    callAdminApi<null, { ok: boolean; profile: any }>(
      `/api/admin/candidates/profile/${electionId.toString()}/${cid.toString()}`,
      undefined,
      "GET"
    ).then((result) => {
      if (ignore) return;
      if (result?.profile?.photoUrl) {
        const rawPhoto = result.profile.photoUrl;
        const photoUrl =
          rawPhoto && rawPhoto.startsWith("/")
            ? `${backendBase}${rawPhoto}`
            : rawPhoto;
        setAvatarUrl(photoUrl);
      }
    });
    return () => {
      ignore = true;
    };
  }, [backendBase, data, electionId, isAdminAuthed]);

  if (!data) {
    return (
      <div className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs text-slate-500">
        Memuat kandidat #{candidateId.toString()}...
      </div>
    );
  }

  const [cid, name, voteCount, isActive] = data;
  const disabled = isOpen || !isActive || isLocked;
  const avatar = avatarUrl;

  return (
    <div className="rounded-lg border border-slate-200 bg-white px-3 py-3">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          {avatar ? (
            <img
              src={avatar}
              alt={`Foto ${name}`}
              className="h-12 w-12 rounded-full object-cover"
            />
          ) : (
            <div className="flex h-12 w-12 items-center justify-center rounded-full bg-slate-100 text-[10px] text-slate-400">
              Foto
            </div>
          )}
          <div>
            <p className="text-sm font-semibold text-slate-900">
              {name}{" "}
              {!isActive && (
                <span className="ml-2 rounded-full bg-slate-200 px-2 py-0.5 text-[10px] font-semibold uppercase text-slate-500">
                  Hidden
                </span>
              )}
            </p>
            <p className="text-xs text-slate-500">
              ID {cid.toString()} • Votes {voteCount.toString()}
            </p>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <button
            onClick={() => {
              setEditName(name);
              loadProfile();
              setIsEditOpen(true);
            }}
            disabled={disabled}
            className="rounded-md border border-slate-300 px-3 py-1.5 text-xs font-semibold text-slate-600 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:text-slate-400"
            title={
              isLocked
                ? "Event sudah pernah dibuka. Edit kandidat dikunci."
                : undefined
            }
          >
            Edit
          </button>
          <button
            onClick={() => {
              if (!window.confirm("Sembunyikan kandidat ini?")) return;
              if (useRelayer) {
                if (!canRelay) {
                  push("Login admin diperlukan", "error");
                  return;
                }
                setIsHidingRelayer(true);
                callAdminRelayer("/api/admin/chain/hide-candidate", {
                  electionId: electionId.toString(),
                  candidateId: cid.toString(),
                }).then((result) => {
                  if (result?.hash) setHideRelayHash(result.hash);
                  setIsHidingRelayer(false);
                });
                return;
              }
              hideCandidate({
                address: VOTING_ADDRESS,
                abi: VOTING_ABI,
                functionName: "hideCandidate",
                args: [electionId, cid],
              });
            }}
            disabled={
              disabled ||
              isHidingWallet ||
              isHidingRelayer ||
              isHideConfirming ||
              (useRelayer && !canRelay)
            }
            className="rounded-md border border-rose-200 px-3 py-1.5 text-xs font-semibold text-rose-600 transition hover:bg-rose-50 disabled:cursor-not-allowed disabled:text-rose-300"
            title={
              isLocked
                ? "Event sudah pernah dibuka. Edit kandidat dikunci."
                : undefined
            }
          >
            {isHidingWallet || isHidingRelayer || isHideConfirming
              ? "Memproses..."
              : "Hide"}
          </button>
        </div>
      </div>

      {(editError || hideError) &&
        !isUserRejectedError(editError) &&
        !isUserRejectedError(hideError) && (
          <p className="mt-2 text-xs text-red-600">
            {(editError || hideError)?.message}
          </p>
        )}

      <EditCandidateModal
        open={isEditOpen}
        candidateName={editName}
        onCandidateNameChange={setEditName}
        profile={profile}
        onProfileChange={(key, value) =>
          setProfile((prev) => ({
            ...prev,
            [key]: value,
          }))
        }
        onPhotoUpload={async (file) => {
          setIsPhotoUploading(true);
          try {
            const form = new FormData();
            form.append("photo", file);
            form.append("electionId", electionId.toString());
            form.append("candidateId", cid.toString());
            const res = await fetch("/api/admin/candidates/photo", {
              method: "POST",
              body: form,
            });
            const data = await res.json();
            if (!res.ok) {
              push(data?.reason ?? "Gagal upload foto", "error");
              return;
            }
            const rawPhoto = data.photoUrl ?? null;
            const photoUrl =
              rawPhoto && rawPhoto.startsWith("/")
                ? `${backendBase}${rawPhoto}`
                : rawPhoto;
            setProfile((prev) => ({
              ...prev,
              photoUrl: photoUrl ?? prev.photoUrl,
            }));
            setAvatarUrl(photoUrl ?? null);
            push("Foto kandidat tersimpan", "success");
          } catch {
            push("Gagal menghubungi backend", "error");
          } finally {
            setIsPhotoUploading(false);
          }
        }}
        photoUploading={isPhotoUploading}
        onClose={() => setIsEditOpen(false)}
        onSave={async () => {
          const trimmedName = editName.trim();
          setIsProfileSaving(true);
          const profileResult = await callAdminApi<
            {
              electionId: string;
              candidateId: string;
              tagline: string;
              about: string;
              visi: string;
              misi: string;
              programKerja: string;
            },
            { ok: boolean }
          >("/api/admin/candidates/profile", {
            electionId: electionId.toString(),
            candidateId: cid.toString(),
            tagline: profile.tagline,
            about: profile.about,
            visi: profile.visi,
            misi: profile.misi,
            programKerja: profile.programKerja,
          });
          setIsProfileSaving(false);
          if (profileResult) {
            push("Profil kandidat disimpan", "success");
          }

          if (trimmedName && trimmedName !== name) {
            if (useRelayer) {
              if (!canRelay) {
                push("Login admin diperlukan", "error");
                return;
              }
              setIsEditingRelayer(true);
              const result = await callAdminRelayer("/api/admin/chain/update-candidate", {
                electionId: electionId.toString(),
                candidateId: cid.toString(),
                name: trimmedName,
              });
              if (result?.hash) setEditRelayHash(result.hash);
              setIsEditingRelayer(false);
            } else {
              updateCandidate({
                address: VOTING_ADDRESS,
                abi: VOTING_ABI,
                functionName: "updateCandidate",
                args: [electionId, cid, trimmedName],
              });
            }
          }
        }}
        isSaving={
          isEditingWallet ||
          isEditingRelayer ||
          isEditConfirming ||
          isProfileSaving ||
          isProfileLoading
        }
      />
    </div>
  );
}
