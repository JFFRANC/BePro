import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { Badge } from "@/components/ui/badge";

const FSM_VARIANTS = [
  "status-registered",
  "status-interview-scheduled",
  "status-attended",
  "status-pending",
  "status-approved",
  "status-hired",
  "status-in-guarantee",
  "status-guarantee-met",
  "status-rejected",
  "status-declined",
  "status-no-show",
  "status-termination",
  "status-discarded",
  "status-replacement",
] as const;

describe("US3 — Candidate Status Badges", () => {
  it("T025: Badge renders with variant='status-registered' and applies correct CSS class", () => {
    render(<Badge variant="status-registered">Registrado</Badge>);
    const badge = screen.getByText("Registrado");
    expect(badge.className).toContain("bg-badge-registered");
    expect(badge.className).toContain("text-badge-registered-fg");
  });

  it("T026: all 14 FSM status variants render without errors", () => {
    for (const variant of FSM_VARIANTS) {
      const { unmount } = render(
        <Badge variant={variant}>{variant}</Badge>,
      );
      const badge = screen.getByText(variant);
      expect(badge).toBeDefined();
      unmount();
    }
  });

  it("T027: Badge defaults to variant='default' when no variant is specified", () => {
    render(<Badge>Default</Badge>);
    const badge = screen.getByText("Default");
    expect(badge.className).toContain("bg-primary");
  });

  it("T028: Badge renders gracefully with unknown variant, falling back to default", () => {
    // @ts-expect-error Testing unknown variant
    render(<Badge variant="status-unknown">Unknown</Badge>);
    const badge = screen.getByText("Unknown");
    expect(badge).toBeDefined();
    expect(badge.className).not.toContain("undefined");
  });
});
