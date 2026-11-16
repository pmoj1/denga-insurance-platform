-- Quote Generation Engine (Step 2): structured broker-sendable quotes.
CREATE TABLE "Quote" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "claimId" TEXT NOT NULL,
    "insuranceType" TEXT NOT NULL,
    "assetValue" TEXT,
    "clientSummary" TEXT NOT NULL,
    "riskFlags" JSONB NOT NULL,
    "recommendedOptions" JSONB NOT NULL,
    "estimatedPremiumRange" TEXT NOT NULL,
    "assumptions" JSONB NOT NULL,
    "recommendation" TEXT NOT NULL,
    "clientMessage" TEXT NOT NULL,
    "followUpRequired" BOOLEAN NOT NULL DEFAULT true,
    "followUpDueAt" TIMESTAMP(3),
    "sentAt" TIMESTAMP(3),
    "createdById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Quote_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "Quote_claimId_idx" ON "Quote"("claimId");
CREATE INDEX "Quote_tenantId_idx" ON "Quote"("tenantId");
ALTER TABLE "Quote" ADD CONSTRAINT "Quote_claimId_fkey" FOREIGN KEY ("claimId") REFERENCES "Claim"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
