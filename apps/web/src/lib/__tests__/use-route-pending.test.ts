import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook } from "@testing-library/react";

vi.mock("react-router-dom", () => ({
  useNavigation: vi.fn(),
}));
vi.mock("@tanstack/react-query", () => ({
  useIsFetching: vi.fn(),
}));

import { useNavigation } from "react-router-dom";
import { useIsFetching } from "@tanstack/react-query";
import { useRoutePending } from "@/lib/use-route-pending";

describe("useRoutePending", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns false when the router is idle and no queries are fetching", () => {
    vi.mocked(useNavigation).mockReturnValue({ state: "idle" } as never);
    vi.mocked(useIsFetching).mockReturnValue(0);
    const { result } = renderHook(() => useRoutePending());
    expect(result.current).toBe(false);
  });

  it("returns true while a route transition is in flight", () => {
    vi.mocked(useNavigation).mockReturnValue({ state: "loading" } as never);
    vi.mocked(useIsFetching).mockReturnValue(0);
    const { result } = renderHook(() => useRoutePending());
    expect(result.current).toBe(true);
  });

  it("returns true while queries are fetching", () => {
    vi.mocked(useNavigation).mockReturnValue({ state: "idle" } as never);
    vi.mocked(useIsFetching).mockReturnValue(2);
    const { result } = renderHook(() => useRoutePending());
    expect(result.current).toBe(true);
  });
});
