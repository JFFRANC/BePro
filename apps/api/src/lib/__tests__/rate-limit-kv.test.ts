// US4 — per-email password-reset rate-limit, backed by Cloudflare KV.
// Tests use an in-memory KV stub that mirrors the surface of the real binding.

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { checkAndIncrementEmailRate } from "../rate-limit-kv.js";

interface KVEntry {
  value: string;
  expiresAt: number;
}

function createKvStub(now: () => number): KVNamespace {
  const store = new Map<string, KVEntry>();
  return {
    async get(key: string) {
      const entry = store.get(key);
      if (!entry) return null;
      if (entry.expiresAt <= now()) {
        store.delete(key);
        return null;
      }
      return entry.value;
    },
    async put(
      key: string,
      value: string,
      opts?: { expirationTtl?: number },
    ) {
      const ttl = opts?.expirationTtl ?? 0;
      store.set(key, { value, expiresAt: now() + ttl * 1000 });
    },
    async delete(key: string) {
      store.delete(key);
    },
    async list() {
      return { keys: [], list_complete: true } as unknown as KVNamespaceListResult<unknown>;
    },
    async getWithMetadata() {
      return { value: null, metadata: null };
    },
  } as unknown as KVNamespace;
}

describe("checkAndIncrementEmailRate (US4)", () => {
  let mockNow: number;

  beforeEach(() => {
    mockNow = 1_000_000;
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("returns true on the first call within the budget", async () => {
    const kv = createKvStub(() => mockNow);
    const allowed = await checkAndIncrementEmailRate(kv, "juan@ejemplo.com");
    expect(allowed).toBe(true);
  });

  it("returns false on the second call within 60 s for the same email", async () => {
    const kv = createKvStub(() => mockNow);
    expect(await checkAndIncrementEmailRate(kv, "juan@ejemplo.com")).toBe(true);
    expect(await checkAndIncrementEmailRate(kv, "juan@ejemplo.com")).toBe(
      false,
    );
  });

  it("returns true again once the per-minute window has expired", async () => {
    const kv = createKvStub(() => mockNow);
    expect(await checkAndIncrementEmailRate(kv, "juan@ejemplo.com")).toBe(true);
    // Advance 61 s — minute key expires, hour key still alive (count = 1).
    mockNow += 61_000;
    expect(await checkAndIncrementEmailRate(kv, "juan@ejemplo.com")).toBe(true);
  });

  it("returns false on the 6th call within the rolling hour", async () => {
    const kv = createKvStub(() => mockNow);
    for (let i = 0; i < 5; i++) {
      // Advance past the per-minute window so each call is allowed by the
      // minute counter; the hour counter is what we are pressuring here.
      expect(await checkAndIncrementEmailRate(kv, "juan@ejemplo.com")).toBe(
        true,
      );
      mockNow += 61_000;
    }
    expect(await checkAndIncrementEmailRate(kv, "juan@ejemplo.com")).toBe(
      false,
    );
  });

  it("treats different emails as independent buckets", async () => {
    const kv = createKvStub(() => mockNow);
    expect(await checkAndIncrementEmailRate(kv, "a@example.com")).toBe(true);
    expect(await checkAndIncrementEmailRate(kv, "b@example.com")).toBe(true);
    // Same emails twice — both throttled.
    expect(await checkAndIncrementEmailRate(kv, "a@example.com")).toBe(false);
    expect(await checkAndIncrementEmailRate(kv, "b@example.com")).toBe(false);
  });

  it("normalizes case and trims whitespace before hashing the email", async () => {
    const kv = createKvStub(() => mockNow);
    expect(await checkAndIncrementEmailRate(kv, "Juan@Ejemplo.com")).toBe(true);
    expect(await checkAndIncrementEmailRate(kv, "  juan@ejemplo.com  ")).toBe(
      false,
    );
  });
});
