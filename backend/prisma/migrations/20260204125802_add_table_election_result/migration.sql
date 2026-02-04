-- CreateTable
CREATE TABLE "ElectionResult" (
    "id" SERIAL NOT NULL,
    "electionId" BIGINT NOT NULL,
    "title" TEXT NOT NULL,
    "totalVotes" INTEGER NOT NULL,
    "results" JSONB NOT NULL,
    "snapshotAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "published" BOOLEAN NOT NULL DEFAULT false,
    "publishedAt" TIMESTAMP(3),
    "startTime" TIMESTAMP(3),
    "endTime" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ElectionResult_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "ElectionResult_electionId_key" ON "ElectionResult"("electionId");
