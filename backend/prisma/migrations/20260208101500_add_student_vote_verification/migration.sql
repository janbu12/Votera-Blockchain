-- CreateTable
CREATE TABLE "StudentVoteVerification" (
    "id" SERIAL NOT NULL,
    "studentId" INTEGER NOT NULL,
    "nim" TEXT NOT NULL,
    "electionId" BIGINT NOT NULL,
    "candidateId" BIGINT NOT NULL,
    "provider" TEXT NOT NULL,
    "providerRequestId" TEXT,
    "assertionTokenHash" TEXT,
    "livenessPassed" BOOLEAN NOT NULL,
    "faceMatchScore" DOUBLE PRECISION,
    "decision" TEXT NOT NULL,
    "reasonCode" TEXT,
    "ip" TEXT,
    "userAgent" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "StudentVoteVerification_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "StudentVoteVerification_nim_electionId_createdAt_idx" ON "StudentVoteVerification"("nim", "electionId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "StudentVoteVerification_assertionTokenHash_key" ON "StudentVoteVerification"("assertionTokenHash");

-- AddForeignKey
ALTER TABLE "StudentVoteVerification" ADD CONSTRAINT "StudentVoteVerification_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "Student"("id") ON DELETE CASCADE ON UPDATE CASCADE;
