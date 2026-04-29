import { afterEach, describe, expect, it } from "vitest";
import { axe } from "vitest-axe";

// Auditoria a11y automatizada (SC-004). Usa vitest-axe contra fragmentos
// construidos via DOM API (sin innerHTML) con los tokens de la refresh.
//
// Los tests de pagina completa (Login, Dashboard, CandidatesList) se anaden
// en T101 cuando los providers (router, query client, ability) esten listos
// para montar en jsdom.

let container: HTMLDivElement | null = null;

afterEach(() => {
  if (container && container.parentNode) {
    container.parentNode.removeChild(container);
  }
  container = null;
});

function mount(): HTMLDivElement {
  container = document.createElement("div");
  document.body.appendChild(container);
  return container;
}

describe("a11y.audit — token-driven primitives", () => {
  it("a button with text meets axe rules", async () => {
    const root = mount();
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "bg-primary text-primary-foreground rounded-md px-4 py-2";
    btn.textContent = "Guardar cambios";
    root.appendChild(btn);

    // Desactivamos la regla color-contrast en axe: jsdom no computa estilos CSS,
    // asi que axe no puede medirla. El contraste real se audita de forma exhaustiva
    // en src/__tests__/contrast.audit.test.ts con los valores de los tokens.
    const results = await axe(root, {
      rules: { "color-contrast": { enabled: false } },
    });
    expect(results).toHaveNoViolations();
  });

  it("a labeled form input meets axe rules", async () => {
    const root = mount();
    const label = document.createElement("label");
    label.htmlFor = "email";
    label.className = "text-body";
    label.textContent = "Correo electronico";
    const input = document.createElement("input");
    input.id = "email";
    input.type = "email";
    input.name = "email";
    input.className = "border-input rounded-md px-3 py-2";
    root.appendChild(label);
    root.appendChild(input);

    // Desactivamos la regla color-contrast en axe: jsdom no computa estilos CSS,
    // asi que axe no puede medirla. El contraste real se audita de forma exhaustiva
    // en src/__tests__/contrast.audit.test.ts con los valores de los tokens.
    const results = await axe(root, {
      rules: { "color-contrast": { enabled: false } },
    });
    expect(results).toHaveNoViolations();
  });

  it("a heading hierarchy without skipped levels meets axe rules", async () => {
    const root = mount();
    const h1 = document.createElement("h1");
    h1.textContent = "Candidatos";
    const h2 = document.createElement("h2");
    h2.textContent = "Registros recientes";
    root.appendChild(h1);
    root.appendChild(h2);

    // Desactivamos la regla color-contrast en axe: jsdom no computa estilos CSS,
    // asi que axe no puede medirla. El contraste real se audita de forma exhaustiva
    // en src/__tests__/contrast.audit.test.ts con los valores de los tokens.
    const results = await axe(root, {
      rules: { "color-contrast": { enabled: false } },
    });
    expect(results).toHaveNoViolations();
  });
});
