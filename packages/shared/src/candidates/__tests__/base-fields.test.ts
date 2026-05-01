// 012-client-detail-ux — contract tests for BASE_CANDIDATE_FIELDS.
// See contracts/shared-base-fields.md for the full guarantees list.
import { describe, it, expect } from "vitest";
import {
  BASE_CANDIDATE_FIELDS,
  BASE_FIELD_KEY_SET,
  type BaseFieldKey,
} from "../base-fields.js";

describe("BASE_CANDIDATE_FIELDS contract", () => {
  it("has exactly 9 entries", () => {
    expect(BASE_CANDIDATE_FIELDS).toHaveLength(9);
  });

  it("preserves the exact ordered key list", () => {
    const expected: BaseFieldKey[] = [
      "fullName",
      "interviewPhone",
      "interviewDate",
      "interviewTime",
      "positionId",
      "state",
      "municipality",
      "recruiterName",
      "accountExecutiveName",
    ];
    expect(BASE_CANDIDATE_FIELDS.map((f) => f.key)).toEqual(expected);
  });

  it("marks every entry as required", () => {
    for (const f of BASE_CANDIDATE_FIELDS) {
      expect(f.required).toBe(true);
    }
  });

  it("is frozen (Object.isFrozen === true)", () => {
    expect(Object.isFrozen(BASE_CANDIDATE_FIELDS)).toBe(true);
  });

  it("rejects mutation in strict mode", () => {
    expect(() => {
      // @ts-expect-error - intentional mutation attempt
      BASE_CANDIDATE_FIELDS.push({
        key: "foo",
        label: "Foo",
        type: "text",
        required: true,
      });
    }).toThrow(TypeError);
  });

  it("BASE_FIELD_KEY_SET has size 9 and matches the keys", () => {
    expect(BASE_FIELD_KEY_SET.size).toBe(9);
    const keys = new Set(BASE_CANDIDATE_FIELDS.map((f) => f.key));
    for (const k of keys) {
      expect(BASE_FIELD_KEY_SET.has(k as BaseFieldKey)).toBe(true);
    }
  });

  it("BASE_FIELD_KEY_SET membership", () => {
    expect(BASE_FIELD_KEY_SET.has("fullName")).toBe(true);
    expect(BASE_FIELD_KEY_SET.has("positionId")).toBe(true);
    expect(BASE_FIELD_KEY_SET.has("accountExecutiveName")).toBe(true);
    expect(BASE_FIELD_KEY_SET.has("foo" as BaseFieldKey)).toBe(false);
  });

  it("Spanish labels are non-empty", () => {
    for (const f of BASE_CANDIDATE_FIELDS) {
      expect(typeof f.label).toBe("string");
      expect(f.label.length).toBeGreaterThan(0);
    }
  });

  it("positionId is the only select-type field", () => {
    const selects = BASE_CANDIDATE_FIELDS.filter((f) => f.type === "select");
    expect(selects).toHaveLength(1);
    expect(selects[0].key).toBe("positionId");
  });

  it("interviewDate is the only date-type field", () => {
    const dates = BASE_CANDIDATE_FIELDS.filter((f) => f.type === "date");
    expect(dates).toHaveLength(1);
    expect(dates[0].key).toBe("interviewDate");
  });
});
