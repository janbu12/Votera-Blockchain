"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { LogOut, Menu, X } from "lucide-react";
import { StudentShell, studentTabs } from "@/components/student/StudentShell";
import {
  ChangePasswordCard,
  NoticeCard,
  VerificationCard,
  VerificationStepper,
} from "@/components/student/StudentSections";
import { StudentProvider, useStudent } from "@/components/student/StudentProvider";
import { clearStudentAuth } from "@/components/auth/student-auth";

export default function MahasiswaLayout({ children }: { children: React.ReactNode }) {
  return (
    <StudentProvider>
      <StudentLayoutContent>{children}</StudentLayoutContent>
    </StudentProvider>
  );
}

function StudentLayoutContent({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const {
    loading,
    nim,
    mustChangePassword,
    verificationStatus,
    verificationReason,
    uploading,
    uploadMsg,
    cardPreview,
    selfiePreview,
    onCardFileChange,
    onSelfieFileChange,
    uploadVerification,
    newPassword,
    confirmPassword,
    onNewPasswordChange,
    onConfirmPasswordChange,
    passwordMessage,
    passwordLoading,
    submitPasswordChange,
  } = useStudent();

  const safeStatus = (verificationStatus ?? "NONE") as
    | "NONE"
    | "PENDING"
    | "VERIFIED"
    | "REJECTED";

  const needsVerification = mustChangePassword && safeStatus !== "VERIFIED";
  const needsPasswordChange = mustChangePassword && safeStatus === "VERIFIED";

  const headerMessage = useMemo(() => {
    return "Mode relayer aktif. Mahasiswa tidak perlu connect wallet.";
  }, []);

  const handleLogout = () => {
    fetch("/api/student/logout", { method: "POST" }).catch(() => {});
    clearStudentAuth();
    if (typeof window !== "undefined") {
      window.sessionStorage.setItem("forceDisconnect", "1");
      window.location.href = "/login";
    }
  };

  const [drawerOpen, setDrawerOpen] = useState(false);
  const activeIndex = studentTabs.findIndex(
    (tab) => pathname === tab.href || pathname.startsWith(`${tab.href}/`)
  );

  useEffect(() => {
    if (typeof window === "undefined") return;
    document.body.style.overflow = drawerOpen ? "hidden" : "";
    return () => {
      document.body.style.overflow = "";
    };
  }, [drawerOpen]);

  return (
    <div className="min-h-screen bg-slate-50 px-6 py-10">
      <div className="mx-auto max-w-6xl">
        <header className="sticky top-4 z-40 flex flex-wrap items-center justify-between gap-4 rounded-2xl border border-slate-200 bg-white/90 px-4 py-3 shadow-sm backdrop-blur lg:hidden">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.3em] text-slate-400">
              Mahasiswa
            </p>
            <h1 className="mt-2 text-base font-semibold text-slate-900">
              Voting BEM
            </h1>
            <p className="mt-1 text-sm text-slate-500">{headerMessage}</p>
          </div>
          <div className="flex items-center gap-2">
            <span className="rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1 text-[10px] font-semibold uppercase text-emerald-700">
              Relayer
            </span>
            <button
              onClick={() => setDrawerOpen(true)}
              className="flex items-center gap-2 rounded-full border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-600 shadow-sm transition hover:border-slate-300 hover:bg-slate-50 lg:hidden"
            >
              <Menu className="h-4 w-4" />
              Menu
            </button>
            <a
              href="/login"
              className="hidden text-sm text-slate-500 hover:text-slate-700 lg:inline"
            >
              Kembali ke login
            </a>
          </div>
        </header>

        <div className="mt-6">
          {loading ? (
            <div className="rounded-2xl border border-slate-200 bg-white p-6 text-sm text-slate-500">
              Memuat data mahasiswa...
            </div>
          ) : !nim ? (
            <div className="rounded-2xl border border-slate-200 bg-white p-6 text-sm text-slate-500">
              Session mahasiswa tidak ditemukan. Silakan login ulang.
            </div>
          ) : needsVerification || needsPasswordChange ? (
            <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
              <div className="space-y-6">
                {needsVerification ? (
                  <>
                    <VerificationStepper status={safeStatus} />
                    {safeStatus === "PENDING" ? (
                      <NoticeCard text="Verifikasi sedang diproses. Tunggu konfirmasi admin." />
                    ) : (
                      <VerificationCard
                        status={safeStatus}
                        reason={verificationReason}
                        uploading={uploading}
                        uploadMsg={uploadMsg}
                        onUpload={uploadVerification}
                        onCardFileChange={onCardFileChange}
                        onSelfieFileChange={onSelfieFileChange}
                        cardPreview={cardPreview}
                        selfiePreview={selfiePreview}
                      />
                    )}
                    <NoticeCard text="Setelah diverifikasi admin, kamu bisa mengganti password." />
                  </>
                ) : (
                  <ChangePasswordCard
                    nim={nim}
                    newPassword={newPassword}
                    confirmPassword={confirmPassword}
                    onNewPasswordChange={onNewPasswordChange}
                    onConfirmPasswordChange={onConfirmPasswordChange}
                    message={passwordMessage}
                    loading={passwordLoading}
                    onSubmit={submitPasswordChange}
                    onLogout={handleLogout}
                  />
                )}
              </div>
            </section>
          ) : (
            <StudentShell nim={nim} isRelayer>
              {children}
            </StudentShell>
          )}
        </div>
      </div>

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
                <p className="text-[10px] font-semibold uppercase tracking-[0.4em] text-slate-400">
                  Mahasiswa
                </p>
                <h2 className="mt-2 text-lg font-semibold text-slate-900">
                  Voting BEM
                </h2>
                <p className="mt-1 text-xs text-slate-500">
                  Menu mahasiswa untuk akses cepat.
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
              <span className="rounded-full border border-emerald-200 bg-emerald-50 px-2 py-1 text-[10px] font-semibold uppercase text-emerald-700">
                Relayer
              </span>
              {nim && (
                <span className="text-xs text-slate-500">
                  Login sebagai <span className="font-semibold">{nim}</span>
                </span>
              )}
            </div>
            <nav className="mt-5 flex flex-col gap-2 pb-6">
              {studentTabs.map((item) => {
                const active =
                  pathname === item.href || pathname.startsWith(`${item.href}/`);
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
                      {item.icon}
                    </span>
                    <div>{item.label}</div>
                  </Link>
                );
              })}
            </nav>
            <button
              onClick={() => {
                setDrawerOpen(false);
                handleLogout();
              }}
              className="mt-2 flex w-full items-center justify-center gap-2 rounded-2xl border border-slate-200 px-4 py-2 text-xs font-semibold text-slate-600 transition hover:border-slate-300 hover:text-slate-800"
            >
              <LogOut className="h-4 w-4" />
              Logout
            </button>
            <div className="pb-6" />
          </div>
        </div>
      </div>
    </div>
  );
}
