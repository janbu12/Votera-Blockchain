import {
  CAMPUS_SERVICE_TIMEOUT_MS,
  CAMPUS_SERVICE_TOKEN,
  CAMPUS_SERVICE_URL,
} from "../config";

export type CampusStudent = {
  nim: string;
  name: string;
  status: string;
  officialPhotoUrl: string;
};

async function campusRequest<T>(
  endpoint: string,
  init?: RequestInit
): Promise<{ ok: boolean; status: number; data: T | null }> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), CAMPUS_SERVICE_TIMEOUT_MS);
  try {
    const headers = new Headers(init?.headers);
    headers.set("x-campus-service-token", CAMPUS_SERVICE_TOKEN);
    if (init?.body && !headers.has("Content-Type")) {
      headers.set("Content-Type", "application/json");
    }

    const response = await fetch(`${CAMPUS_SERVICE_URL}${endpoint}`, {
      ...init,
      headers,
      signal: controller.signal,
      cache: "no-store",
    });
    const data = (await response.json().catch(() => null)) as T | null;
    return { ok: response.ok, status: response.status, data };
  } finally {
    clearTimeout(timeout);
  }
}

export async function campusLogin(
  nim: string,
  password: string
): Promise<CampusStudent | null> {
  const result = await campusRequest<{ ok: boolean; student?: CampusStudent; reason?: string }>(
    "/internal/auth/student-login",
    {
      method: "POST",
      body: JSON.stringify({ nim, password }),
    }
  );

  if (!result.ok) {
    if (result.status === 401 || result.status === 404) return null;
    const reason = result.data?.reason ?? "Campus service tidak tersedia";
    throw new Error(reason);
  }

  if (!result.data?.student) {
    throw new Error("Response campus service tidak valid");
  }
  return result.data.student;
}

export async function campusGetStudent(nim: string): Promise<CampusStudent | null> {
  const result = await campusRequest<{ ok: boolean; student?: CampusStudent }>(
    `/internal/students/${encodeURIComponent(nim)}`,
    { method: "GET" }
  );

  if (!result.ok) {
    if (result.status === 404) return null;
    throw new Error("Gagal memuat data mahasiswa dari campus service");
  }
  return result.data?.student ?? null;
}

export async function campusChangePassword(
  nim: string,
  newPassword: string
): Promise<void> {
  const result = await campusRequest<{ ok: boolean; reason?: string }>(
    `/internal/students/${encodeURIComponent(nim)}/change-password`,
    {
      method: "POST",
      body: JSON.stringify({ newPassword }),
    }
  );

  if (!result.ok) {
    throw new Error(result.data?.reason ?? "Gagal mengubah password di campus service");
  }
}
