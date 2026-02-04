"use client";

import { Modal } from "@/components/Modal";

type CandidateProfileDraft = {
  tagline: string;
  about: string;
  visi: string;
  misi: string;
  programKerja: string;
  photoUrl?: string | null;
};

type Props = {
  open: boolean;
  candidateName: string;
  onCandidateNameChange: (value: string) => void;
  profile: CandidateProfileDraft;
  onProfileChange: (key: keyof CandidateProfileDraft, value: string) => void;
  onPhotoUpload: (file: File) => void;
  photoUploading: boolean;
  onClose: () => void;
  onSave: () => void;
  isSaving: boolean;
};

export function EditCandidateModal({
  open,
  candidateName,
  onCandidateNameChange,
  profile,
  onProfileChange,
  onPhotoUpload,
  photoUploading,
  onClose,
  onSave,
  isSaving,
}: Props) {
  return (
    <Modal
      open={open}
      title="Edit Kandidat"
      description="Lengkapi profil kandidat dan program kerja."
      onClose={onClose}
      widthClassName="max-w-2xl"
    >
      <div className="space-y-4">
        <label className="block text-xs font-semibold text-slate-500">
          Nama kandidat
          <input
            value={candidateName}
            onChange={(e) => onCandidateNameChange(e.target.value)}
            placeholder="Nama kandidat"
            className="mt-2 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm shadow-sm outline-none focus:border-slate-400"
          />
        </label>

        <div className="grid gap-3 md:grid-cols-[160px_1fr]">
          <div className="rounded-xl border border-slate-200 bg-slate-50 p-3 text-center">
            {profile.photoUrl ? (
              <img
                src={profile.photoUrl}
                alt="Foto kandidat"
                className="h-32 w-full rounded-lg object-cover"
              />
            ) : (
              <div className="flex h-32 items-center justify-center text-xs text-slate-400">
                Belum ada foto
              </div>
            )}
          </div>
          <div>
            <p className="text-xs font-semibold text-slate-500">Foto kandidat</p>
            <p className="mt-1 text-[11px] text-slate-400">
              Upload foto untuk ditampilkan ke mahasiswa.
            </p>
            <div className="mt-2 flex flex-wrap items-center gap-2">
              <label className="cursor-pointer rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-600 transition hover:bg-slate-50">
                Pilih Foto
                <input
                  type="file"
                  accept="image/*"
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (file) onPhotoUpload(file);
                  }}
                  className="sr-only"
                />
              </label>
              {photoUploading && (
                <span className="text-xs text-slate-400">Mengunggah...</span>
              )}
            </div>
          </div>
        </div>

        <label className="block text-xs font-semibold text-slate-500">
          Tagline (opsional)
          <input
            value={profile.tagline}
            onChange={(e) => onProfileChange("tagline", e.target.value)}
            placeholder="Contoh: Transparan & Inovatif"
            className="mt-2 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm shadow-sm outline-none focus:border-slate-400"
          />
        </label>

        <label className="block text-xs font-semibold text-slate-500">
          Tentang kandidat
          <textarea
            value={profile.about}
            onChange={(e) => onProfileChange("about", e.target.value)}
            placeholder="Cerita singkat kandidat"
            rows={3}
            className="mt-2 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm shadow-sm outline-none focus:border-slate-400"
          />
        </label>

        <div className="grid gap-3 md:grid-cols-2">
          <label className="block text-xs font-semibold text-slate-500">
            Visi
            <textarea
              value={profile.visi}
              onChange={(e) => onProfileChange("visi", e.target.value)}
              placeholder="Ringkas dan jelas"
              rows={3}
              className="mt-2 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm shadow-sm outline-none focus:border-slate-400"
            />
          </label>
          <label className="block text-xs font-semibold text-slate-500">
            Misi
            <textarea
              value={profile.misi}
              onChange={(e) => onProfileChange("misi", e.target.value)}
              placeholder="Poin misi utama"
              rows={3}
              className="mt-2 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm shadow-sm outline-none focus:border-slate-400"
            />
          </label>
        </div>

        <label className="block text-xs font-semibold text-slate-500">
          Program Kerja
          <textarea
            value={profile.programKerja}
            onChange={(e) => onProfileChange("programKerja", e.target.value)}
            placeholder="Daftar program kerja utama"
            rows={4}
            className="mt-2 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm shadow-sm outline-none focus:border-slate-400"
          />
        </label>

        <div className="flex justify-end gap-2">
          <button
            onClick={onClose}
            className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-600 transition hover:bg-slate-50"
          >
            Batal
          </button>
          <button
            onClick={onSave}
            disabled={isSaving || candidateName.trim().length === 0}
            className="rounded-lg bg-slate-900 px-4 py-2 text-sm font-semibold text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:bg-slate-400"
          >
            {isSaving ? "Menyimpan..." : "Simpan"}
          </button>
        </div>
      </div>
    </Modal>
  );
}
