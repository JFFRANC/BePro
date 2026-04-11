import { describe, it, expect } from "vitest";
import { queryClient } from "@/lib/query-client";

describe("queryClient", () => {
  it("has retry set to 3 for queries", () => {
    expect(queryClient.getDefaultOptions().queries?.retry).toBe(3);
  });

  it("has staleTime set to 30 seconds", () => {
    expect(queryClient.getDefaultOptions().queries?.staleTime).toBe(30_000);
  });

  it("has retry set to 1 for mutations", () => {
    expect(queryClient.getDefaultOptions().mutations?.retry).toBe(1);
  });
});
