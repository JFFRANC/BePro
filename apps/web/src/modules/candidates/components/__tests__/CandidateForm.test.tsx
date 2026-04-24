import { describe, it, expect, vi, afterEach } from "vitest";
import { render, screen, cleanup } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { CandidateForm } from "../CandidateForm";

afterEach(() => cleanup());

const CLIENT_ID = "22222222-2222-4222-9222-222222222222";

describe("CandidateForm (US1)", () => {
  it("renders the core fields", () => {
    render(
      <CandidateForm
        clientId={CLIENT_ID}
        formConfig={{ fields: [] }}
        onValidSubmit={vi.fn()}
      />,
    );
    expect(screen.getByLabelText(/nombre/i)).toBeDefined();
    expect(screen.getByLabelText(/apellidos/i)).toBeDefined();
    expect(screen.getByLabelText(/teléfono/i)).toBeDefined();
    expect(screen.getByLabelText(/correo/i)).toBeDefined();
    expect(screen.getByLabelText(/fuente/i)).toBeDefined();
  });

  it("renders dynamic fields from form_config (FR-012)", () => {
    render(
      <CandidateForm
        clientId={CLIENT_ID}
        formConfig={{
          fields: [
            {
              key: "desired_salary",
              label: "Sueldo deseado",
              type: "number",
              required: true,
              min: 1,
            },
            {
              key: "shift",
              label: "Turno",
              type: "select",
              required: true,
              options: ["matutino", "vespertino"],
            },
          ],
        }}
        onValidSubmit={vi.fn()}
      />,
    );
    expect(screen.getByLabelText(/sueldo deseado/i)).toBeDefined();
    expect(screen.getByLabelText(/turno/i)).toBeDefined();
  });

  it("calls onValidSubmit with the form values when valid", async () => {
    const onValidSubmit = vi.fn();
    const user = userEvent.setup();

    render(
      <CandidateForm
        clientId={CLIENT_ID}
        formConfig={{ fields: [] }}
        onValidSubmit={onValidSubmit}
      />,
    );

    await user.type(screen.getByLabelText(/nombre/i), "Juan");
    await user.type(screen.getByLabelText(/apellidos/i), "Pérez");
    await user.type(screen.getByLabelText(/teléfono/i), "+52 55 1234 5678");
    await user.type(screen.getByLabelText(/correo/i), "juan@example.com");
    await user.type(screen.getByLabelText(/fuente/i), "LinkedIn");

    // Submit via the form id (botón vive en el padre).
    const form = document.getElementById("candidate-form") as HTMLFormElement;
    form.requestSubmit();

    await new Promise((r) => setTimeout(r, 0));
    expect(onValidSubmit).toHaveBeenCalledOnce();
    const call = onValidSubmit.mock.calls[0][0];
    expect(call.first_name).toBe("Juan");
    expect(call.email).toBe("juan@example.com");
    expect(call.client_id).toBe(CLIENT_ID);
  });

  it("does not submit when required fields are missing", async () => {
    const onValidSubmit = vi.fn();

    render(
      <CandidateForm
        clientId={CLIENT_ID}
        formConfig={{ fields: [] }}
        onValidSubmit={onValidSubmit}
      />,
    );

    const form = document.getElementById("candidate-form") as HTMLFormElement;
    form.requestSubmit();

    await new Promise((r) => setTimeout(r, 0));
    expect(onValidSubmit).not.toHaveBeenCalled();
  });
});
