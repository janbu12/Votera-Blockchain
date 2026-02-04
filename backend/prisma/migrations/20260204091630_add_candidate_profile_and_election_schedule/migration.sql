-- CreateTable
CREATE TABLE "CandidateProfile" (
    "id" SERIAL NOT NULL,
    "electionId" BIGINT NOT NULL,
    "candidateId" BIGINT NOT NULL,
    "tagline" TEXT,
    "about" TEXT,
    "visi" TEXT,
    "misi" TEXT,
    "programKerja" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CandidateProfile_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ElectionSchedule" (
    "id" SERIAL NOT NULL,
    "electionId" BIGINT NOT NULL,
    "opensAt" TIMESTAMP(3),
    "closesAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ElectionSchedule_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "CandidateProfile_electionId_candidateId_key" ON "CandidateProfile"("electionId", "candidateId");

-- CreateIndex
CREATE UNIQUE INDEX "ElectionSchedule_electionId_key" ON "ElectionSchedule"("electionId");
