"use client";

import { useEffect, useMemo, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { readContractQueryKey } from "@wagmi/core/query";
import { useReadContract, useWaitForTransactionReceipt, useWriteContract } from "wagmi";
import { VOTING_ABI, VOTING_ADDRESS } from "@/lib/contract";
import { formatTxToast } from "@/lib/tx";
import { useAdminSession } from "@/components/auth/useAdminSession";
import { useToast } from "@/components/ToastProvider";
import { ElectionRow } from "./ElectionRow";
import { CandidateModal } from "./CandidateModal";
import { Modal } from "@/components/Modal";
import { isUserRejectedError } from "./utils";

export function AdminActions({
  electionIds,
  createOpen,
  onCloseCreate,
}: {
  electionIds: bigint[];
  createOpen: boolean;
  onCloseCreate: () => void;
}) {
  const { push } = useToast();
  const useRelayer = true;
  const { isAdminAuthed } = useAdminSession();
  const canRelay = useRelayer && isAdminAuthed;
  const [title, setTitle] = useState("");
  const [candidateName, setCandidateName] = useState("");
  const [activeElectionId, setActiveElectionId] = useState<bigint | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [statusElectionId, setStatusElectionId] = useState<bigint | null>(null);
  const [scheduleElectionId, setScheduleElectionId] = useState("");
  const [opensAt, setOpensAt] = useState("");
  const [closesAt, setClosesAt] = useState("");
  const [scheduleMode, setScheduleMode] = useState<"manual" | "scheduled">("manual");
  const [scheduleMsg, setScheduleMsg] = useState<string | null>(null);
  const [isSavingSchedule, setIsSavingSchedule] = useState(false);
  const [isScheduleOpen, setIsScheduleOpen] = useState(false);
  const [statusFilter, setStatusFilter] = useState<
    "all" | "open" | "closed" | "scheduled" | "finished"
  >("all");
  const [modeFilter, setModeFilter] = useState<"all" | "manual" | "scheduled">(
    "all"
  );
  const [search, setSearch] = useState("");
  const [nowMs, setNowMs] = useState(() => Date.now());
  const [metaMap, setMetaMap] = useState<
    Record<
      string,
      {
        title: string;
        isOpen: boolean;
        mode: number;
        startTime: bigint;
        endTime: bigint;
        candidatesCount: bigint;
      }
    >
  >({});

  const [createRelayHash, setCreateRelayHash] = useState<`0x${string}` | null>(null);
  const [isCreatingRelayer, setIsCreatingRelayer] = useState(false);
  const {
    data: createHash,
    isPending: isCreatingWallet,
    writeContract: createElection,
    error: createError,
  } = useWriteContract();
  const activeCreateHash = useRelayer ? createRelayHash : createHash;
  const {
    data: createReceipt,
    isLoading: isCreateConfirming,
    isSuccess: isCreateSuccess,
  } = useWaitForTransactionReceipt({
    hash: activeCreateHash ?? undefined,
    confirmations: 1,
    query: { enabled: !!activeCreateHash },
  });

  const [statusRelayHash, setStatusRelayHash] = useState<`0x${string}` | null>(null);
  const [isChangingStatusRelayer, setIsChangingStatusRelayer] = useState(false);
  const {
    data: statusHash,
    isPending: isChangingStatusWallet,
    writeContract: changeStatus,
    error: statusError,
  } = useWriteContract();
  const activeStatusHash = useRelayer ? statusRelayHash : statusHash;
  const {
    data: statusReceipt,
    isLoading: isStatusConfirming,
    isSuccess: isStatusSuccess,
  } = useWaitForTransactionReceipt({
    hash: activeStatusHash ?? undefined,
    confirmations: 1,
    query: { enabled: !!activeStatusHash },
  });

  const queryClient = useQueryClient();

  useEffect(() => {
    if (isCreateSuccess) {
      queryClient.invalidateQueries({
        queryKey: readContractQueryKey({
          address: VOTING_ADDRESS,
          abi: VOTING_ABI,
          functionName: "electionsCount",
        }),
      });
      push(
        formatTxToast(
          "Event berhasil dibuat",
          activeCreateHash ?? undefined,
          createReceipt?.blockNumber
        ),
        "success"
      );
      setTimeout(() => {
        setTitle("");
      }, 0);
    }
  }, [isCreateSuccess, queryClient, push]);

  useEffect(() => {
    if (isStatusSuccess && statusElectionId) {
      queryClient.invalidateQueries({
        queryKey: readContractQueryKey({
          address: VOTING_ADDRESS,
          abi: VOTING_ABI,
          functionName: "getElection",
          args: [statusElectionId],
        }),
      });
      push(
        formatTxToast(
          "Status pemilihan diperbarui",
          activeStatusHash ?? undefined,
          statusReceipt?.blockNumber
        ),
        "success"
      );
    }
  }, [isStatusSuccess, statusElectionId, queryClient, push]);

  useEffect(() => {
    if (isUserRejectedError(createError)) {
      push("Transaksi dibatalkan", "info");
    }
  }, [createError, push]);

  useEffect(() => {
    if (isUserRejectedError(statusError)) {
      push("Transaksi dibatalkan", "info");
    }
  }, [statusError, push]);

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

  async function callAdminApi<T, R>(endpoint: string, body: T) {
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
        push(data?.reason ?? "Gagal memproses permintaan", "error");
        return null;
      }
      return data as R;
    } catch {
      push("Gagal menghubungi backend", "error");
      return null;
    }
  }

  const { data: scheduleElection } = useReadContract({
    address: VOTING_ADDRESS,
    abi: VOTING_ABI,
    functionName: "getElection",
    args: scheduleElectionId ? [BigInt(scheduleElectionId)] : undefined,
    query: { enabled: !!scheduleElectionId },
  });
  const scheduleModeLocked =
    scheduleElection && Number(scheduleElection[2]) === 1;

  useEffect(() => {
    const id = window.setInterval(() => setNowMs(Date.now()), 1000);
    return () => window.clearInterval(id);
  }, []);

  useEffect(() => {
    if (!scheduleElection) return;
    const modeValue = Number(scheduleElection[2]);
    setScheduleMode(modeValue === 1 ? "scheduled" : "manual");
    const startTime = Number(scheduleElection[3]);
    const endTime = Number(scheduleElection[4]);
    setOpensAt(startTime ? toLocalInput(startTime * 1000) : "");
    setClosesAt(endTime ? toLocalInput(endTime * 1000) : "");
  }, [scheduleElection]);

  const filteredElectionIds = useMemo(() => {
    return [...electionIds]
      .sort((a, b) => Number(b - a))
      .filter((id) => {
        const meta = metaMap[id.toString()];
        const title = meta?.title ?? "";
        const term = search.trim().toLowerCase();
        if (term && !title.toLowerCase().includes(term)) return false;
        if (!meta) return true;
        const isScheduled = meta.mode === 1;
        const endMs = Number(meta.endTime) * 1000;
        const finished = isScheduled && endMs > 0 && nowMs > endMs;

        if (modeFilter === "manual" && isScheduled) return false;
        if (modeFilter === "scheduled" && !isScheduled) return false;

        if (statusFilter === "open" && !meta.isOpen) return false;
        if (statusFilter === "closed" && meta.isOpen) return false;
        if (statusFilter === "scheduled" && !isScheduled) return false;
        if (statusFilter === "finished" && !finished) return false;
        return true;
      });
  }, [electionIds, metaMap, modeFilter, nowMs, search, statusFilter]);

  return (
    <div className="mt-6 space-y-6">
      <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h3 className="text-lg font-semibold text-slate-900">
              Daftar Event
            </h3>
            <p className="text-sm text-slate-500">
              Kelola status pemilihan dan kandidat dari daftar event.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Cari judul event..."
              className="w-full max-w-xs rounded-xl border border-slate-200 px-3 py-2 text-sm shadow-sm outline-none focus:border-slate-400"
            />
            <select
              value={statusFilter}
              onChange={(e) =>
                setStatusFilter(e.target.value as typeof statusFilter)
              }
              className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-600 shadow-sm outline-none focus:border-slate-400"
            >
              <option value="all">Semua Status</option>
              <option value="open">Open</option>
              <option value="closed">Closed</option>
              <option value="scheduled">Scheduled</option>
              <option value="finished">Selesai</option>
            </select>
            <select
              value={modeFilter}
              onChange={(e) =>
                setModeFilter(e.target.value as typeof modeFilter)
              }
              className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-600 shadow-sm outline-none focus:border-slate-400"
            >
              <option value="all">Semua Mode</option>
              <option value="manual">Manual</option>
              <option value="scheduled">Production</option>
            </select>
          </div>
        </div>

        {electionIds.length === 0 ? (
          <p className="mt-4 text-sm text-slate-500">
            Belum ada event. Buat event terlebih dulu.
          </p>
        ) : filteredElectionIds.length === 0 ? (
          <p className="mt-4 text-sm text-slate-500">
            Tidak ada event yang sesuai filter.
          </p>
        ) : (
          <div className="mt-4 space-y-3">
            {filteredElectionIds.map((id) => (
              <ElectionRow
                key={id.toString()}
                electionId={id}
                onAddCandidate={() => {
                  setActiveElectionId(id);
                  setCandidateName("");
                  setIsModalOpen(true);
                }}
                onSchedule={() => {
                  setScheduleElectionId(id.toString());
                  setIsScheduleOpen(true);
                }}
                onMetaChange={(meta) =>
                  setMetaMap((prev) => {
                    const key = id.toString();
                    const next = { ...prev, [key]: meta };
                    return next;
                  })
                }
                onToggleStatus={(isOpen) => {
                  setStatusElectionId(id);
                  if (useRelayer) {
                    if (!canRelay) {
                      push("Login admin diperlukan", "error");
                      return;
                    }
                    setIsChangingStatusRelayer(true);
                    callAdminRelayer(
                      isOpen
                        ? "/api/admin/chain/close-election"
                        : "/api/admin/chain/open-election",
                      { electionId: id.toString() }
                    ).then((result) => {
                      if (result?.hash) setStatusRelayHash(result.hash);
                      setIsChangingStatusRelayer(false);
                    });
                    return;
                  }
                  changeStatus({
                    address: VOTING_ADDRESS,
                    abi: VOTING_ABI,
                    functionName: isOpen ? "closeElection" : "openElection",
                    args: [id],
                  });
                }}
                isStatusPending={
                  isChangingStatusWallet || isChangingStatusRelayer || isStatusConfirming
                }
              />
            ))}
          </div>
        )}

        {statusError && !isUserRejectedError(statusError) && (
          <p className="mt-3 text-sm text-red-600">{statusError.message}</p>
        )}
      </div>

      <CandidateModal
        open={isModalOpen}
        electionIds={electionIds}
        activeElectionId={activeElectionId}
        candidateName={candidateName}
        onCandidateNameChange={setCandidateName}
        onClose={() => setIsModalOpen(false)}
      />

      <Modal
        open={createOpen}
        title="Buat Event Baru"
        description="Masukkan judul event pemilihan."
        onClose={onCloseCreate}
        widthClassName="max-w-lg"
      >
        <div className="space-y-4">
          <label className="block text-xs font-semibold text-slate-500">
            Judul event
            <input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Contoh: Pemilihan BEM 2024"
              className="mt-2 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm shadow-sm outline-none focus:border-slate-400"
            />
          </label>
          {createError && !isUserRejectedError(createError) && (
            <p className="text-sm text-red-600">{createError.message}</p>
          )}
          <div className="flex justify-end gap-2">
            <button
              onClick={onCloseCreate}
              className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-600 transition hover:bg-slate-50"
            >
              Batal
            </button>
            <button
              onClick={() =>
                (async () => {
                  if (useRelayer) {
                    if (!canRelay) {
                      push("Login admin diperlukan", "error");
                      return;
                    }
                    setIsCreatingRelayer(true);
                    const result = await callAdminRelayer("/api/admin/chain/create-election", {
                      title: title.trim(),
                    });
                    if (result?.hash) setCreateRelayHash(result.hash);
                    setIsCreatingRelayer(false);
                  } else {
                    createElection({
                      address: VOTING_ADDRESS,
                      abi: VOTING_ABI,
                      functionName: "createElection",
                      args: [title.trim()],
                    });
                  }
                })()
              }
              disabled={
                isCreatingWallet ||
                isCreatingRelayer ||
                isCreateConfirming ||
                title.trim().length === 0 ||
                (useRelayer && !canRelay)
              }
              className="rounded-lg bg-slate-900 px-4 py-2 text-sm font-semibold text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:bg-slate-400"
            >
              {isCreatingWallet || isCreatingRelayer
                ? useRelayer
                  ? "Mengirim..."
                  : "Menunggu MetaMask..."
                : isCreateConfirming
                ? "Mengonfirmasi..."
                : "Buat"}
            </button>
          </div>
        </div>
      </Modal>

      <Modal
        open={isScheduleOpen}
        title="Atur Jadwal Event"
        description="Pilih event dan atur mode serta jadwalnya."
        onClose={() => setIsScheduleOpen(false)}
        widthClassName="max-w-2xl"
      >
        <div className="space-y-4">
          <p className="text-sm text-slate-500">
            Atur kapan event dibuka dan ditutup (format lokal).
          </p>
          <div className="grid gap-3 md:grid-cols-[1.2fr_1fr_1fr_1fr]">
            <select
              value={scheduleElectionId}
              onChange={(e) => setScheduleElectionId(e.target.value)}
              className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm shadow-sm outline-none focus:border-slate-400"
            >
              <option value="">Pilih event</option>
              {electionIds.map((id) => (
                <option key={id.toString()} value={id.toString()}>
                  Event #{id.toString()}
                </option>
              ))}
            </select>
            <select
              value={scheduleMode}
              onChange={(e) =>
                setScheduleMode(e.target.value === "scheduled" ? "scheduled" : "manual")
              }
              className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm shadow-sm outline-none focus:border-slate-400"
              disabled={!!scheduleModeLocked}
            >
              <option value="manual">Simulasi (Manual)</option>
              <option value="scheduled">Production (Terjadwal)</option>
            </select>
            <input
              type="datetime-local"
              value={opensAt}
              onChange={(e) => setOpensAt(e.target.value)}
              className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm shadow-sm outline-none focus:border-slate-400"
              disabled={scheduleMode !== "scheduled"}
            />
            <input
              type="datetime-local"
              value={closesAt}
              onChange={(e) => setClosesAt(e.target.value)}
              className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm shadow-sm outline-none focus:border-slate-400"
              disabled={scheduleMode !== "scheduled"}
            />
          </div>
          {scheduleModeLocked && (
            <p className="text-xs text-amber-600">
              Mode production sudah aktif dan tidak bisa kembali ke manual.
            </p>
          )}
          {scheduleMsg && <p className="text-xs text-slate-500">{scheduleMsg}</p>}
          <div className="flex justify-end gap-2">
            <button
              onClick={() => setIsScheduleOpen(false)}
              className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-600 transition hover:bg-slate-50"
            >
              Batal
            </button>
            <button
              onClick={async () => {
                if (!scheduleElectionId) {
                  push("Pilih event terlebih dahulu", "info");
                  return;
                }
                if (scheduleMode === "scheduled" && (!opensAt || !closesAt)) {
                  push("Jadwal wajib diisi", "info");
                  return;
                }
                setScheduleMsg(null);
                setIsSavingSchedule(true);
                const result = await callAdminApi<
                  {
                    electionId: string;
                    mode: "manual" | "scheduled";
                    opensAt: string | null;
                    closesAt: string | null;
                  },
                  { ok: boolean }
                >("/api/admin/elections/schedule", {
                  electionId: scheduleElectionId,
                  mode: scheduleMode,
                  opensAt:
                    scheduleMode === "scheduled" && opensAt
                      ? new Date(opensAt).toISOString()
                      : null,
                  closesAt:
                    scheduleMode === "scheduled" && closesAt
                      ? new Date(closesAt).toISOString()
                      : null,
                });
                setIsSavingSchedule(false);
                if (result) {
                  setScheduleMsg(
                    scheduleMode === "scheduled"
                      ? "Mode production aktif. Jadwal tersimpan di blockchain."
                      : "Mode simulasi aktif."
                  );
                  if (scheduleElectionId) {
                    queryClient.invalidateQueries({
                      queryKey: readContractQueryKey({
                        address: VOTING_ADDRESS,
                        abi: VOTING_ABI,
                        functionName: "getElection",
                        args: [BigInt(scheduleElectionId)],
                      }),
                    });
                  }
                }
              }}
              disabled={isSavingSchedule || !useRelayer || (useRelayer && !canRelay)}
              className="rounded-lg bg-slate-900 px-4 py-2 text-sm font-semibold text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:bg-slate-400"
            >
              {isSavingSchedule ? "Menyimpan..." : "Simpan"}
            </button>
          </div>
        </div>
      </Modal>
    </div>
  );
}

function toLocalInput(timestampMs: number) {
  const date = new Date(timestampMs);
  const pad = (value: number) => String(value).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(
    date.getDate()
  )}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}
