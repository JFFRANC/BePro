import { describe, it, expect } from "vitest";
import { statusToBadgeVariant, badgeVariantToStatus } from "@/lib/status-utils";

describe("statusToBadgeVariant", () => {
  it("converts snake_case status to kebab-case badge variant", () => {
    expect(statusToBadgeVariant("interview_scheduled")).toBe("status-interview-scheduled");
    expect(statusToBadgeVariant("no_show")).toBe("status-no-show");
    expect(statusToBadgeVariant("in_guarantee")).toBe("status-in-guarantee");
    expect(statusToBadgeVariant("guarantee_met")).toBe("status-guarantee-met");
    expect(statusToBadgeVariant("registered")).toBe("status-registered");
    expect(statusToBadgeVariant("termination")).toBe("status-termination");
  });
});

describe("badgeVariantToStatus", () => {
  it("converts kebab-case badge variant back to snake_case status", () => {
    expect(badgeVariantToStatus("status-interview-scheduled")).toBe("interview_scheduled");
    expect(badgeVariantToStatus("status-no-show")).toBe("no_show");
  });
});
