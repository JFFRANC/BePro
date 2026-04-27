import { describe, it, expect, vi, afterEach } from "vitest";
import { render, screen, cleanup } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import type { ReactNode } from "react";
import { DuplicateWarningDialog } from "../DuplicateWarningDialog";
import type { IDuplicateSummary } from "@bepro/shared";

afterEach(() => cleanup());

const sampleDuplicates: IDuplicateSummary[] = [
  {
    id: "dup-1",
    first_name: "Juan",
    last_name: "Pérez",
    status: "interview_scheduled",
    created_at: "2026-03-15T00:00:00.000Z",
    registering_user: { id: "u-other", display_name: "Maria Recruiter" },
  },
];

function withRouter(node: ReactNode) {
  return <MemoryRouter>{node}</MemoryRouter>;
}

describe("DuplicateWarningDialog (US1)", () => {
  it("renders the duplicates and the action buttons", () => {
    render(
      withRouter(
        <DuplicateWarningDialog
          open
          duplicates={sampleDuplicates}
          onConfirm={vi.fn()}
          onCancel={vi.fn()}
        />,
      ),
    );
    expect(screen.getByText(/posibles candidatos duplicados/i)).toBeDefined();
    expect(screen.getByText("Juan Pérez")).toBeDefined();
    expect(screen.getByText(/maria recruiter/i)).toBeDefined();
    // 008-ux-roles-refinements / US4 — statusLabel now defaults to Spanish.
    expect(screen.getByText(/entrevista programada/i)).toBeDefined();
    expect(screen.getByRole("button", { name: /sí, registrar/i })).toBeDefined();
    expect(screen.getByRole("button", { name: /cancelar/i })).toBeDefined();
    // L7: link al detalle del duplicado
    expect(screen.getByRole("link", { name: /abrir detalle de juan pérez/i })).toBeDefined();
  });

  it("invokes onConfirm when the user accepts", async () => {
    const onConfirm = vi.fn();
    const user = userEvent.setup();
    render(
      withRouter(
        <DuplicateWarningDialog
          open
          duplicates={sampleDuplicates}
          onConfirm={onConfirm}
          onCancel={vi.fn()}
        />,
      ),
    );

    await user.click(screen.getByRole("button", { name: /sí, registrar/i }));
    expect(onConfirm).toHaveBeenCalledOnce();
  });

  it("invokes onCancel when the user cancels", async () => {
    const onCancel = vi.fn();
    const user = userEvent.setup();
    render(
      withRouter(
        <DuplicateWarningDialog
          open
          duplicates={sampleDuplicates}
          onConfirm={vi.fn()}
          onCancel={onCancel}
        />,
      ),
    );

    await user.click(screen.getByRole("button", { name: /cancelar/i }));
    expect(onCancel).toHaveBeenCalled();
  });

  it("disables the buttons when isSubmitting=true", () => {
    render(
      withRouter(
        <DuplicateWarningDialog
          open
          duplicates={sampleDuplicates}
          onConfirm={vi.fn()}
          onCancel={vi.fn()}
          isSubmitting
        />,
      ),
    );
    expect(
      (screen.getByRole("button", { name: /sí, registrar/i }) as HTMLButtonElement)
        .disabled,
    ).toBe(true);
    expect(
      (screen.getByRole("button", { name: /cancelar/i }) as HTMLButtonElement)
        .disabled,
    ).toBe(true);
  });
});
