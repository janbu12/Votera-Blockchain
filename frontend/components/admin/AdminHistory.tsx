"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useReadContract } from "wagmi";
import { VOTING_ABI, VOTING_ADDRESS } from "@/lib/contract";
import { useToast } from "@/components/ToastProvider";

export function AdminHistory() {
  const [tab, setTab] = useState<"events" | "audit">("events");
  const [searchTitle, setSearchTitle] = useState("");
  const [filterYear, setFilterYear] = useState("all");
  const [filterMonth, setFilterMonth] = useState("all");
  const useRelayer = true;

  const { data: count, isLoading, error } = useReadContract({
    address: VOTING_ADDRESS,
    abi: VOTING_ABI,
    functionName: "electionsCount",
    query: { enabled: true },
  });

  const electionIds = useMemo(() => {
    const n = Number(count ?? BigInt(0));
    return Array.from({ length: n }, (_, i) => BigInt(i + 1));
  }, [count]);

  if (isLoading) {
    return (
      <div className="rounded-2xl border border-slate-200 bg-white p-5 text-sm text-slate-500">
        Memuat riwayat...
      </div>
    );
  }
  if (error) {
    return (
      <div className="rounded-2xl border border-slate-200 bg-white p-5 text-sm text-rose-600">
        Gagal memuat data: {error.message}
      </div>
    );
  }
  if (!count || count === BigInt(0)) {
    return (
      <div className="rounded-2xl border border-slate-200 bg-white p-5 text-sm text-slate-500">
        Belum ada event.
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold text-slate-900">Riwayat</h2>
          <p className="text-xs text-slate-500">
            Rekap event selesai dan aktivitas admin.
          </p>
        </div>
        <div className="flex rounded-full border border-slate-200 bg-white p-1 text-xs font-semibold text-slate-600">
          <button
            onClick={() => setTab("events")}
            className={`rounded-full px-3 py-1 transition ${
              tab === "events"
                ? "bg-slate-900 text-white"
                : "text-slate-600 hover:bg-slate-50"
            }`}
          >
            Riwayat Event
          </button>
          <button
            onClick={() => setTab("audit")}
            className={`rounded-full px-3 py-1 transition ${
              tab === "audit"
                ? "bg-slate-900 text-white"
                : "text-slate-600 hover:bg-slate-50"
            }`}
          >
            Audit Log
          </button>
        </div>
      </div>

      {tab === "events" ? (
        <div className="space-y-4">
          <div className="flex flex-wrap items-center gap-2">
            <input
              value={searchTitle}
              onChange={(e) => setSearchTitle(e.target.value)}
              placeholder="Cari judul event..."
              className="w-full max-w-xs rounded-xl border border-slate-200 px-3 py-2 text-sm shadow-sm outline-none focus:border-slate-400"
            />
            <select
              value={filterYear}
              onChange={(e) => setFilterYear(e.target.value)}
              className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-600 shadow-sm outline-none focus:border-slate-400"
            >
              <option value="all">Semua Tahun</option>
              {Array.from({ length: 5 }, (_, i) => new Date().getFullYear() - i).map(
                (year) => (
                  <option key={year} value={String(year)}>
                    {year}
                  </option>
                )
              )}
            </select>
            <select
              value={filterMonth}
              onChange={(e) => setFilterMonth(e.target.value)}
              className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-600 shadow-sm outline-none focus:border-slate-400"
            >
              <option value="all">Semua Bulan</option>
              {Array.from({ length: 12 }, (_, i) => i + 1).map((month) => (
                <option key={month} value={String(month)}>
                  {new Date(2024, month - 1, 1).toLocaleString("id-ID", {
                    month: "long",
                  })}
                </option>
              ))}
            </select>
          </div>

          {electionIds.map((id) => (
            <HistoryElectionCard
              key={id.toString()}
              electionId={id}
              searchTitle={searchTitle}
              filterYear={filterYear}
              filterMonth={filterMonth}
            />
          ))}
        </div>
      ) : (
        <AuditLogPanel />
      )}
    </div>
  );
}

function HistoryElectionCard({
  electionId,
  searchTitle,
  filterYear,
  filterMonth,
}: {
  electionId: bigint;
  searchTitle: string;
  filterYear: string;
  filterMonth: string;
}) {
  const useRelayer = true;
  const { data: election } = useReadContract({
    address: VOTING_ADDRESS,
    abi: VOTING_ABI,
    functionName: "getElection",
    args: [electionId],
    query: { enabled: true },
  });
  const { push } = useToast();

  const [nowMs, setNowMs] = useState(() => Date.now());

  useEffect(() => {
    const id = window.setInterval(() => setNowMs(Date.now()), 1000);
    return () => window.clearInterval(id);
  }, []);

  const candidatesCount = election ? election[5] : BigInt(0);
  const ids = useMemo(() => {
    const n = Number(candidatesCount ?? BigInt(0));
    return Array.from({ length: n }, (_, i) => BigInt(i + 1));
  }, [candidatesCount]);

  const [voteMap, setVoteMap] = useState<Record<string, bigint>>({});
  const [isExportingCsv, setIsExportingCsv] = useState(false);
  const [isExportingXlsx, setIsExportingXlsx] = useState(false);
  const [exportError, setExportError] = useState<string | null>(null);
  const [resultInfo, setResultInfo] = useState<{
    published: boolean;
    snapshotAt: string | null;
    publishedAt: string | null;
  } | null>(null);
  const [resultLoading, setResultLoading] = useState(false);
  const [resultError, setResultError] = useState<string | null>(null);
  const [voters, setVoters] = useState<Array<{ nim: string; votedAt: string }>>([]);
  const [votersLoading, setVotersLoading] = useState(false);
  const [votersError, setVotersError] = useState<string | null>(null);
  const [votersOpen, setVotersOpen] = useState(false);
  const [votersSearch, setVotersSearch] = useState("");
  const handleCount = useCallback((candidateKey: string, count: bigint) => {
    setVoteMap((prev) =>
      prev[candidateKey] === count ? prev : { ...prev, [candidateKey]: count }
    );
  }, []);
  const totalVotes = useMemo(() => {
    let total = BigInt(0);
    for (const value of Object.values(voteMap)) {
      total += value;
    }
    return total;
  }, [voteMap]);

  const finished = useMemo(() => {
    if (!election) return false;
    const [, , mode, , endTime] = election;
    const isProduction = Number(mode) === 1;
    const endMs = Number(endTime) * 1000;
    return isProduction && !!endMs && nowMs > endMs;
  }, [election, nowMs]);

  useEffect(() => {
    let ignore = false;
    if (!election) return () => {};
    if (!finished) return () => {};
    setResultLoading(true);
    fetch(`/api/admin/results/${electionId.toString()}`)
      .then((res) => res.json().then((data) => ({ ok: res.ok, data })))
      .then((result) => {
        if (ignore) return;
        if (result.ok) {
          const info = result.data?.result;
          setResultInfo(
            info
              ? {
                  published: !!info.published,
                  snapshotAt: info.snapshotAt ?? null,
                  publishedAt: info.publishedAt ?? null,
                }
              : null
          );
          setResultError(null);
        } else {
          setResultError(result.data?.reason ?? "Gagal memuat hasil");
        }
      })
      .catch(() => {
        if (ignore) return;
        setResultError("Gagal menghubungi backend");
      })
      .finally(() => {
        if (ignore) return;
        setResultLoading(false);
      });
    return () => {
      ignore = true;
    };
  }, [electionId, election, finished]);

  const loadVoters = async () => {
    setVotersLoading(true);
    setVotersError(null);
    try {
      const res = await fetch(`/api/admin/voters/${electionId.toString()}`);
      const data = await res.json();
      if (!res.ok) {
        setVotersError(data?.reason ?? "Gagal memuat daftar pemilih");
        setVotersLoading(false);
        return;
      }
      setVoters(data?.voters ?? []);
    } catch {
      setVotersError("Gagal menghubungi backend");
    } finally {
      setVotersLoading(false);
    }
  };

  const filteredVoters = useMemo(() => {
    const term = votersSearch.trim().toLowerCase();
    if (!term) return voters;
    return voters.filter((item) => item.nim.toLowerCase().includes(term));
  }, [voters, votersSearch]);

  if (!election) return null;

  const [title, isOpen, mode, startTime, endTime] = election;
  if (!finished) return null;

  if (searchTitle.trim()) {
    const term = searchTitle.trim().toLowerCase();
    if (!String(title).toLowerCase().includes(term)) return null;
  }

  if (filterYear !== "all" || filterMonth !== "all") {
    const endMs = Number(endTime) * 1000;
    if (!endMs) return null;
    const date = new Date(endMs);
    if (filterYear !== "all" && date.getFullYear() !== Number(filterYear)) {
      return null;
    }
    if (filterMonth !== "all" && date.getMonth() + 1 !== Number(filterMonth)) {
      return null;
    }
  }

  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-5">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-[220px]">
          <p className="text-sm font-semibold text-slate-900">{title}</p>
          <div className="mt-2 flex flex-wrap items-center gap-2 text-xs text-slate-500">
            <span className="rounded-full border border-slate-200 bg-slate-50 px-2 py-1">
              ID {electionId.toString()}
            </span>
            <span className="rounded-full border border-slate-200 bg-slate-50 px-2 py-1">
              Production
            </span>
            <span className="rounded-full border border-slate-200 bg-slate-50 px-2 py-1">
              {isOpen ? "Open" : "Closed"}
            </span>
          </div>
          <p className="mt-2 text-xs text-slate-500">
            Buka: {formatTime(startTime)} • Tutup: {formatTime(endTime)}
          </p>
          <p className="mt-1 text-xs text-slate-500">
            Publik:{" "}
            {resultInfo?.published
              ? `Aktif sejak ${resultInfo.publishedAt ?? "-"}`
              : "Belum dipublikasikan"}
          </p>
        </div>
        <div className="flex flex-1 flex-wrap items-center justify-end gap-2">
          <div className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-2 text-xs font-semibold text-slate-700">
            Total suara: {totalVotes.toString()}
          </div>
          <span
            className={`rounded-full px-3 py-1 text-[10px] font-semibold uppercase tracking-wide ${
              resultInfo?.published
                ? "bg-emerald-100 text-emerald-700"
                : resultInfo
                ? "bg-amber-100 text-amber-700"
                : "bg-slate-200 text-slate-600"
            }`}
          >
            {resultInfo?.published
              ? "Published"
              : resultInfo
              ? "Final"
              : "Belum final"}
          </span>
          <button
            onClick={async () => {
              setExportError(null);
              setIsExportingCsv(true);
              try {
                const res = await fetch(
                  `/api/admin/export/elections/${electionId.toString()}`
                );
                if (!res.ok) {
                  const data = await res.json();
                  setExportError(data?.reason ?? "Gagal export hasil");
                  setIsExportingCsv(false);
                  return;
                }
                const blob = await res.blob();
                const url = URL.createObjectURL(blob);
                const link = document.createElement("a");
                link.href = url;
                link.download = `election-${electionId.toString()}-results.csv`;
                document.body.appendChild(link);
                link.click();
                document.body.removeChild(link);
                URL.revokeObjectURL(url);
              } catch {
                setExportError("Gagal menghubungi backend");
              } finally {
                setIsExportingCsv(false);
              }
            }}
            className="rounded-lg border border-slate-300 px-3 py-2 text-xs font-semibold text-slate-600 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60"
            disabled={isExportingCsv || isExportingXlsx}
          >
            {isExportingCsv ? "Menyiapkan..." : "Export CSV"}
          </button>
          <button
            onClick={async () => {
              setExportError(null);
              setIsExportingXlsx(true);
              try {
                const res = await fetch(
                  `/api/admin/export/elections/${electionId.toString()}/xlsx`
                );
                if (!res.ok) {
                  const data = await res.json();
                  setExportError(data?.reason ?? "Gagal export hasil");
                  setIsExportingXlsx(false);
                  return;
                }
                const blob = await res.blob();
                const url = URL.createObjectURL(blob);
                const link = document.createElement("a");
                link.href = url;
                link.download = `election-${electionId.toString()}-results.xlsx`;
                document.body.appendChild(link);
                link.click();
                document.body.removeChild(link);
                URL.revokeObjectURL(url);
              } catch {
                setExportError("Gagal menghubungi backend");
              } finally {
                setIsExportingXlsx(false);
              }
            }}
            className="rounded-lg border border-emerald-200 px-3 py-2 text-xs font-semibold text-emerald-700 transition hover:bg-emerald-50 disabled:cursor-not-allowed disabled:opacity-60"
            disabled={isExportingCsv || isExportingXlsx}
          >
            {isExportingXlsx ? "Menyiapkan..." : "Export Excel"}
          </button>
          <button
            onClick={async () => {
              if (resultInfo?.published) {
                push("Hasil sudah dipublikasikan", "info");
                return;
              }
              setResultLoading(true);
              setResultError(null);
              const res = await fetch(
                `/api/admin/results/${electionId.toString()}/finalize`,
                { method: "POST" }
              );
              const data = await res.json();
              if (!res.ok) {
                setResultError(data?.reason ?? "Gagal finalisasi hasil");
                setResultLoading(false);
                return;
              }
              setResultInfo((prev) => ({
                published: false,
                snapshotAt: data?.result?.snapshotAt ?? prev?.snapshotAt ?? null,
                publishedAt: null,
              }));
              push("Hasil berhasil difinalisasi", "success");
              setResultLoading(false);
            }}
            className="rounded-lg border border-slate-300 px-3 py-2 text-xs font-semibold text-slate-600 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60"
            disabled={resultLoading || !!resultInfo?.published || !!resultInfo}
          >
            {resultInfo ? "Sudah Final" : resultLoading ? "Memproses..." : "Finalisasi"}
          </button>
          <button
            onClick={async () => {
              if (!resultInfo) {
                push("Finalisasi dulu sebelum publish", "info");
                return;
              }
              setResultLoading(true);
              setResultError(null);
              const res = await fetch(
                `/api/admin/results/${electionId.toString()}/publish`,
                { method: "POST" }
              );
              const data = await res.json();
              if (!res.ok) {
                setResultError(data?.reason ?? "Gagal publish hasil");
                setResultLoading(false);
                return;
              }
              setResultInfo((prev) => ({
                published: true,
                snapshotAt: prev?.snapshotAt ?? null,
                publishedAt: data?.publishedAt ?? new Date().toISOString(),
              }));
              push("Hasil dipublikasikan", "success");
              setResultLoading(false);
            }}
            className="rounded-lg border border-emerald-200 px-3 py-2 text-xs font-semibold text-emerald-700 transition hover:bg-emerald-50 disabled:cursor-not-allowed disabled:opacity-60"
            disabled={resultLoading || !!resultInfo?.published || !resultInfo}
          >
            {resultInfo?.published ? "Sudah Publish" : "Publikasikan"}
          </button>
          <button
            onClick={() => {
              const next = !votersOpen;
              setVotersOpen(next);
              if (next && voters.length === 0) {
                loadVoters();
              }
            }}
            className="rounded-lg border border-indigo-200 px-3 py-2 text-xs font-semibold text-indigo-700 transition hover:bg-indigo-50"
          >
            Daftar Pemilih
          </button>
        </div>
      </div>
      {resultError && <p className="mt-2 text-xs text-rose-600">{resultError}</p>}

      {votersOpen && (
        <div className="mt-4 rounded-2xl border border-slate-200 bg-slate-50 p-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="text-sm font-semibold text-slate-700">
              Pemilih unik
              <span className="ml-2 text-xs text-slate-500">
                {votersLoading ? "" : `${voters.length} NIM`}
              </span>
            </p>
            <div className="flex flex-wrap items-center gap-2">
              <input
                value={votersSearch}
                onChange={(e) => setVotersSearch(e.target.value)}
                placeholder="Cari NIM..."
                className="w-full max-w-xs rounded-xl border border-slate-200 px-3 py-2 text-xs shadow-sm outline-none focus:border-slate-400"
              />
              <button
                onClick={loadVoters}
                className="rounded-lg border border-slate-200 px-3 py-2 text-xs font-semibold text-slate-600 transition hover:bg-slate-100"
                disabled={votersLoading}
              >
                {votersLoading ? "Memuat..." : "Refresh"}
              </button>
            </div>
          </div>

          {votersError ? (
            <p className="mt-2 text-xs text-rose-600">{votersError}</p>
          ) : votersLoading ? (
            <p className="mt-3 text-xs text-slate-500">Memuat daftar pemilih...</p>
          ) : filteredVoters.length === 0 ? (
            <p className="mt-3 text-xs text-slate-500">
              Belum ada pemilih untuk event ini.
            </p>
          ) : (
            <div className="mt-3 max-h-56 overflow-auto rounded-xl border border-slate-200 bg-white">
              <table className="w-full text-left text-xs">
                <thead className="sticky top-0 bg-slate-100 text-[11px] uppercase tracking-wide text-slate-500">
                  <tr>
                    <th className="px-3 py-2">NIM</th>
                    <th className="px-3 py-2">Waktu Voting</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredVoters.map((item) => (
                    <tr key={item.nim} className="border-t border-slate-100">
                      <td className="px-3 py-2 font-semibold text-slate-700">
                        {item.nim}
                      </td>
                      <td className="px-3 py-2 text-slate-500">
                        {new Date(item.votedAt).toLocaleString("id-ID")}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}
      {exportError && (
        <p className="mt-2 text-xs text-rose-600">{exportError}</p>
      )}

      <div className="mt-4 space-y-2">
        {ids.length === 0 ? (
          <p className="text-xs text-slate-500">Belum ada kandidat.</p>
        ) : (
          ids.map((id) => (
            <CandidateVoteRow
              key={`${electionId.toString()}-${id.toString()}`}
              electionId={electionId}
              candidateId={id}
              onCount={handleCount}
            />
          ))
        )}
      </div>
    </div>
  );
}

function CandidateVoteRow({
  electionId,
  candidateId,
  onCount,
}: {
  electionId: bigint;
  candidateId: bigint;
  onCount: (key: string, count: bigint) => void;
}) {
  const { data } = useReadContract({
    address: VOTING_ADDRESS,
    abi: VOTING_ABI,
    functionName: "getCandidate",
    args: [electionId, candidateId],
  });

  const cid = data ? data[0] : candidateId;
  const name = data ? data[1] : "Kandidat";
  const voteCount = data ? data[2] : BigInt(0);
  const isActive = data ? data[3] : true;
  const key = `${electionId.toString()}-${cid.toString()}`;

  useEffect(() => {
    if (!data) return;
    onCount(key, voteCount);
  }, [data, key, voteCount, onCount]);

  if (!data) return null;

  return (
    <div className="flex items-center justify-between rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs">
      <div className="flex items-center gap-2 text-slate-700">
        <span className="font-semibold">{name}</span>
        {!isActive && (
          <span className="rounded-full bg-slate-200 px-2 py-0.5 text-[10px] font-semibold text-slate-500">
            Hidden
          </span>
        )}
      </div>
      <span className="font-semibold text-slate-600">{voteCount.toString()}</span>
    </div>
  );
}

function formatTime(value: bigint) {
  const num = Number(value);
  if (!num) return "Belum diatur";
  return new Date(num * 1000).toLocaleString("id-ID");
}

function AuditLogPanel() {
  const [items, setItems] = useState<
    Array<{
      id: number;
      adminUsername: string;
      action: string;
      meta: Record<string, unknown> | null;
      createdAt: string;
    }>
  >([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [actionFilter, setActionFilter] = useState("");
  const [adminFilter, setAdminFilter] = useState("");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [summary, setSummary] = useState<{
    since: string;
    totalActions: number;
    topAdmins: Array<{ admin: string; count: number }>;
    actionsByDay: Array<{ day: string; count: number }>;
    actionsByDayFilled?: Array<{ day: string; count: number }>;
    topActions: Array<{ action: string; count: number }>;
  } | null>(null);
  const [summaryError, setSummaryError] = useState<string | null>(null);

  const loadLogs = useCallback(() => {
    setLoading(true);
    setError(null);
    fetch("/api/admin/audit?limit=50")
      .then((res) => res.json().then((data) => ({ ok: res.ok, data })))
      .then((result) => {
        if (result.ok) {
          setItems(result.data.items ?? []);
        } else {
          setError(result.data?.reason ?? "Gagal memuat audit log");
        }
      })
      .catch(() => {
        setError("Gagal menghubungi backend");
      })
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    loadLogs();
  }, [loadLogs]);

  useEffect(() => {
    fetch("/api/admin/audit/summary")
      .then((res) => res.json().then((data) => ({ ok: res.ok, data })))
      .then((result) => {
        if (result.ok) {
          setSummary(result.data.summary ?? null);
        } else {
          setSummaryError(result.data?.reason ?? "Gagal memuat ringkasan audit");
        }
      })
      .catch(() => {
        setSummaryError("Gagal menghubungi backend");
      });
  }, []);

  const filtered = items.filter((item) => {
    const actionTerm = actionFilter.trim().toLowerCase();
    const adminTerm = adminFilter.trim().toLowerCase();
    if (actionTerm && !item.action.toLowerCase().includes(actionTerm)) {
      return false;
    }
    if (adminTerm && !item.adminUsername.toLowerCase().includes(adminTerm)) {
      return false;
    }
    if (dateFrom) {
      const from = new Date(dateFrom).getTime();
      if (!Number.isNaN(from) && new Date(item.createdAt).getTime() < from) {
        return false;
      }
    }
    if (dateTo) {
      const to = new Date(dateTo).getTime();
      if (
        !Number.isNaN(to) &&
        new Date(item.createdAt).getTime() > to + 24 * 60 * 60 * 1000
      ) {
        return false;
      }
    }
    return true;
  });

  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-5">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h3 className="text-lg font-semibold text-slate-900">Audit Log</h3>
        <button
          onClick={loadLogs}
          className="rounded-lg border border-slate-300 px-3 py-2 text-xs font-semibold text-slate-600 transition hover:bg-slate-50"
          disabled={loading}
        >
          {loading ? "Memuat..." : "Refresh"}
        </button>
      </div>
      <div className="mt-3 flex flex-wrap items-center gap-2 text-xs">
        <input
          value={actionFilter}
          onChange={(e) => setActionFilter(e.target.value)}
          placeholder="Filter aksi..."
          className="w-full max-w-xs rounded-xl border border-slate-200 px-3 py-2 text-xs shadow-sm outline-none focus:border-slate-400"
        />
        <input
          value={adminFilter}
          onChange={(e) => setAdminFilter(e.target.value)}
          placeholder="Filter admin..."
          className="w-full max-w-xs rounded-xl border border-slate-200 px-3 py-2 text-xs shadow-sm outline-none focus:border-slate-400"
        />
        <input
          type="date"
          value={dateFrom}
          onChange={(e) => setDateFrom(e.target.value)}
          className="rounded-xl border border-slate-200 px-3 py-2 text-xs shadow-sm outline-none focus:border-slate-400"
        />
        <input
          type="date"
          value={dateTo}
          onChange={(e) => setDateTo(e.target.value)}
          className="rounded-xl border border-slate-200 px-3 py-2 text-xs shadow-sm outline-none focus:border-slate-400"
        />
      </div>

      {summary && (
        <div className="mt-3 grid gap-3 text-xs text-slate-600 md:grid-cols-3">
          <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
            <p className="text-[11px] font-semibold text-slate-500">Total Aksi (30 hari)</p>
            <p className="mt-2 text-lg font-semibold text-slate-900">
              {summary.totalActions}
            </p>
            <p className="mt-1 text-[11px] text-slate-500">
              Sejak {new Date(summary.since).toLocaleDateString("id-ID")}
            </p>
          </div>
          <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
            <p className="text-[11px] font-semibold text-slate-500">Admin Teraktif</p>
            <div className="mt-2 space-y-1">
              {summary.topAdmins.map((item) => (
                <div key={item.admin} className="flex items-center justify-between">
                  <span className="font-semibold text-slate-700">{item.admin}</span>
                  <span className="text-slate-500">{item.count}</span>
                </div>
              ))}
            </div>
          </div>
          <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
            <p className="text-[11px] font-semibold text-slate-500">Aksi Terbanyak</p>
            <div className="mt-2 space-y-1">
              {summary.topActions.map((item) => (
                <div key={item.action} className="flex items-center justify-between">
                  <span className="font-semibold text-slate-700">{item.action}</span>
                  <span className="text-slate-500">{item.count}</span>
                </div>
              ))}
            </div>
          </div>
          <div className="rounded-xl border border-slate-200 bg-slate-50 p-3 md:col-span-3">
            <p className="text-[11px] font-semibold text-slate-500">Aksi per hari</p>
            <div className="mt-2 h-24">
              <MiniBarChart
                data={summary.actionsByDayFilled ?? summary.actionsByDay}
              />
            </div>
          </div>
        </div>
      )}
      {summaryError && (
        <p className="mt-2 text-xs text-rose-600">{summaryError}</p>
      )}

      {error ? (
        <p className="mt-2 text-xs text-rose-600">{error}</p>
      ) : filtered.length === 0 ? (
        <p className="mt-2 text-xs text-slate-500">Belum ada aktivitas admin.</p>
      ) : (
        <div className="mt-3 space-y-2">
          {filtered.map((item) => (
            <div
              key={item.id}
              className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-600"
            >
              <div className="flex flex-wrap items-center justify-between gap-2">
                <span className="font-semibold text-slate-800">
                  {item.action}
                </span>
                <span className="text-[11px] text-slate-500">
                  {new Date(item.createdAt).toLocaleString("id-ID")}
                </span>
              </div>
              <div className="mt-1 flex flex-wrap items-center gap-2">
                <span className="rounded-full bg-slate-200 px-2 py-0.5 text-[10px] font-semibold uppercase text-slate-500">
                  {item.adminUsername}
                </span>
                {item.meta && (
                  <span className="text-[11px] text-slate-500">
                    {JSON.stringify(item.meta)}
                  </span>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function MiniBarChart({ data }: { data: Array<{ day: string; count: number }> }) {
  if (!data || data.length === 0) {
    return (
      <div className="flex h-full items-center justify-center text-xs text-slate-400">
        Belum ada data
      </div>
    );
  }

  const max = Math.max(...data.map((item) => item.count), 1);
  if (max <= 0) {
    return (
      <div className="flex h-full items-center justify-center text-xs text-slate-400">
        Belum ada aktivitas
      </div>
    );
  }
  return (
    <div className="flex h-full items-end gap-1 border-t border-slate-200 pt-2">
      {data.map((item) => {
        const height = Math.max(6, Math.round((item.count / max) * 80));
        return (
          <div key={item.day} className="group relative flex-1">
            <div
              className="w-full rounded-t-md bg-slate-900/80 transition group-hover:bg-slate-900"
              style={{ height: `${height}px` }}
              title={`${item.day}: ${item.count}`}
            />
            <div className="pointer-events-none absolute -top-7 left-1/2 hidden -translate-x-1/2 whitespace-nowrap rounded-md bg-slate-900 px-2 py-1 text-[10px] text-white shadow-sm group-hover:block">
              {item.day} • {item.count} aksi
            </div>
          </div>
        );
      })}
    </div>
  );
}
