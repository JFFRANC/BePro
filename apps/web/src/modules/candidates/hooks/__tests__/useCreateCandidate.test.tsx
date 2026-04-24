import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { act, renderHook, waitFor } from "@testing-library/react";
import {
  QueryClient,
  QueryClientProvider,
} from "@tanstack/react-query";
import type { ReactNode } from "react";

vi.mock("../../services/candidateApi", () => ({
  createCandidate: vi.fn(),
}));

import { createCandidate } from "../../services/candidateApi";
import { useCreateCandidate } from "../useCandidates";

const CLIENT_ID = "22222222-2222-4222-9222-222222222222";
const NOTICE_ID = "44444444-4444-4444-9444-444444444444";

function wrapper({ children }: { children: ReactNode }) {
  const qc = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  return <QueryClientProvider client={qc}>{children}</QueryClientProvider>;
}

const validBody = {
  client_id: CLIENT_ID,
  first_name: "Juan",
  last_name: "Pérez",
  phone: "+52 55 1234 5678",
  email: "juan@example.com",
  source: "LinkedIn",
  privacy_notice_id: NOTICE_ID,
  privacy_acknowledged: true as const,
  additional_fields: {},
};

describe("useCreateCandidate (US1 — flujo de duplicados)", () => {
  beforeEach(() => vi.clearAllMocks());
  afterEach(() => vi.clearAllMocks());

  it("happy path: created se popula con el candidato", async () => {
    vi.mocked(createCandidate).mockResolvedValueOnce({
      kind: "created",
      candidate: { id: "new-cand", first_name: "Juan" } as never,
    });

    const onCreated = vi.fn();
    const { result } = renderHook(() => useCreateCandidate({ onCreated }), {
      wrapper,
    });

    act(() => result.current.submit(validBody));

    await waitFor(() => expect(result.current.created?.id).toBe("new-cand"));
    expect(onCreated).toHaveBeenCalledWith({ id: "new-cand", first_name: "Juan" });
    expect(result.current.duplicates).toHaveLength(0);
  });

  it("409: duplicates se expone para que el caller renderice el dialog", async () => {
    vi.mocked(createCandidate).mockResolvedValueOnce({
      kind: "duplicates",
      duplicates: [
        {
          id: "dup-1",
          first_name: "Juan",
          last_name: "Pérez",
          status: "interview_scheduled",
          created_at: "2026-03-01T00:00:00.000Z",
          registering_user: { id: "u-other", display_name: "Otro" },
        },
      ],
    });

    const { result } = renderHook(() => useCreateCandidate(), { wrapper });

    act(() => result.current.submit(validBody));

    await waitFor(() => expect(result.current.duplicates).toHaveLength(1));
    expect(result.current.created).toBeNull();
  });

  it("confirmDuplicates re-envía el body con duplicate_confirmation", async () => {
    vi.mocked(createCandidate)
      .mockResolvedValueOnce({
        kind: "duplicates",
        duplicates: [
          {
            id: "dup-1",
            first_name: "Juan",
            last_name: "Pérez",
            status: "interview_scheduled",
            created_at: "2026-03-01T00:00:00.000Z",
            registering_user: { id: "u-other", display_name: "Otro" },
          },
        ],
      })
      .mockResolvedValueOnce({
        kind: "created",
        candidate: { id: "after-confirm", first_name: "Juan" } as never,
      });

    const { result } = renderHook(() => useCreateCandidate(), { wrapper });

    act(() => result.current.submit(validBody));
    await waitFor(() => expect(result.current.duplicates).toHaveLength(1));

    act(() => result.current.confirmDuplicates());

    await waitFor(() =>
      expect(result.current.created?.id).toBe("after-confirm"),
    );
    // El segundo llamado incluye duplicate_confirmation
    expect(vi.mocked(createCandidate).mock.calls[1][0]).toMatchObject({
      duplicate_confirmation: { confirmed_duplicate_ids: ["dup-1"] },
    });
  });

  it("cancelDuplicates limpia el estado", async () => {
    vi.mocked(createCandidate).mockResolvedValueOnce({
      kind: "duplicates",
      duplicates: [
        {
          id: "dup-1",
          first_name: "Juan",
          last_name: "Pérez",
          status: "interview_scheduled",
          created_at: "2026-03-01T00:00:00.000Z",
          registering_user: { id: "u-other", display_name: "Otro" },
        },
      ],
    });

    const { result } = renderHook(() => useCreateCandidate(), { wrapper });

    act(() => result.current.submit(validBody));
    await waitFor(() => expect(result.current.duplicates).toHaveLength(1));

    act(() => result.current.cancelDuplicates());

    expect(result.current.duplicates).toHaveLength(0);
    expect(result.current.pendingBody).toBeNull();
  });
});
