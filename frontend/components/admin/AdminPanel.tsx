"use client";

import { useMemo, useState } from "react";
import { useReadContract } from "wagmi";
import { VOTING_ABI, VOTING_ADDRESS } from "@/lib/contract";
import { useAdminSession } from "@/components/auth/useAdminSession";
import { AdminActions } from "./AdminActions";

export function AdminPanel() {
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const useRelayer = true;
  const { isAdminAuthed } = useAdminSession();
  const { data: electionsCount } = useReadContract({
    address: VOTING_ADDRESS,
    abi: VOTING_ABI,
    functionName: "electionsCount",
    query: { enabled: true },
  });

  const isAdmin = isAdminAuthed;

  const electionIds = useMemo(() => {
    const n = Number(electionsCount ?? BigInt(0));
    return Array.from({ length: n }, (_, i) => BigInt(i + 1));
  }, [electionsCount]);

  return (
    <div className="mt-8 border-t border-slate-200 pt-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-xl font-semibold text-slate-900">Admin Panel</h2>
          <p className="mt-2 text-sm text-slate-600">
            Status:{" "}
            <span
              className={`font-semibold ${
                isAdmin ? "text-emerald-600" : "text-slate-400"
              }`}
            >
              {useRelayer ? "Relayer" : isAdmin ? "Admin" : "Bukan admin"}
            </span>
          </p>
        </div>
        {isAdmin && (
          <button
            onClick={() => setIsCreateOpen(true)}
            className="rounded-lg bg-slate-900 px-4 py-2 text-xs font-semibold text-white transition hover:bg-slate-800"
          >
            Buat Event
          </button>
        )}
      </div>
      {isAdmin ? (
        <AdminActions
          electionIds={electionIds}
          createOpen={isCreateOpen}
          onCloseCreate={() => setIsCreateOpen(false)}
        />
      ) : (
        <p className="mt-3 text-sm text-slate-500">
          Hanya admin yang bisa mengelola event.
        </p>
      )}
    </div>
  );
}
