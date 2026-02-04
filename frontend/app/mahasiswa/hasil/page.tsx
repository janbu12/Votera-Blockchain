"use client";

import { ResultsLinks } from "@/components/student/StudentSections";

export default function StudentResultsPage() {
  return (
    <div className="space-y-6">
      <div>
        <p className="text-xs font-semibold uppercase tracking-[0.3em] text-slate-400">
          Hasil
        </p>
        <h2 className="mt-2 text-xl font-semibold text-slate-900">
          Hasil Pemilihan
        </h2>
        <p className="mt-1 text-sm text-slate-500">
          Akses hasil resmi dan progress publik.
        </p>
      </div>

      <ResultsLinks />
    </div>
  );
}
