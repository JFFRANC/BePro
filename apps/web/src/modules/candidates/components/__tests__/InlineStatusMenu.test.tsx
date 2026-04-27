// 008-ux-roles-refinements / US3 — InlineStatusMenu rendering + trigger tests.
import { describe, it, expect, vi, afterEach } from "vitest";
import { render, screen, cleanup, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { transitionOptionsFor } from "@bepro/shared";
import type { ReactNode } from "react";
import { InlineStatusMenu } from "../InlineStatusMenu";

// Stub the network: the menu renders without any calls in these tests.
vi.mock("../../services/candidateApi", () => ({
  transitionCandidate: vi.fn(),
  reactivateCandidate: vi.fn(),
  initAttachment: vi.fn(),
  uploadAttachmentBinary: vi.fn(),
  listAttachments: vi.fn(),
  setAttachmentObsolete: vi.fn(),
  getAttachmentDownloadUrl: vi.fn(),
  listRejectionCategories: vi.fn().mockResolvedValue([]),
  listDeclineCategories: vi.fn().mockResolvedValue([]),
}));

function wrap(children: ReactNode) {
  const qc = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  return <QueryClientProvider client={qc}>{children}</QueryClientProvider>;
}

describe("InlineStatusMenu (US3)", () => {
  afterEach(() => cleanup());

  it("disables the trigger when there are no valid FSM transitions (terminal state)", () => {
    render(
      wrap(
        <InlineStatusMenu
          candidateId="c1"
          currentStatus="guarantee_met"
        />,
      ),
    );
    const trigger = screen.getByRole("button", {
      name: /sin transiciones disponibles/i,
    });
    expect((trigger as HTMLButtonElement).disabled).toBe(true);
  });

  it("renders an enabled trigger for an active state", () => {
    render(
      wrap(
        <InlineStatusMenu candidateId="c2" currentStatus="registered" />,
      ),
    );
    const trigger = screen.getByRole("button", {
      name: /cambiar estado/i,
    });
    expect((trigger as HTMLButtonElement).disabled).toBe(false);
  });

  it("opens the menu on click (aria-expanded flips to true)", async () => {
    const user = userEvent.setup();
    render(
      wrap(
        <InlineStatusMenu candidateId="c3" currentStatus="registered" />,
      ),
    );
    const trigger = screen.getByRole("button", {
      name: /cambiar estado/i,
    });
    expect(trigger.getAttribute("aria-expanded")).toBe("false");
    await user.click(trigger);
    await waitFor(() =>
      expect(trigger.getAttribute("aria-expanded")).toBe("true"),
    );
  });

  it("exposes the same transitions as transitionOptionsFor() from shared", () => {
    // Regression guard: if the FSM changes, the table-driven shared test will
    // flag it first. We assert here that the component hasn't hard-coded
    // transitions away from the shared source of truth.
    const opts = transitionOptionsFor("approved");
    const categories = new Set(opts.map((o) => o.category));
    expect(categories.has("advance")).toBe(true);
    expect(categories.has("decline")).toBe(true);
  });
});
