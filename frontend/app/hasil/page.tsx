"use client";

import { useEffect, useState } from "react";

type PublicResult = {
  electionId: string;
  title: string;
  totalVotes: number;
  snapshotAt: string;
  publishedAt: string | null;
  results: {
    candidates: Array<{ id: string; name: string; voteCount: number }>;
  };
};

export default function PublicResultsPage() {
  const [items, setItems] = useState<PublicResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setLoading(true);
    fetch("/api/public/results")
      .then((res) => res.json().then((data) => ({ ok: res.ok, data })))
      .then((result) => {
        if (result.ok) {
          setItems(result.data.items ?? []);
        } else {
          setError(result.data?.reason ?? "Gagal memuat hasil");
        }
      })
      .catch(() => setError("Gagal menghubungi server"))
      .finally(() => setLoading(false));
  }, []);

  return (
    <div className="mx-auto max-w-5xl space-y-6 px-6 py-10">
      <div>
        <p className="text-xs font-semibold uppercase tracking-[0.3em] text-emerald-500">
          Hasil Pemilihan
        </p>
        <h1 className="mt-2 text-2xl font-semibold text-slate-900">
          Rekapitulasi Resmi
        </h1>
        <p className="mt-2 text-sm text-slate-500">
          Berikut daftar event yang sudah dipublikasikan oleh admin.
        </p>
      </div>

      {loading ? (
        <div className="rounded-2xl border border-slate-200 bg-white p-5 text-sm text-slate-500">
          Memuat hasil...
        </div>
      ) : error ? (
        <div className="rounded-2xl border border-rose-200 bg-rose-50 p-5 text-sm text-rose-600">
          {error}
        </div>
      ) : items.length === 0 ? (
        <div className="rounded-2xl border border-slate-200 bg-white p-5 text-sm text-slate-500">
          Belum ada hasil yang dipublikasikan.
        </div>
      ) : (
        <div className="space-y-4">
          {items.map((item) => (
            <div
              key={item.electionId}
              className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm"
            >
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <p className="text-sm font-semibold text-slate-900">{item.title}</p>
                  <p className="mt-1 text-xs text-slate-500">
                    Event #{item.electionId} • Dipublikasikan{" "}
                    {item.publishedAt
                      ? new Date(item.publishedAt).toLocaleString("id-ID")
                      : "-"}
                  </p>
                </div>
                <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-2 text-xs font-semibold text-emerald-700">
                  Total suara: {item.totalVotes}
                </div>
              </div>
              <div className="mt-4 space-y-2">
                {(item.results?.candidates ?? []).map((candidate) => (
                  <div
                    key={`${item.electionId}-${candidate.id}`}
                    className="flex items-center justify-between rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs"
                  >
                    <span className="font-semibold text-slate-700">
                      {candidate.name}
                    </span>
                    <span className="font-semibold text-slate-600">
                      {candidate.voteCount}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
