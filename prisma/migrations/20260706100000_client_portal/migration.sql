-- Feature 1: Client Portal (token-gated per claim)

ALTER TABLE "Claim" ADD COLUMN "clientAccessToken" TEXT;
CREATE UNIQUE INDEX "Claim_clientAccessToken_key" ON "Claim"("clientAccessToken");

ALTER TABLE "EvidenceItem" ADD COLUMN "source" TEXT NOT NULL DEFAULT 'STAFF';

ALTER TABLE "Quote" ADD COLUMN "clientResponse" TEXT;
ALTER TABLE "Quote" ADD COLUMN "clientRespondedAt" TIMESTAMP(3);

CREATE TYPE "ClientRequestType" AS ENUM ('QUESTION', 'DOCUMENT');
CREATE TABLE "ClientRequest" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "claimId" TEXT NOT NULL,
    "type" "ClientRequestType" NOT NULL DEFAULT 'QUESTION',
    "prompt" TEXT NOT NULL,
    "response" TEXT,
    "respondedAt" TIMESTAMP(3),
    "createdById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "ClientRequest_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "ClientRequest_claimId_idx" ON "ClientRequest"("claimId");
ALTER TABLE "ClientRequest" ADD CONSTRAINT "ClientRequest_claimId_fkey" FOREIGN KEY ("claimId") REFERENCES "Claim"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
