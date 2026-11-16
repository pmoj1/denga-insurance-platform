-- Feature 3: Renewals Engine (Policy + Renewal)

CREATE TYPE "PolicyStatus" AS ENUM ('ACTIVE', 'LAPSED', 'RENEWED', 'CANCELLED');
CREATE TYPE "RenewalStatus" AS ENUM ('PENDING', 'DRAFTED', 'APPROVED', 'SENT', 'COMPLETED', 'DECLINED');

CREATE TABLE "Policy" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "policyNumber" TEXT NOT NULL,
    "clientName" TEXT NOT NULL,
    "insuranceType" TEXT NOT NULL,
    "assetValue" TEXT,
    "premium" TEXT,
    "inceptionDate" TIMESTAMP(3),
    "expiryDate" TIMESTAMP(3) NOT NULL,
    "status" "PolicyStatus" NOT NULL DEFAULT 'ACTIVE',
    "createdById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "Policy_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "Policy_tenantId_policyNumber_key" ON "Policy"("tenantId", "policyNumber");
CREATE INDEX "Policy_tenantId_expiryDate_idx" ON "Policy"("tenantId", "expiryDate");

CREATE TABLE "Renewal" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "policyId" TEXT NOT NULL,
    "dueDate" TIMESTAMP(3) NOT NULL,
    "reminderTier" TEXT NOT NULL,
    "status" "RenewalStatus" NOT NULL DEFAULT 'DRAFTED',
    "draftMessage" TEXT,
    "quoteRange" TEXT,
    "approvedAt" TIMESTAMP(3),
    "sentAt" TIMESTAMP(3),
    "createdById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "Renewal_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "Renewal_tenantId_status_idx" ON "Renewal"("tenantId", "status");
CREATE INDEX "Renewal_policyId_idx" ON "Renewal"("policyId");
ALTER TABLE "Renewal" ADD CONSTRAINT "Renewal_policyId_fkey" FOREIGN KEY ("policyId") REFERENCES "Policy"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
