import { randomBytes } from "node:crypto";

/** Summary-only payload. Deliberately excludes names, addresses, sender, quotes. */
export type SharedSummary = {
  language: "fil" | "en";
  type: string;
  dates: string[];
  nextSteps: string[];
};
export type ShareRecord = {
  id: string;
  ownerSession: string;
  expiresAt: string;
  payload: SharedSummary;
};

/** Storage seam. Replace the in-memory implementation with Supabase (`shared_summaries`). */
export interface ShareStore {
  create(
    owner: string,
    payload: SharedSummary,
    ttlHours: number,
  ): Promise<ShareRecord>;
  get(id: string): Promise<ShareRecord | null>;
  revoke(id: string, owner: string): Promise<boolean>;
  revokeAll(owner: string): Promise<number>;
}

const g = globalThis as { __ll_shares?: Map<string, ShareRecord> };
const mem: Map<string, ShareRecord> = (g.__ll_shares ??= new Map());

export const memoryShareStore: ShareStore = {
  async create(owner, payload, ttlHours) {
    const rec: ShareRecord = {
      id: randomBytes(16).toString("base64url"),
      ownerSession: owner,
      expiresAt: new Date(Date.now() + ttlHours * 3_600_000).toISOString(),
      payload,
    };
    mem.set(rec.id, rec);
    return rec;
  },
  async get(id) {
    const r = mem.get(id);
    if (!r) return null;
    if (Date.parse(r.expiresAt) <= Date.now()) {
      mem.delete(id);
      return null;
    }
    return r;
  },
  async revoke(id, owner) {
    const r = mem.get(id);
    if (!r || r.ownerSession !== owner) return false;
    return mem.delete(id);
  },
  async revokeAll(owner) {
    let n = 0;
    for (const [id, r] of mem)
      if (r.ownerSession === owner) {
        mem.delete(id);
        n++;
      }
    return n;
  },
};

export const shareStore: ShareStore = memoryShareStore;
export const SHARE_TTL_HOURS = Number(process.env.SHARE_TTL_HOURS ?? 72);
