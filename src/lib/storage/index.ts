import { LocalDiskStorage } from "./local";
import { SupabaseStorage } from "./supabase";

/**
 * Evidence/object storage behind one interface so the backing store can be
 * swapped (Supabase Storage today, AWS S3/R2 later) without touching callers.
 * Selection: Supabase when SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY are set,
 * otherwise local disk (dev fallback only — files won't survive a redeploy).
 */
export interface EvidenceStorage {
  /** Store bytes under a key. Returns the key. */
  put(key: string, data: Buffer, contentType: string): Promise<string>;
  /** Read bytes back. */
  get(key: string): Promise<Buffer>;
  /** Short-lived URL a browser can load the object from (for thumbnails/audio). */
  signedUrl(key: string, expiresInSeconds?: number): Promise<string>;
  /**
   * Short-lived URL the browser can PUT a file to directly, skipping our server
   * (needed on hosts with small request-body limits). Absent on adapters that
   * can't mint one — callers fall back to the multipart proxy route.
   */
  signedUploadUrl?(key: string): Promise<string>;
}

let storage: EvidenceStorage | null = null;

export function getStorage(): EvidenceStorage {
  if (!storage) {
    if (process.env.SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY) {
      storage = new SupabaseStorage(
        process.env.SUPABASE_URL,
        process.env.SUPABASE_SERVICE_ROLE_KEY,
        process.env.SUPABASE_STORAGE_BUCKET ?? "evidence"
      );
    } else {
      storage = new LocalDiskStorage();
    }
  }
  return storage;
}
