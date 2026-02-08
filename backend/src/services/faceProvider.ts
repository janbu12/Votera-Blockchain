import crypto from "node:crypto";
import {
  FACE_MATCH_THRESHOLD,
  FACE_PROVIDER_MODE,
  FACE_PROVIDER_TIMEOUT_MS,
  FACE_SERVICE_TOKEN,
  FACE_SERVICE_URL,
} from "../config";

export type FaceVerificationInput = {
  nim: string;
  faceAssertionToken: string;
  referenceUrl: string;
  selfieDataUrl?: string;
};

export type FaceVerificationDecision = {
  provider: string;
  providerRequestId: string | null;
  livenessPassed: boolean;
  faceMatchScore: number;
  approved: boolean;
  reasonCode: string | null;
  modelVersion?: string | null;
};

function clampScore(value: number) {
  if (!Number.isFinite(value)) return 0;
  if (value < 0) return 0;
  if (value > 1) return 1;
  return value;
}

function localDecision(
  token: string,
  input: FaceVerificationInput
): FaceVerificationDecision {
  const providerRequestId = `mock_${crypto.randomUUID()}`;
  const raw = token.trim().toLowerCase();
  if (!raw) {
    return {
      provider: "face-mock",
      providerRequestId,
      livenessPassed: false,
      faceMatchScore: 0,
      approved: false,
      reasonCode: "EMPTY_ASSERTION",
    };
  }
  if (raw.includes("liveness-fail")) {
    return {
      provider: "face-mock",
      providerRequestId,
      livenessPassed: false,
      faceMatchScore: 0.92,
      approved: false,
      reasonCode: "LIVENESS_FAIL",
    };
  }
  if (raw.includes("low-score")) {
    return {
      provider: "face-mock",
      providerRequestId,
      livenessPassed: true,
      faceMatchScore: clampScore(FACE_MATCH_THRESHOLD - 0.2),
      approved: false,
      reasonCode: "LOW_SCORE",
    };
  }
  if (!input.selfieDataUrl) {
    return {
      provider: "face-local",
      providerRequestId,
      livenessPassed: false,
      faceMatchScore: 0,
      approved: false,
      reasonCode: "SELFIE_REQUIRED",
      modelVersion: "mock-local-v1",
    };
  }
  return {
    provider: "face-local",
    providerRequestId,
    livenessPassed: true,
    faceMatchScore: 0.99,
    approved: true,
    reasonCode: null,
    modelVersion: "mock-local-v1",
  };
}

type FaceServiceResponse = {
  ok: boolean;
  provider: string;
  providerRequestId: string;
  livenessPassed: boolean;
  faceMatchScore: number;
  approved: boolean;
  reasonCode: string | null;
  modelVersion?: string | null;
};

async function verifyWithModel(
  input: FaceVerificationInput
): Promise<FaceVerificationDecision> {
  if (!input.selfieDataUrl) {
    return {
      provider: "face-local-model",
      providerRequestId: null,
      livenessPassed: false,
      faceMatchScore: 0,
      approved: false,
      reasonCode: "SELFIE_REQUIRED",
      modelVersion: null,
    };
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), FACE_PROVIDER_TIMEOUT_MS);
  try {
    const requestId = crypto.randomUUID();
    const response = await fetch(`${FACE_SERVICE_URL}/verify`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-face-service-token": FACE_SERVICE_TOKEN,
      },
      signal: controller.signal,
      cache: "no-store",
      body: JSON.stringify({
        nim: input.nim,
        referenceUrl: input.referenceUrl,
        selfieDataUrl: input.selfieDataUrl,
        threshold: FACE_MATCH_THRESHOLD,
        requestId,
      }),
    });

    if (!response.ok) {
      const detail = await response.text().catch(() => "");
      throw new Error(
        `Face service request failed (${response.status}): ${detail || "unknown error"}`
      );
    }

    const payload = (await response.json()) as FaceServiceResponse;
    if (
      !payload ||
      payload.ok !== true ||
      typeof payload.provider !== "string" ||
      typeof payload.livenessPassed !== "boolean" ||
      typeof payload.faceMatchScore !== "number" ||
      typeof payload.approved !== "boolean"
    ) {
      throw new Error("Face service response invalid");
    }

    return {
      provider: payload.provider,
      providerRequestId: payload.providerRequestId ?? null,
      livenessPassed: payload.livenessPassed,
      faceMatchScore: clampScore(payload.faceMatchScore),
      approved: payload.approved,
      reasonCode: payload.reasonCode ?? null,
      modelVersion: payload.modelVersion ?? null,
    };
  } catch (err) {
    if (err instanceof Error && err.name === "AbortError") {
      throw new Error("Face service request timeout");
    }
    throw err;
  } finally {
    clearTimeout(timeout);
  }
}

export async function verifyFaceForVote(
  input: FaceVerificationInput
): Promise<FaceVerificationDecision> {
  if (FACE_PROVIDER_MODE === "mock" || FACE_PROVIDER_MODE === "local") {
    // Keep async boundary to preserve endpoint behavior and timeout expectations.
    await new Promise((resolve) => setTimeout(resolve, Math.min(250, FACE_PROVIDER_TIMEOUT_MS)));
    return localDecision(input.faceAssertionToken, input);
  }
  if (FACE_PROVIDER_MODE === "model") {
    return verifyWithModel(input);
  }
  throw new Error(`FACE_PROVIDER_MODE '${FACE_PROVIDER_MODE}' tidak didukung`);
}
