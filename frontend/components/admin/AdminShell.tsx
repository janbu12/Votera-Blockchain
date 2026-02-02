"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useState } from "react";
import { BadgeCheck, LayoutDashboard, LogOut } from "lucide-react";
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
    label: "Verifikasi",
    href: "/admin/verifications",
    description: "Review data kartu & selfie mahasiswa",
  },
];

export function AdminShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const adminMode = (process.env.NEXT_PUBLIC_ADMIN_MODE ?? "wallet").toLowerCase();
  const useRelayer = adminMode === "relayer";
  const [collapsed, setCollapsed] = useState(false);

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-amber-50">
      <div className="mx-auto flex min-h-screen max-w-7xl flex-col gap-6 px-4 py-6 lg:flex-row lg:gap-8 lg:px-8">
        <aside
          className={`w-full rounded-3xl border border-slate-200 bg-white/90 p-5 text-slate-900 shadow-sm backdrop-blur transition-[width] duration-300 ease-out lg:sticky lg:top-6 lg:h-[calc(100vh-3rem)] ${
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

          <nav className="mt-6 flex flex-col gap-3">
            {navItems.map((item) => {
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
                      {item.label === "Dashboard" ? (
                        <LayoutDashboard className="h-4 w-4" />
                      ) : (
                        <BadgeCheck className="h-4 w-4" />
                      )}
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

        <main className="flex-1">
          <div className="rounded-3xl border border-slate-200 bg-white/90 p-6 shadow-sm backdrop-blur transition-opacity duration-200">
            {children}
          </div>
        </main>
      </div>
    </div>
  );
}
