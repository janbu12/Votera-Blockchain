import {
  generateAuthenticationOptions,
  generateRegistrationOptions,
  verifyAuthenticationResponse,
  verifyRegistrationResponse,
} from "@simplewebauthn/server";
import { isoBase64URL } from "@simplewebauthn/server/helpers";
import {
  WEBAUTHN_ORIGINS,
  WEBAUTHN_RP_ID,
  WEBAUTHN_RP_NAME,
  WEBAUTHN_TIMEOUT_MS,
} from "../config";

const CHALLENGE_TTL_MS = 5 * 60 * 1000;

export const WEBAUTHN_PURPOSE_REGISTER = "REGISTER";
export const WEBAUTHN_PURPOSE_ASSERT_VOTE = "ASSERT_VOTE";

export type WebAuthnRegistrationResult = {
  credentialId: string;
  publicKey: string;
  counter: number;
  deviceType: string;
  backedUp: boolean;
  transports: string[];
};

function toBase64Url(value: unknown): string | null {
  if (typeof value === "string" && value.length > 0) return value;
  if (value instanceof Uint8Array) {
    // Normalize into a fresh ArrayBuffer-backed view for strict TS typing.
    return isoBase64URL.fromBuffer(new Uint8Array(value));
  }
  if (value instanceof ArrayBuffer) return isoBase64URL.fromBuffer(new Uint8Array(value));
  return null;
}

export function parseWebAuthnTransports(raw: string | null | undefined): string[] {
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return [];
    return parsed.filter((item): item is string => typeof item === "string");
  } catch {
    return [];
  }
}

export function serializeWebAuthnTransports(transports: string[]): string {
  return JSON.stringify(transports);
}

export function buildChallengeExpiry() {
  return new Date(Date.now() + CHALLENGE_TTL_MS);
}

export function challengeExpired(expiresAt: Date | null | undefined) {
  if (!expiresAt) return true;
  return expiresAt.getTime() < Date.now();
}

export function createRegistrationOptions(params: {
  nim: string;
  excludeCredentialId?: string | null;
  excludeTransports?: string[];
}) {
  const options = generateRegistrationOptions({
    rpID: WEBAUTHN_RP_ID,
    rpName: WEBAUTHN_RP_NAME,
    userID: new TextEncoder().encode(params.nim),
    userName: params.nim,
    userDisplayName: params.nim,
    timeout: WEBAUTHN_TIMEOUT_MS,
    authenticatorSelection: {
      userVerification: "required",
      residentKey: "preferred",
    },
    attestationType: "none",
    excludeCredentials: params.excludeCredentialId
      ? [
          {
            id: params.excludeCredentialId,
            transports: params.excludeTransports as any,
          },
        ]
      : [],
  });

  return options;
}

export async function validateRegistrationResponse(params: {
  response: unknown;
  expectedChallenge: string;
}) {
  const responseId =
    typeof (params.response as { id?: unknown })?.id === "string"
      ? ((params.response as { id: string }).id || null)
      : null;

  const verification = await verifyRegistrationResponse({
    response: params.response as Parameters<typeof verifyRegistrationResponse>[0]["response"],
    expectedChallenge: params.expectedChallenge,
    expectedOrigin: WEBAUTHN_ORIGINS,
    expectedRPID: WEBAUTHN_RP_ID,
    requireUserVerification: true,
  });

  const registrationInfo = (verification as any).registrationInfo;
  const credential = registrationInfo?.credential;
  const credentialId =
    toBase64Url(credential?.id) ??
    toBase64Url(registrationInfo?.credentialID) ??
    responseId;
  const publicKey =
    toBase64Url(credential?.publicKey) ??
    toBase64Url(registrationInfo?.credentialPublicKey);

  if (!verification.verified || !credentialId || !publicKey) {
    return { verified: false as const, result: null };
  }

  const transports =
    Array.isArray(credential.transports) && credential.transports.length > 0
      ? credential.transports.filter((item: unknown): item is string => typeof item === "string")
      : [];

  return {
    verified: true as const,
    result: {
      credentialId,
      publicKey,
      counter: Number(credential?.counter ?? registrationInfo?.counter ?? 0),
      deviceType: String(registrationInfo?.credentialDeviceType ?? "singleDevice"),
      backedUp: Boolean(registrationInfo?.credentialBackedUp ?? false),
      transports,
    } satisfies WebAuthnRegistrationResult,
  };
}

export function createAuthenticationOptions(params: {
  credentialId: string;
  transports: string[];
}) {
  const options = generateAuthenticationOptions({
    rpID: WEBAUTHN_RP_ID,
    userVerification: "required",
    timeout: WEBAUTHN_TIMEOUT_MS,
    allowCredentials: [
      {
        id: params.credentialId,
        transports: params.transports as any,
      },
    ],
  });
  return options;
}

export async function validateAuthenticationResponse(params: {
  response: unknown;
  expectedChallenge: string;
  credentialId: string;
  publicKey: string;
  counter: number;
  transports: string[];
}) {
  const verification = await verifyAuthenticationResponse({
    response: params.response as Parameters<typeof verifyAuthenticationResponse>[0]["response"],
    expectedChallenge: params.expectedChallenge,
    expectedOrigin: WEBAUTHN_ORIGINS,
    expectedRPID: WEBAUTHN_RP_ID,
    requireUserVerification: true,
    credential: {
      id: params.credentialId,
      publicKey: isoBase64URL.toBuffer(params.publicKey),
      counter: params.counter,
      transports: params.transports as any,
    },
  });

  const newCounter = Number((verification as any).authenticationInfo?.newCounter ?? params.counter);
  return {
    verified: verification.verified,
    newCounter,
  };
}
