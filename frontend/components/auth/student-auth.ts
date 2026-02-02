"use client";

export type StudentAuth = {
  nim: string;
  mustChangePassword: boolean;
};

const STORAGE_KEY = "studentAuth";

export function loadStudentAuth(): StudentAuth | null {
  if (typeof window === "undefined") return null;
  const raw = window.localStorage.getItem(STORAGE_KEY);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as StudentAuth;
  } catch {
    return null;
  }
}

export function saveStudentAuth(auth: StudentAuth) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(auth));
}

export function clearStudentAuth() {
  if (typeof window === "undefined") return;
  window.localStorage.removeItem(STORAGE_KEY);
}
