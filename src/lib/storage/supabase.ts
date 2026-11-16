import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import type { EvidenceStorage } from "./index";

export class SupabaseStorage implements EvidenceStorage {
  private client: SupabaseClient;
  private bucket: string;
  private bucketReady = false;

  constructor(url: string, serviceRoleKey: string, bucket: string) {
    this.client = createClient(url, serviceRoleKey);
    this.bucket = bucket;
  }

  private async ensureBucket(): Promise<void> {
    if (this.bucketReady) return;
    const { data } = await this.client.storage.getBucket(this.bucket);
    if (!data) {
      const { error } = await this.client.storage.createBucket(this.bucket, {
        public: false,
      });
      // Another request may have created it concurrently; only fail on real errors.
      if (error && !error.message.toLowerCase().includes("already exists")) {
        throw new Error(`Could not create storage bucket "${this.bucket}": ${error.message}`);
      }
    }
    this.bucketReady = true;
  }

  async put(key: string, data: Buffer, contentType: string): Promise<string> {
    await this.ensureBucket();
    const { error } = await this.client.storage
      .from(this.bucket)
      .upload(key, data, { contentType, upsert: false });
    if (error) {
      throw new Error(`Evidence upload failed: ${error.message}`);
    }
    return key;
  }

  async get(key: string): Promise<Buffer> {
    const { data, error } = await this.client.storage.from(this.bucket).download(key);
    if (error || !data) {
      throw new Error(`Evidence download failed: ${error?.message ?? "not found"}`);
    }
    return Buffer.from(await data.arrayBuffer());
  }

  async signedUploadUrl(key: string): Promise<string> {
    await this.ensureBucket();
    const { data, error } = await this.client.storage
      .from(this.bucket)
      .createSignedUploadUrl(key);
    if (error || !data) {
      throw new Error(`Could not create upload URL: ${error?.message ?? "unknown error"}`);
    }
    return data.signedUrl;
  }

  async signedUrl(key: string, expiresInSeconds = 600): Promise<string> {
    const { data, error } = await this.client.storage
      .from(this.bucket)
      .createSignedUrl(key, expiresInSeconds);
    if (error || !data) {
      throw new Error(`Could not sign URL: ${error?.message ?? "unknown error"}`);
    }
    return data.signedUrl;
  }
}
