import { promises as fs } from "fs";
import path from "path";
import type { EvidenceStorage } from "./index";

const ROOT = path.join(process.cwd(), ".evidence-store");

/**
 * Dev-only fallback: files live in .evidence-store/ in the project root.
 * signedUrl routes through our own authenticated evidence endpoint since the
 * filesystem can't mint URLs.
 */
export class LocalDiskStorage implements EvidenceStorage {
  private resolve(key: string): string {
    const full = path.resolve(ROOT, key);
    if (!full.startsWith(path.resolve(ROOT) + path.sep)) {
      throw new Error(`Invalid storage key: ${key}`);
    }
    return full;
  }

  async put(key: string, data: Buffer): Promise<string> {
    const full = this.resolve(key);
    await fs.mkdir(path.dirname(full), { recursive: true });
    await fs.writeFile(full, data);
    return key;
  }

  async get(key: string): Promise<Buffer> {
    return fs.readFile(this.resolve(key));
  }

  async signedUrl(key: string): Promise<string> {
    // Served by our own auth-gated route; no expiry needed since access is session-checked.
    return `/api/evidence/file?key=${encodeURIComponent(key)}`;
  }
}
