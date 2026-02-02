type AdminProfile = {
  username: string;
};

const STORAGE_KEY = "adminProfile";

export function loadAdminProfile(): AdminProfile | null {
  if (typeof window === "undefined") return null;
  const raw = window.sessionStorage.getItem(STORAGE_KEY);
  if (!raw) return null;
  try {
    const data = JSON.parse(raw) as AdminProfile;
    if (!data?.username) return null;
    return data;
  } catch {
    return null;
  }
}

export function saveAdminProfile(profile: AdminProfile) {
  if (typeof window === "undefined") return;
  window.sessionStorage.setItem(STORAGE_KEY, JSON.stringify(profile));
}

export function clearAdminProfile() {
  if (typeof window === "undefined") return;
  window.sessionStorage.removeItem(STORAGE_KEY);
}
