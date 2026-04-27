import { describe, it, expect } from "vitest";
import { batchAssignmentsSchema } from "../schemas.js";

const UUID_A = "11111111-1111-4111-8111-111111111111";
const UUID_B = "22222222-2222-4222-8222-222222222222";
const UUID_C = "33333333-3333-4333-8333-333333333333";
const UUID_D = "44444444-4444-4444-8444-444444444444";

describe("batchAssignmentsSchema — polymorphic (AE + recruiter)", () => {
  describe("happy paths", () => {
    it("defaults both lists to [] when the object is empty", () => {
      const out = batchAssignmentsSchema.parse({});
      expect(out.accountExecutives).toEqual([]);
      expect(out.recruiters).toEqual([]);
    });

    it("accepts an AE-only payload and dedupes accountExecutives", () => {
      const out = batchAssignmentsSchema.parse({
        accountExecutives: [UUID_A, UUID_B, UUID_A],
      });
      expect(out.accountExecutives).toEqual([UUID_A, UUID_B]);
      expect(out.recruiters).toEqual([]);
    });

    it("accepts a recruiter without accountExecutiveId (unlinked)", () => {
      const out = batchAssignmentsSchema.parse({
        recruiters: [{ userId: UUID_C }],
      });
      expect(out.recruiters).toEqual([{ userId: UUID_C }]);
    });

    it("accepts a recruiter linked to an AE that is present in accountExecutives", () => {
      const out = batchAssignmentsSchema.parse({
        accountExecutives: [UUID_A],
        recruiters: [{ userId: UUID_C, accountExecutiveId: UUID_A }],
      });
      expect(out.accountExecutives).toEqual([UUID_A]);
      expect(out.recruiters).toEqual([
        { userId: UUID_C, accountExecutiveId: UUID_A },
      ]);
    });

    it("accepts a mixed payload with multiple recruiters under different AEs", () => {
      const out = batchAssignmentsSchema.parse({
        accountExecutives: [UUID_A, UUID_B],
        recruiters: [
          { userId: UUID_C, accountExecutiveId: UUID_A },
          { userId: UUID_D, accountExecutiveId: UUID_B },
        ],
      });
      expect(out.accountExecutives).toHaveLength(2);
      expect(out.recruiters).toHaveLength(2);
    });
  });

  describe("rejection cases", () => {
    it("rejects non-UUID strings in accountExecutives", () => {
      const r = batchAssignmentsSchema.safeParse({
        accountExecutives: ["not-a-uuid"],
      });
      expect(r.success).toBe(false);
    });

    it("rejects non-UUID strings in recruiters.userId", () => {
      const r = batchAssignmentsSchema.safeParse({
        recruiters: [{ userId: "not-a-uuid" }],
      });
      expect(r.success).toBe(false);
    });

    it("rejects non-UUID strings in recruiters.accountExecutiveId", () => {
      const r = batchAssignmentsSchema.safeParse({
        accountExecutives: [UUID_A],
        recruiters: [{ userId: UUID_C, accountExecutiveId: "bad" }],
      });
      expect(r.success).toBe(false);
    });

    it("rejects a userId that appears twice inside recruiters", () => {
      const r = batchAssignmentsSchema.safeParse({
        recruiters: [
          { userId: UUID_C, accountExecutiveId: UUID_A },
          { userId: UUID_C },
        ],
        accountExecutives: [UUID_A],
      });
      expect(r.success).toBe(false);
      if (!r.success) {
        expect(JSON.stringify(r.error)).toMatch(/duplicate/i);
      }
    });

    it("rejects a userId that appears in both accountExecutives and recruiters", () => {
      const r = batchAssignmentsSchema.safeParse({
        accountExecutives: [UUID_A],
        recruiters: [{ userId: UUID_A }],
      });
      expect(r.success).toBe(false);
      if (!r.success) {
        expect(JSON.stringify(r.error)).toMatch(/duplicate/i);
      }
    });

    it("rejects a recruiter whose accountExecutiveId is not in the accountExecutives list", () => {
      const r = batchAssignmentsSchema.safeParse({
        accountExecutives: [UUID_A],
        recruiters: [{ userId: UUID_C, accountExecutiveId: UUID_B }],
      });
      expect(r.success).toBe(false);
      if (!r.success) {
        expect(JSON.stringify(r.error)).toMatch(/leader|account_executive/i);
      }
    });
  });
});
