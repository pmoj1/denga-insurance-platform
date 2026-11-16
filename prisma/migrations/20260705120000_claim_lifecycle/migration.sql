-- Evolve ClaimStatus into the claim lifecycle and add the stage-history timeline.

-- 1. New enum with the lifecycle values
CREATE TYPE "ClaimStatus_new" AS ENUM ('INTAKE_RECEIVED', 'DOCUMENTS_PENDING', 'SUBMITTED_TO_INSURER', 'UNDER_REVIEW', 'APPROVED', 'REJECTED');

-- 2. Drop the default so the column type can change
ALTER TABLE "Claim" ALTER COLUMN "status" DROP DEFAULT;

-- 3. Convert existing rows with an explicit, non-destructive mapping
ALTER TABLE "Claim" ALTER COLUMN "status" TYPE "ClaimStatus_new" USING (
  CASE "status"::text
    WHEN 'RECEIVED' THEN 'INTAKE_RECEIVED'
    WHEN 'UNDER_REVIEW' THEN 'UNDER_REVIEW'
    WHEN 'ASSESSMENT' THEN 'UNDER_REVIEW'
    WHEN 'SETTLEMENT' THEN 'APPROVED'
    WHEN 'CLOSED' THEN 'APPROVED'
    ELSE 'INTAKE_RECEIVED'
  END::"ClaimStatus_new"
);

-- 4. Swap the enum types
DROP TYPE "ClaimStatus";
ALTER TYPE "ClaimStatus_new" RENAME TO "ClaimStatus";

-- 5. Restore the default
ALTER TABLE "Claim" ALTER COLUMN "status" SET DEFAULT 'INTAKE_RECEIVED';

-- 6. Stage-history table
CREATE TABLE "ClaimStageEvent" (
    "id" TEXT NOT NULL,
    "claimId" TEXT NOT NULL,
    "fromStatus" "ClaimStatus",
    "toStatus" "ClaimStatus" NOT NULL,
    "note" TEXT,
    "actorEmail" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "ClaimStageEvent_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "ClaimStageEvent_claimId_createdAt_idx" ON "ClaimStageEvent"("claimId", "createdAt");
ALTER TABLE "ClaimStageEvent" ADD CONSTRAINT "ClaimStageEvent_claimId_fkey" FOREIGN KEY ("claimId") REFERENCES "Claim"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
