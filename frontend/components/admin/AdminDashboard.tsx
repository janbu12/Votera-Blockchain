"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useReadContract } from "wagmi";
import { VOTING_ABI, VOTING_ADDRESS } from "@/lib/contract";
import {
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

export function AdminDashboard() {
  const useRelayer = true;
  const [stats, setStats] = useState<{
    verifiedCount: number;
    totalStudents: number;
    votedCount: number;
  } | null>(null);
  const [statsLoading, setStatsLoading] = useState(false);
  const [statsError, setStatsError] = useState<string | null>(null);
  const [openMap, setOpenMap] = useState<Record<string, boolean>>({});
  const [monitor, setMonitor] = useState<{
    rpc: {
      ok: boolean;
      chainId: number | null;
      blockNumber: string | null;
      latencyMs: number | null;
      error: string | null;
    };
    signer: {
      configured: boolean;
      address: string | null;
      balance: string | null;
      balanceEth: string | null;
      error: string | null;
    };
    contractAddress: string | null;
  } | null>(null);
  const [monitorError, setMonitorError] = useState<string | null>(null);
  const [latencySeries, setLatencySeries] = useState<Array<{ t: number; v: number }>>(
    []
  );
  const [blockSeries, setBlockSeries] = useState<Array<{ t: number; v: number }>>(
    []
  );
  const [balanceSeries, setBalanceSeries] = useState<Array<{ t: number; v: number }>>(
    []
  );

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
  const runningCount = useMemo(
    () => Object.values(openMap).filter(Boolean).length,
    [openMap]
  );

  useEffect(() => {
    setStatsLoading(true);
    setStatsError(null);
    fetch("/api/admin/stats")
      .then((res) => res.json().then((data) => ({ ok: res.ok, data })))
      .then((result) => {
        if (result.ok) {
          setStats(result.data.stats);
        } else {
          setStatsError(result.data?.reason ?? "Gagal memuat statistik");
        }
      })
      .catch(() => {
        setStatsError("Gagal menghubungi backend");
      })
      .finally(() => {
        setStatsLoading(false);
      });
  }, []);

  useEffect(() => {
    let alive = true;
    const tick = () => {
      setMonitorError(null);
      fetch("/api/admin/monitor")
        .then((res) => res.json().then((data) => ({ ok: res.ok, data })))
        .then((result) => {
          if (!alive) return;
          if (result.ok) {
            setMonitor(result.data);
            const now = Date.now();
            const latency = Number(result.data?.rpc?.latencyMs ?? 0);
            const block = Number(result.data?.rpc?.blockNumber ?? 0);
            const balanceEth = Number(result.data?.signer?.balanceEth ?? 0);
            if (Number.isFinite(latency) && latency > 0) {
              setLatencySeries((prev) => {
                const next = [...prev, { t: now, v: latency }].slice(-30);
                return next;
              });
            }
            if (Number.isFinite(block) && block > 0) {
              setBlockSeries((prev) => {
                const next = [...prev, { t: now, v: block }].slice(-30);
                return next;
              });
            }
            if (Number.isFinite(balanceEth) && balanceEth >= 0) {
              setBalanceSeries((prev) => {
                const next = [...prev, { t: now, v: balanceEth }].slice(-30);
                return next;
              });
            }
          } else {
            setMonitorError(result.data?.reason ?? "Gagal memuat monitoring");
          }
        })
        .catch(() => {
          if (!alive) return;
          setMonitorError("Gagal menghubungi backend");
        });
    };
    tick();
    const id = window.setInterval(tick, 5000);
    return () => {
      alive = false;
      window.clearInterval(id);
    };
  }, []);

  if (isLoading) {
    return (
      <div className="rounded-2xl border border-slate-200 bg-white p-5 text-sm text-slate-500">
        Memuat dashboard...
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
  return (
    <div className="space-y-4">
      <div className="grid gap-3 md:grid-cols-3">
        <div className="rounded-2xl border border-slate-200 bg-white p-4">
          <p className="text-xs uppercase tracking-[0.2em] text-slate-400">
            Partisipasi
          </p>
          <p className="mt-2 text-lg font-semibold text-slate-900">
            {statsLoading
              ? "Memuat..."
              : stats
              ? `${stats.verifiedCount} terverifikasi`
              : "-"}
          </p>
          <p className="mt-1 text-xs text-slate-500">
            {statsLoading
              ? ""
              : stats
              ? `dari ${stats.totalStudents} mahasiswa`
              : statsError ?? "Tidak ada data"}
          </p>
        </div>
        <div className="rounded-2xl border border-slate-200 bg-white p-4">
          <p className="text-xs uppercase tracking-[0.2em] text-slate-400">
            Event Berjalan
          </p>
          <p className="mt-2 text-lg font-semibold text-slate-900">
            {runningCount}
          </p>
          <p className="mt-1 text-xs text-slate-500">
            Aktif saat ini
          </p>
        </div>
        <div className="rounded-2xl border border-slate-200 bg-white p-4">
          <p className="text-xs uppercase tracking-[0.2em] text-slate-400">
            Total Event
          </p>
          <p className="mt-2 text-lg font-semibold text-slate-900">
            {electionIds.length}
          </p>
          <p className="mt-1 text-xs text-slate-500">
            Event terdaftar
          </p>
        </div>
      </div>

      <div className="rounded-2xl border border-slate-200 bg-white p-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <p className="text-xs uppercase tracking-[0.2em] text-slate-400">
              Monitoring
            </p>
            <p className="mt-2 text-sm font-semibold text-slate-900">
              Status RPC &amp; Relayer
            </p>
          </div>
          {monitor?.rpc?.ok ? (
            <span className="rounded-full bg-emerald-100 px-3 py-1 text-xs font-semibold text-emerald-700">
              RPC OK
            </span>
          ) : (
            <span className="rounded-full bg-rose-100 px-3 py-1 text-xs font-semibold text-rose-700">
              RPC Error
            </span>
          )}
        </div>
        {monitorError ? (
          <p className="mt-2 text-xs text-rose-600">{monitorError}</p>
        ) : (
          <div className="mt-3 grid gap-3 text-xs text-slate-600 lg:grid-cols-[1fr_1fr]">
            <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
              <p className="text-[11px] font-semibold text-slate-500">RPC</p>
              <p className="mt-1">
                Chain: {monitor?.rpc?.chainId ?? "-"}
              </p>
              <p className="mt-1">
                Block: {monitor?.rpc?.blockNumber ?? "-"}
              </p>
              <p className="mt-1">
                Latency:{" "}
                {monitor?.rpc?.latencyMs !== null && monitor?.rpc?.latencyMs !== undefined
                  ? `${monitor.rpc.latencyMs} ms`
                  : "-"}
              </p>
              {monitor?.rpc?.error && (
                <p className="mt-1 text-rose-600">{monitor.rpc.error}</p>
              )}
              <div className="mt-3 h-28">
                <SmallLineChart
                  title="Latency (ms)"
                  series={latencySeries}
                  stroke="#0f172a"
                />
              </div>
              <div className="mt-3 h-28">
                <SmallLineChart
                  title="Block Number"
                  series={blockSeries}
                  stroke="#10b981"
                />
              </div>
            </div>
            <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
              <p className="text-[11px] font-semibold text-slate-500">Relayer</p>
              <div className="mt-2 rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2">
                <p className="text-[11px] font-semibold uppercase tracking-wide text-emerald-700">
                  Saldo Relayer
                </p>
                <p className="mt-1 text-lg font-semibold text-emerald-700">
                  {monitor?.signer?.balanceEth ?? "-"} ETH
                </p>
                <p className="mt-1 text-[11px] text-emerald-700/80">
                  {monitor?.signer?.balance ?? "-"} wei
                </p>
              </div>
              <p className="mt-2 text-[11px] text-slate-500">
                Address: {monitor?.signer?.address ?? "-"}
              </p>
              {!monitor?.signer?.configured && (
                <p className="mt-1 text-amber-600">Signer belum dikonfigurasi</p>
              )}
              {monitor?.signer?.error && (
                <p className="mt-1 text-rose-600">{monitor.signer.error}</p>
              )}
              <div className="mt-3 h-28">
                <SmallLineChart
                  title="Balance (ETH)"
                  series={balanceSeries}
                  stroke="#10b981"
                />
              </div>
            </div>
          </div>
        )}
      </div>

      <h2 className="text-lg font-semibold text-slate-900">Event Berjalan</h2>
      <div className="space-y-4">
        {electionIds.length === 0 ? (
          <div className="rounded-2xl border border-slate-200 bg-white p-5 text-sm text-slate-500">
            Belum ada event.
          </div>
        ) : (
          electionIds.map((id) => (
            <RunningElectionCard
              key={id.toString()}
              electionId={id}
              verifiedCount={stats?.verifiedCount ?? null}
              totalStudents={stats?.totalStudents ?? null}
              onOpenChange={(isOpen) =>
                setOpenMap((prev) => {
                  const key = id.toString();
                  if (prev[key] === isOpen) return prev;
                  return { ...prev, [key]: isOpen };
                })
              }
            />
          ))
        )}
      </div>
    </div>
  );
}

function SmallLineChart({
  title,
  series,
  stroke,
}: {
  title: string;
  series: Array<{ t: number; v: number }>;
  stroke: string;
}) {
  if (series.length < 2) {
    return (
      <div className="rounded-lg border border-dashed border-slate-200 bg-white/70 px-3 py-2 text-[11px] text-slate-400">
        {title}: menunggu data...
      </div>
    );
  }

  const values = series.map((p) => p.v);
  const min = Math.min(...values);
  const max = Math.max(...values);
  const rangeLabel = `${Math.round(min)} - ${Math.round(max)}`;

  return (
    <div className="rounded-lg border border-slate-200 bg-white/70 px-3 py-2">
      <div className="flex items-center justify-between text-[11px] text-slate-500">
        <span>{title}</span>
        <span>{rangeLabel}</span>
      </div>
      <div className="mt-2 h-16 w-full">
        <ResponsiveContainer>
          <LineChart data={series} margin={{ top: 5, right: 8, left: 0, bottom: 0 }}>
            <XAxis dataKey="t" hide />
            <YAxis hide domain={["auto", "auto"]} />
            <Tooltip
              cursor={{ stroke: "#e2e8f0", strokeWidth: 1 }}
              contentStyle={{
                fontSize: "11px",
                borderRadius: "8px",
                borderColor: "#e2e8f0",
              }}
              formatter={(value) => [value, title]}
              labelFormatter={() => ""}
            />
            <Line
              type="monotone"
              dataKey="v"
              stroke={stroke}
              strokeWidth={2}
              dot={false}
            />
          </LineChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}

function RunningElectionCard({
  electionId,
  verifiedCount,
  totalStudents,
  onOpenChange,
}: {
  electionId: bigint;
  verifiedCount: number | null;
  totalStudents: number | null;
  onOpenChange: (isOpen: boolean) => void;
}) {
  const useRelayer = true;
  const { data: election } = useReadContract({
    address: VOTING_ADDRESS,
    abi: VOTING_ABI,
    functionName: "getElection",
    args: [electionId],
    query: { enabled: true, refetchInterval: 10000 },
  });
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

  const [voteMap, setVoteMap] = useState<
    Record<string, { name: string; count: bigint }>
  >({});
  const handleCount = useCallback((candidateKey: string, count: bigint, name: string) => {
    setVoteMap((prev) =>
      prev[candidateKey]?.count === count && prev[candidateKey]?.name === name
        ? prev
        : { ...prev, [candidateKey]: { name, count } }
    );
  }, []);
  const totalVotes = useMemo(() => {
    let total = BigInt(0);
    for (const value of Object.values(voteMap)) {
      total += value.count;
    }
    return total;
  }, [voteMap]);
  const topCandidates = useMemo(() => {
    const entries = Object.values(voteMap)
      .slice()
      .sort((a, b) => Number(b.count - a.count))
      .slice(0, 3);
    return entries;
  }, [voteMap]);

  const [title, isOpen, mode, startTime, endTime] = election ?? [
    "",
    false,
    0,
    0,
    0,
    BigInt(0),
    BigInt(0),
  ];
  useEffect(() => {
    if (!election) return;
    onOpenChange(!!isOpen);
  }, [election, isOpen, onOpenChange]);
  if (!election) return null;
  if (!isOpen) return null;

  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-sm font-semibold text-slate-900">{title}</p>
          <p className="mt-1 text-xs text-slate-500">
            ID {electionId.toString()} • Mode{" "}
            {Number(mode) === 1 ? "Production (Terjadwal)" : "Simulasi (Manual)"}
          </p>
          {verifiedCount != null && totalStudents != null && (
            <p className="mt-1 text-xs text-slate-500">
              Terverifikasi: {verifiedCount} / {totalStudents}
            </p>
          )}
          <p className="mt-1 text-xs text-slate-500">
            Buka: {formatTime(startTime)} • Tutup: {formatTime(endTime)}
          </p>
          <p className="mt-1 text-xs text-emerald-600">
            {formatCountdown(nowMs, Number(endTime) * 1000)}
          </p>
        </div>
        <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-2 text-xs font-semibold text-emerald-700">
          Total suara: {totalVotes.toString()}
        </div>
      </div>

      {topCandidates.length > 0 && (
        <div className="mt-3 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-xs text-amber-700">
          <p className="font-semibold">Top Kandidat</p>
          <div className="mt-2 flex flex-wrap gap-2">
            {topCandidates.map((entry, index) => (
              <span
                key={`${entry.name}-${index}`}
                className="rounded-full bg-white px-3 py-1 text-[11px] font-semibold text-amber-700"
              >
                {index + 1}. {entry.name} ({entry.count.toString()})
              </span>
            ))}
          </div>
        </div>
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
  onCount: (key: string, count: bigint, name: string) => void;
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
    onCount(key, voteCount, String(name));
  }, [data, key, voteCount, name, onCount]);

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

function formatCountdown(nowMs: number, endMs: number) {
  if (!endMs) return "Jadwal belum ditentukan";
  const diff = endMs - nowMs;
  if (diff <= 0) return "Event selesai";
  const totalSeconds = Math.floor(diff / 1000);
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  if (hours > 0) return `Sisa ${hours}j ${minutes}m`;
  if (minutes > 0) return `Sisa ${minutes}m ${seconds}d`;
  return `Sisa ${seconds}d`;
}
