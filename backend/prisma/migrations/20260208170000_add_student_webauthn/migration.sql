-- AlterTable
ALTER TABLE "Student"
ADD COLUMN "webAuthnCredentialId" TEXT,
ADD COLUMN "webAuthnPublicKey" TEXT,
ADD COLUMN "webAuthnCounter" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN "webAuthnDeviceType" TEXT,
ADD COLUMN "webAuthnBackedUp" BOOLEAN,
ADD COLUMN "webAuthnTransports" TEXT,
ADD COLUMN "webAuthnRegisteredAt" TIMESTAMP(3),
ADD COLUMN "webAuthnChallenge" TEXT,
ADD COLUMN "webAuthnChallengePurpose" TEXT,
ADD COLUMN "webAuthnChallengeExpiresAt" TIMESTAMP(3);

-- CreateIndex
CREATE UNIQUE INDEX "Student_webAuthnCredentialId_key" ON "Student"("webAuthnCredentialId");
