import { db } from "@/lib/db";

/**
 * Client Portal access (Feature 1). A claim is exposed to its policyholder via
 * an unguessable per-claim token (same proven pattern as case-file share links).
 * No client login: the token in the URL is the credential, and it only ever
 * resolves that one claim — so a client can never see another client's data.
 */

const MIN_TOKEN_LENGTH = 16;

export async function resolveClaimByPortalToken(token: string) {
  if (!token || token.length < MIN_TOKEN_LENGTH) return null;
  return db.claim.findUnique({
    where: { clientAccessToken: token },
    include: {
      evidenceItems: { orderBy: { createdAt: "asc" } },
      stageEvents: { orderBy: { createdAt: "asc" } },
      quotes: { orderBy: { createdAt: "desc" }, take: 1 },
      clientRequests: { orderBy: { createdAt: "asc" } },
    },
  });
}

/** Lightweight lookup for portal action routes — just the ids they need. */
export async function resolveClaimRefByPortalToken(token: string) {
  if (!token || token.length < MIN_TOKEN_LENGTH) return null;
  return db.claim.findUnique({
    where: { clientAccessToken: token },
    select: { id: true, tenantId: true, createdById: true, claimantName: true },
  });
}
