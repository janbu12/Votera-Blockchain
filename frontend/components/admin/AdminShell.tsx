"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import {
  BadgeCheck,
  LayoutDashboard,
  LogOut,
  Settings2,
  History,
  Shield,
  Menu,
  X,
} from "lucide-react";
import { clearAdminProfile } from "@/components/auth/admin-auth";

type NavItem = {
  label: string;
  href: string;
  description: string;
};

const navItems: NavItem[] = [
  {
    label: "Dashboard",
    href: "/admin",
    description: "Event, kandidat, dan status pemilihan",
  },
  {
    label: "Kelola Event",
    href: "/admin/events",
    description: "Buat event, jadwal, dan kandidat",
  },
  {
    label: "Riwayat",
    href: "/admin/history",
    description: "Rekap event selesai",
  },
  {
    label: "Verifikasi",
    href: "/admin/verifications",
    description: "Review data kartu & selfie mahasiswa",
  },
];

export function AdminShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const useRelayer = true;
  const [collapsed, setCollapsed] = useState(false);
  const [role, setRole] = useState<string | null>(null);
  const [drawerOpen, setDrawerOpen] = useState(false);

  useEffect(() => {
    if (!useRelayer) return;
    fetch("/api/admin/me")
      .then((res) => res.json().then((data) => ({ ok: res.ok, data })))
      .then((result) => {
        if (result.ok) {
          setRole(result.data?.role ?? "admin");
        }
      })
      .catch(() => {});
  }, [useRelayer]);


  useEffect(() => {
    if (typeof window === "undefined") return;
    document.body.style.overflow = drawerOpen ? "hidden" : "";
    return () => {
      document.body.style.overflow = "";
    };
  }, [drawerOpen]);

  const visibleItems = useRelayer
    ? navItems.concat(
        role === "superadmin"
          ? [
              {
                label: "Admin",
                href: "/admin/users",
                description: "Kelola akun admin",
              },
            ]
          : []
      )
    : navItems;
  const activeIndex = visibleItems.findIndex((item) =>
    item.href === "/admin"
      ? pathname === "/admin"
      : pathname === item.href || pathname.startsWith(`${item.href}/`)
  );
  const navCount = Math.max(visibleItems.length, 1);

  const iconFor = (label: string) =>
    label === "Dashboard" ? (
      <LayoutDashboard className="h-4 w-4" />
    ) : label === "Kelola Event" ? (
      <Settings2 className="h-4 w-4" />
    ) : label === "Riwayat" ? (
      <History className="h-4 w-4" />
    ) : label === "Admin" ? (
      <Shield className="h-4 w-4" />
    ) : (
      <BadgeCheck className="h-4 w-4" />
    );

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-amber-50">
      <div className="mx-auto flex min-h-screen max-w-7xl flex-col gap-6 px-4 py-6 lg:flex-row lg:gap-8 lg:px-8">
        <div className="sticky top-4 z-40 flex items-center justify-between rounded-2xl border border-slate-200 bg-white/90 px-4 py-3 shadow-sm backdrop-blur lg:hidden">
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-[0.4em] text-amber-500">
              Admin Suite
            </p>
            <h1 className="mt-1 text-base font-semibold text-slate-900">
              Voting BEM
            </h1>
          </div>
          <div className="flex items-center gap-2">
            <span className="rounded-full border border-amber-200 bg-amber-50 px-2 py-1 text-[10px] font-semibold uppercase text-amber-700">
              {useRelayer ? "Relayer" : "Wallet"}
            </span>
            <button
              onClick={() => setDrawerOpen(true)}
              className="flex items-center gap-1 rounded-full border border-slate-200 bg-white px-3 py-1 text-[11px] font-semibold text-slate-600"
            >
              <Menu className="h-3 w-3" />
              Menu
            </button>
          </div>
        </div>

        <aside
          className={`hidden w-full flex-col rounded-3xl border border-slate-200 bg-white/90 p-5 text-slate-900 shadow-sm backdrop-blur transition-[width] duration-300 ease-out lg:sticky lg:top-6 lg:flex lg:h-[calc(100vh-3rem)] ${
            collapsed ? "lg:w-24" : "lg:w-80"
          }`}
        >
          <div className="flex items-start justify-between gap-4">
            <div className={`${collapsed ? "hidden" : "block"}`}>
              <p className="text-[10px] font-semibold uppercase tracking-[0.4em] text-amber-500">
                Admin Suite
              </p>
              <h1 className="mt-2 text-xl font-semibold text-slate-900">
                Voting BEM
              </h1>
              <p className="mt-1 text-xs text-slate-500">
                Kendali penuh, audit jelas.
              </p>
            </div>
            <button
              onClick={() => setCollapsed((prev) => !prev)}
              className={`${collapsed ? "w-full py-2" : "w-fit py-1"} rounded-full border border-slate-200 px-3 py-1 text-[11px] font-semibold uppercase tracking-wide text-slate-500 transition hover:border-slate-300 hover:text-slate-800`}
              type="button"
            >
              {collapsed ? ">>" : "<<"}
            </button>
          </div>

          <div className="mt-4 flex items-center justify-between">
            <span className="rounded-full border border-amber-200 bg-amber-50 px-2 py-1 text-[10px] font-semibold uppercase text-amber-700">
              {useRelayer ? "Relayer" : "Wallet"}
            </span>
          </div>

          <nav className="mt-6 flex flex-1 flex-col gap-3 overflow-auto pr-1">
            {visibleItems.map((item) => {
              const active =
                item.href === "/admin"
                  ? pathname === "/admin"
                  : pathname === item.href || pathname.startsWith(`${item.href}/`);
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={`group rounded-2xl text-left text-sm font-semibold transition ${
                    collapsed ? "px-3 py-3" : "px-4 py-3"
                  } ${
                    active
                      ? "bg-slate-900 text-white shadow"
                      : "border border-slate-200 bg-white text-slate-600 hover:border-slate-300 hover:bg-slate-50"
                  }`}
                >
                  <div
                    className={`flex items-center ${
                      collapsed ? "justify-center" : "gap-3"
                    }`}
                  >
                    <span
                      className={`grid h-8 w-8 place-items-center rounded-lg transition ${
                        active
                          ? "bg-white/10 text-white"
                          : "bg-slate-100 text-slate-600 group-hover:bg-slate-200"
                      }`}
                    >
                      {iconFor(item.label)}
                    </span>
                    {!collapsed && (
                      <div>
                        <div>{item.label}</div>
                        <p
                          className={`mt-1 text-[11px] font-normal ${
                            active ? "text-slate-200" : "text-slate-500"
                          }`}
                        >
                          {item.description}
                        </p>
                      </div>
                    )}
                  </div>
                </Link>
              );
            })}
          </nav>

          {!collapsed && (
            <div className="mt-6 rounded-2xl border border-slate-200 bg-slate-50 p-4 text-xs text-slate-600 transition-opacity duration-200">
              <p className="font-semibold text-slate-800">Quick Tips</p>
              <p className="mt-1">
                Pastikan signer backend aktif sebelum membuka event baru.
              </p>
            </div>
          )}

          {useRelayer && (
            <button
              onClick={() => {
                fetch("/api/admin/logout", { method: "POST" }).catch(() => {});
                clearAdminProfile();
                router.push("/login");
              }}
              className={`mt-6 flex w-full items-center justify-center rounded-2xl border border-slate-200 px-4 py-2 text-xs font-semibold text-slate-600 transition hover:border-slate-300 hover:text-slate-800 ${
                collapsed ? "gap-0" : "gap-2"
              }`}
            >
              <LogOut className="h-4 w-4" />
              {!collapsed && <span>Logout Admin</span>}
            </button>
          )}
        </aside>

        <main className="flex-1 pb-24 lg:pb-0">
          <div className="rounded-3xl border border-slate-200 bg-white/90 p-6 shadow-sm backdrop-blur transition-opacity duration-200">
            {children}
          </div>
        </main>
      </div>

      <nav className="fixed bottom-4 left-1/2 z-50 w-[min(92vw,520px)] -translate-x-1/2 lg:hidden">
        <div className="relative rounded-3xl border border-slate-200 bg-white/95 px-3 py-2 shadow-lg backdrop-blur">
          <span
            className="absolute left-3 top-2 h-[52px] rounded-2xl bg-slate-900 transition-transform duration-300 ease-out"
            style={{
              width: `calc((100% - 1.5rem) / ${navCount})`,
              transform: `translateX(${Math.max(activeIndex, 0) * 100}%)`,
            }}
          />
          <div
            className="relative z-10 grid"
            style={{ gridTemplateColumns: `repeat(${navCount}, minmax(0, 1fr))` }}
          >
            {visibleItems.map((item) => {
              const active =
                item.href === "/admin"
                  ? pathname === "/admin"
                  : pathname === item.href || pathname.startsWith(`${item.href}/`);
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={`group relative flex flex-col items-center justify-center gap-1 rounded-2xl px-2 py-2 text-[11px] font-semibold transition ${
                    active ? "text-white" : "text-slate-500"
                  }`}
                >
                  <span
                    className={`grid h-8 w-8 place-items-center rounded-xl transition ${
                      active ? "text-white tab-bounce" : "bg-slate-100 text-slate-500"
                    }`}
                  >
                    {iconFor(item.label)}
                  </span>
                  <span className="sr-only">{item.label}</span>
                  <span className="pointer-events-none absolute -top-9 hidden rounded-lg bg-slate-900 px-2 py-1 text-[10px] font-semibold text-white opacity-0 transition group-hover:opacity-100 sm:block">
                    {item.label}
                  </span>
                </Link>
              );
            })}
          </div>
        </div>
      </nav>

      <div
        className={`fixed inset-0 z-[60] flex items-center justify-center transition-opacity duration-300 lg:hidden ${
          drawerOpen ? "opacity-100 pointer-events-auto" : "opacity-0 pointer-events-none"
        }`}
      >
        <button
          aria-label="Close menu"
          onClick={() => setDrawerOpen(false)}
          className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm"
        />
        <div
          className={`relative w-[min(86vw,360px)] overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-xl transition-transform duration-300 ${
            drawerOpen ? "translate-x-0" : "translate-x-6"
          }`}
        >
          <div className="flex max-h-[86vh] flex-col overflow-y-auto p-5">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-[10px] font-semibold uppercase tracking-[0.4em] text-amber-500">
                  Admin Suite
                </p>
                <h2 className="mt-2 text-lg font-semibold text-slate-900">
                  Voting BEM
                </h2>
                <p className="mt-1 text-xs text-slate-500">
                  Kendali penuh, audit jelas.
                </p>
              </div>
              <button
                onClick={() => setDrawerOpen(false)}
                className="rounded-full border border-slate-200 p-2 text-slate-500"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
            <div className="mt-4 flex items-center gap-2">
              <span className="rounded-full border border-amber-200 bg-amber-50 px-2 py-1 text-[10px] font-semibold uppercase text-amber-700">
                {useRelayer ? "Relayer" : "Wallet"}
              </span>
            </div>
            <nav className="mt-5 flex flex-col gap-2 pb-6">
              {visibleItems.map((item) => {
                const active =
                  item.href === "/admin"
                    ? pathname === "/admin"
                    : pathname === item.href || pathname.startsWith(`${item.href}/`);
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    onClick={() => setDrawerOpen(false)}
                    className={`flex items-center gap-3 rounded-2xl px-4 py-3 text-sm font-semibold transition ${
                      active
                        ? "bg-slate-900 text-white shadow"
                        : "border border-slate-200 bg-white text-slate-600 hover:border-slate-300 hover:bg-slate-50"
                    }`}
                  >
                    <span
                      className={`grid h-8 w-8 place-items-center rounded-lg transition ${
                        active
                          ? "bg-white/10 text-white"
                          : "bg-slate-100 text-slate-600"
                      }`}
                    >
                      {iconFor(item.label)}
                    </span>
                    <div>
                      <div>{item.label}</div>
                      <p
                        className={`mt-1 text-[11px] font-normal ${
                          active ? "text-slate-200" : "text-slate-500"
                        }`}
                      >
                        {item.description}
                      </p>
                    </div>
                  </Link>
                );
              })}
            </nav>
            {useRelayer && (
              <button
                onClick={() => {
                  fetch("/api/admin/logout", { method: "POST" }).catch(() => {});
                  clearAdminProfile();
                  setDrawerOpen(false);
                  router.push("/login");
                }}
                className="mt-2 flex w-full items-center justify-center gap-2 rounded-2xl border border-slate-200 px-4 py-2 text-xs font-semibold text-slate-600 transition hover:border-slate-300 hover:text-slate-800"
              >
                <LogOut className="h-4 w-4" />
                Logout Admin
              </button>
            )}
            <div className="pb-8" />
          </div>
        </div>
      </div>
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
