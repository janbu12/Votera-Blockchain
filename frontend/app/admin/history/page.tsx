"use client";

import { useRouter } from "next/navigation";
import { useEffect } from "react";
import { AdminHistory } from "@/components/admin/AdminHistory";

export default function AdminHistoryPage() {
  const router = useRouter();
  const useRelayer = true;

  useEffect(() => {
    if (!useRelayer) return;
    fetch("/api/admin/me")
      .then((res) => {
        if (!res.ok) {
          router.replace("/login");
        }
      })
      .catch(() => {
        router.replace("/login");
      });
  }, [useRelayer, router]);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.3em] text-amber-500">
            Admin
          </p>
          <h1 className="mt-2 text-2xl font-semibold text-slate-900">
            Riwayat Event
          </h1>
          <p className="mt-1 text-sm text-slate-500">
            Rekap event production yang sudah selesai.
          </p>
        </div>
        <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-xs text-slate-600">
          Mode relayer aktif: transaksi dibayar backend.
        </div>
      </div>

      <AdminHistory />
    </div>
  );
}
