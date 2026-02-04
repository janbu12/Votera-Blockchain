"use client";

import { CalendarCheck, Home, LogOut, ClipboardList, User, Trophy } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { clearStudentAuth } from "@/components/auth/student-auth";

export const studentTabs = [
  { href: "/mahasiswa/beranda", label: "Beranda", icon: <Home className="h-4 w-4" /> },
  {
    href: "/mahasiswa/event",
    label: "Event & Voting",
    icon: <CalendarCheck className="h-4 w-4" />,
  },
  {
    href: "/mahasiswa/riwayat",
    label: "Riwayat",
    icon: <ClipboardList className="h-4 w-4" />,
  },
  { href: "/mahasiswa/profil", label: "Profil", icon: <User className="h-4 w-4" /> },
  { href: "/mahasiswa/hasil", label: "Hasil", icon: <Trophy className="h-4 w-4" /> },
];

export function StudentShell({
  nim,
  isRelayer,
  children,
}: {
  nim: string;
  isRelayer?: boolean;
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const activeIndex = studentTabs.findIndex(
    (tab) => pathname === tab.href || pathname.startsWith(`${tab.href}/`)
  );
  return (
    <div className="mt-6 grid gap-6 lg:grid-cols-[260px_1fr]">
      <div className="space-y-4 lg:hidden">
        <div className="rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-xs text-emerald-700">
          ✅ Login sebagai <span className="font-semibold">{nim}</span>
        </div>
        <div className="rounded-2xl border border-slate-200 bg-white px-4 py-3 text-xs text-slate-600">
          <p className="font-semibold text-slate-700">Tips</p>
          <p className="mt-1">Pastikan verifikasi aktif sebelum voting.</p>
        </div>
      </div>

      <aside className="hidden rounded-3xl border border-slate-200 bg-white p-5 shadow-sm lg:block">
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-[0.4em] text-slate-400">
            Mahasiswa
          </p>
          <h2 className="mt-2 text-lg font-semibold text-slate-900">Voting BEM</h2>
          <p className="mt-1 text-xs text-slate-500">
            Akses voting, riwayat, dan hasil.
          </p>
        </div>
        {isRelayer && (
          <div className="mt-4 flex items-center gap-2">
            <span className="rounded-full border border-emerald-200 bg-emerald-50 px-2 py-1 text-[10px] font-semibold uppercase text-emerald-700">
              Relayer
            </span>
          </div>
        )}
        <div className="mt-4 rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-xs text-emerald-700">
          ✅ Login sebagai <span className="font-semibold">{nim}</span>
        </div>
        <nav className="mt-4 flex flex-col gap-2">
          {studentTabs.map((tab) => {
            const isActive =
              pathname === tab.href || pathname.startsWith(`${tab.href}/`);
            return (
              <Link
                key={tab.href}
                href={tab.href}
                className={`flex items-center gap-3 rounded-2xl px-4 py-3 text-left text-sm font-semibold transition ${
                  isActive
                    ? "bg-slate-900 text-white shadow"
                    : "border border-slate-200 bg-white text-slate-600 hover:bg-slate-50"
                }`}
              >
                <span
                  className={`grid h-8 w-8 place-items-center rounded-lg ${
                    isActive ? "bg-white/10 text-white" : "bg-slate-100 text-slate-600"
                  }`}
                >
                  {tab.icon}
                </span>
                {tab.label}
              </Link>
            );
          })}
        </nav>
        <div className="mt-4 flex flex-col gap-2 text-xs text-slate-500">
          <Link href="/hasil" className="hover:text-slate-700">
            Lihat hasil resmi
          </Link>
          <Link href="/progres" className="hover:text-slate-700">
            Progress publik
          </Link>
        </div>
        <div className="mt-4 rounded-2xl border border-slate-200 bg-slate-50 p-3 text-xs text-slate-600">
          <p className="font-semibold text-slate-700">Tips</p>
          <p className="mt-1">Pastikan verifikasi aktif sebelum voting.</p>
        </div>
        <button
          onClick={() => {
            fetch("/api/student/logout", { method: "POST" }).catch(() => {});
            clearStudentAuth();
            if (typeof window !== "undefined") {
              window.sessionStorage.setItem("forceDisconnect", "1");
            }
            window.location.href = "/login";
          }}
          className="mt-4 flex w-full items-center justify-center gap-2 rounded-2xl border border-slate-200 px-3 py-2 text-xs font-semibold text-slate-600 transition hover:border-slate-300"
        >
          <LogOut className="h-4 w-4" />
          Logout
        </button>
      </aside>

      <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm pb-24 lg:pb-6">
        {children}
      </section>

      <nav className="fixed bottom-4 left-1/2 z-50 w-[min(92vw,520px)] -translate-x-1/2 lg:hidden">
        <div className="relative rounded-3xl border border-slate-200 bg-white/95 px-3 py-2 shadow-lg backdrop-blur">
          <span
            className="absolute left-3 top-2 h-[52px] w-[calc((100%-1.5rem)/5)] rounded-2xl bg-slate-900 transition-transform duration-300 ease-out"
            style={{
              transform: `translateX(${Math.max(activeIndex, 0) * 100}%)`,
            }}
          />
          <div className="relative z-10 grid grid-cols-5">
        {studentTabs.map((tab) => {
          const isActive =
            pathname === tab.href || pathname.startsWith(`${tab.href}/`);
              return (
                <Link
                  key={tab.href}
                  href={tab.href}
                  className={`group relative flex flex-col items-center justify-center gap-1 rounded-2xl px-2 py-2 text-[11px] font-semibold transition ${
                    isActive ? "text-white" : "text-slate-500"
                  }`}
                >
                  <span
                    key={`${tab.href}-${isActive ? activeIndex : "idle"}`}
                    className={`grid h-8 w-8 place-items-center rounded-xl transition ${
                      isActive
                        ? "text-white tab-bounce"
                        : "bg-slate-100 text-slate-500"
                    }`}
                  >
                    {tab.icon}
                  </span>
                  <span className="sr-only">{tab.label}</span>
                  <span className="pointer-events-none absolute -top-9 hidden rounded-lg bg-slate-900 px-2 py-1 text-[10px] font-semibold text-white opacity-0 transition group-hover:opacity-100 sm:block">
                    {tab.label}
                  </span>
                </Link>
              );
            })}
          </div>
        </div>
      </nav>
      <style jsx>{`
        @keyframes tab-bounce {
          0% {
            transform: translateY(0);
          }
          30% {
            transform: translateY(-4px);
          }
          60% {
            transform: translateY(2px);
          }
          100% {
            transform: translateY(0);
          }
        }

        .tab-bounce {
          animation: tab-bounce 280ms ease-out;
        }
      `}</style>
    </div>
  );
}
