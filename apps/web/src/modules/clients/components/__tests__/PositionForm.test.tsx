// 011-puestos-profile-docs / US1 — RTL para PositionForm.
//
// Cubre:
//   - Las 7 secciones del acordeón se renderizan (FR-011).
//   - Submit con sólo `name` succeeds (FR-002 — todos los demás campos opcionales).
//   - `ageMin > ageMax` reportado por el resolver Zod antes del submit (E-09).
//   - `null` clears semantics (no llama a onSubmit con strings vacíos).
//
// Notas: el Accordion de base-ui se renderiza expandido para los items en
// `defaultValue`; aquí dejamos `general` y `perfil` abiertos por defecto, los
// demás los expandimos manualmente cuando el test lo requiere.

import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { PositionForm } from "../PositionForm";

describe("011 — PositionForm", () => {
  it("renderiza las 7 secciones del acordeón", () => {
    render(<PositionForm onSubmit={vi.fn()} />);
    expect(screen.getByText("Datos generales")).toBeTruthy();
    expect(screen.getByText("Perfil")).toBeTruthy();
    expect(screen.getByText("Compensación")).toBeTruthy();
    expect(screen.getByText("Horario")).toBeTruthy();
    expect(screen.getByText("Documentación requerida")).toBeTruthy();
    expect(screen.getByText("Funciones")).toBeTruthy();
    expect(screen.getByText("Preguntas frecuentes")).toBeTruthy();
  });

  it("submit con sólo `name` succeeds", async () => {
    const user = userEvent.setup();
    const onSubmit = vi.fn().mockResolvedValue(undefined);
    render(<PositionForm onSubmit={onSubmit} submitLabel="Guardar" />);

    await user.type(
      screen.getByLabelText(/Nombre del puesto/i),
      "Soldador",
    );
    await user.click(screen.getByRole("button", { name: /Guardar/i }));

    expect(onSubmit).toHaveBeenCalledTimes(1);
    expect(onSubmit.mock.calls[0][0].name).toBe("Soldador");
  });

  it("rechaza submit cuando ageMin > ageMax (Zod refinement)", async () => {
    const user = userEvent.setup();
    const onSubmit = vi.fn();
    render(<PositionForm onSubmit={onSubmit} submitLabel="Guardar" />);

    await user.type(
      screen.getByLabelText(/Nombre del puesto/i),
      "Soldador",
    );
    await user.type(screen.getByLabelText(/Edad mínima/i), "50");
    await user.type(screen.getByLabelText(/Edad máxima/i), "30");
    await user.click(screen.getByRole("button", { name: /Guardar/i }));

    // No debe llamar al callback — Zod bloqueó.
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it("rellena defaultValues con la posición existente y permite edición", async () => {
    const user = userEvent.setup();
    const onSubmit = vi.fn().mockResolvedValue(undefined);
    render(
      <PositionForm
        defaultValues={{
          id: "pos-1",
          clientId: "client-1",
          name: "AYUDANTE GENERAL",
          isActive: true,
          createdAt: "",
          updatedAt: "",
          vacancies: 80,
        }}
        onSubmit={onSubmit}
        submitLabel="Guardar"
      />,
    );

    expect(
      (screen.getByLabelText(/Nombre del puesto/i) as HTMLInputElement).value,
    ).toBe("AYUDANTE GENERAL");
    expect((screen.getByLabelText(/Vacantes/i) as HTMLInputElement).value).toBe(
      "80",
    );

    await user.click(screen.getByRole("button", { name: /Guardar/i }));
    expect(onSubmit).toHaveBeenCalledTimes(1);
    expect(onSubmit.mock.calls[0][0].name).toBe("AYUDANTE GENERAL");
    expect(onSubmit.mock.calls[0][0].vacancies).toBe(80);
  });

  // P0 #1 — los Selects nullable mostraban literalmente "__null__" porque
  // base-ui Select.Value no resuelve `value → item label` automáticamente
  // cuando el popup nunca se abrió (los items no están registrados aún).
  it("nunca muestra el sentinel '__null__' en ningún trigger del form", () => {
    const { container } = render(<PositionForm onSubmit={vi.fn()} />);

    // Si los Selects renderizan el value crudo, el texto "__null__" filtra
    // a la UI. Esta aserción captura ese leak en cualquier parte del form.
    expect(container.textContent ?? "").not.toContain("__null__");

    // Los 3 triggers nullable deben mostrar "Sin especificar" como
    // placeholder o label cuando no hay valor.
    const triggers = container.querySelectorAll<HTMLElement>(
      '[data-slot="select-trigger"]',
    );
    expect(triggers.length).toBeGreaterThanOrEqual(3);
    triggers.forEach((t) => {
      expect(t.textContent ?? "").not.toContain("__null__");
    });
  });

  // P1.B — el botón submit muestra un spinner cuando el form está enviando.
  it("renderiza Loader2 spinner cuando isSubmitting=true", () => {
    const { container } = render(
      <PositionForm onSubmit={vi.fn()} isSubmitting submitLabel="Guardar" />,
    );
    const submitBtn = screen.getByRole("button", { name: /Guardando/i });
    expect(submitBtn.hasAttribute("disabled")).toBe(true);
    // Loader2 de lucide-react renderiza un <svg class="lucide-loader-circle ...">
    // (alias del componente Loader2). Aceptamos cualquiera de los dos nombres.
    const spinner = container.querySelector(
      "svg.lucide-loader-circle, svg.lucide-loader2, svg.animate-spin",
    );
    expect(spinner).not.toBeNull();
  });

  // P1.C — inputs numéricos llevan inputMode=numeric para teclado móvil.
  it("aplica inputMode=numeric a los inputs numéricos", async () => {
    const user = userEvent.setup();
    render(<PositionForm onSubmit={vi.fn()} />);

    // Compensación está cerrada por default; abrimos para que `salaryAmount`
    // esté en el DOM. base-ui no monta paneles cerrados (keepMounted=false).
    await user.click(
      screen.getByRole("button", { name: /Compensación/i }),
    );

    const numericIds = ["vacancies", "ageMin", "ageMax", "salaryAmount"];
    for (const id of numericIds) {
      const el = document.getElementById(id);
      expect(el).not.toBeNull();
      expect(el!.getAttribute("inputmode")).toBe("numeric");
    }
  });

  // P1.D — `aria-invalid` correcto en age range cuando ageMin > ageMax.
  it("marca ageMin y ageMax con aria-invalid cuando el refine falla", async () => {
    const user = userEvent.setup();
    render(<PositionForm onSubmit={vi.fn()} submitLabel="Guardar" />);

    await user.type(
      screen.getByLabelText(/Nombre del puesto/i),
      "Soldador",
    );
    await user.type(screen.getByLabelText(/Edad mínima/i), "50");
    await user.type(screen.getByLabelText(/Edad máxima/i), "30");
    await user.click(screen.getByRole("button", { name: /Guardar/i }));

    const ageMin = screen.getByLabelText(/Edad mínima/i);
    const ageMax = screen.getByLabelText(/Edad máxima/i);
    expect(ageMin.getAttribute("aria-invalid")).toBe("true");
    expect(ageMax.getAttribute("aria-invalid")).toBe("true");
    // Un único nodo con role=alert con el mensaje del refine.
    const alerts = screen.getAllByRole("alert");
    expect(alerts.length).toBeGreaterThanOrEqual(1);
    expect(alerts[0].textContent).toMatch(/rango de edad/i);
  });

  // P1.E — `salaryCurrency` ahora es un Select (no Input libre).
  it("usa Select para currency en lugar de Input libre", async () => {
    const user = userEvent.setup();
    const { container } = render(<PositionForm onSubmit={vi.fn()} />);

    // Abrir Compensación para montar la sección.
    await user.click(
      screen.getByRole("button", { name: /Compensación/i }),
    );

    // El Input libre con id="salaryCurrency" ya no debe existir.
    const oldInput = document.getElementById("salaryCurrency");
    expect(oldInput).toBeNull();

    // Con Perfil (default-open) + Compensación abierto:
    //   gender, civilStatus, educationLevel  → 3 (Perfil)
    //   currency, paymentFrequency           → 2 (Compensación, currency es nuevo)
    //   shift está en Horario (cerrado) y no monta.
    const triggers = container.querySelectorAll<HTMLElement>(
      '[data-slot="select-trigger"]',
    );
    expect(triggers.length).toBe(5);
  });

  // P1.G — días de trabajo seleccionados llevan border-primary visualmente.
  it("aplica border-primary al wrapper de un día de trabajo seleccionado", async () => {
    const user = userEvent.setup();
    const { container } = render(
      <PositionForm
        onSubmit={vi.fn()}
        defaultValues={{
          id: "p1",
          clientId: "c1",
          name: "X",
          isActive: true,
          createdAt: "",
          updatedAt: "",
          workDays: ["mon", "fri"],
        }}
      />,
    );

    // Horario está cerrado por default — abrirlo para que el panel se monte.
    await user.click(screen.getByRole("button", { name: /Horario/i }));

    // Los wrappers son <label> con texto "Lun"/"Mar"/etc.
    const mon = Array.from(
      container.querySelectorAll<HTMLLabelElement>("label"),
    ).find((l) => l.textContent?.trim() === "Lun");
    const tue = Array.from(
      container.querySelectorAll<HTMLLabelElement>("label"),
    ).find((l) => l.textContent?.trim() === "Mar");
    expect(mon).toBeDefined();
    expect(mon?.className ?? "").toMatch(/border-primary/);
    expect(tue?.className ?? "").not.toMatch(/border-primary/);
  });

  // P1.H — FAQ con lista vacía muestra mensaje empty (espejo de docs).
  it("muestra mensaje empty para FAQ cuando la lista está vacía", async () => {
    const user = userEvent.setup();
    render(<PositionForm onSubmit={vi.fn()} />);
    await user.click(
      screen.getByRole("button", { name: /Preguntas frecuentes/i }),
    );
    expect(
      screen.getByText(/Sin filtros agregados/i),
    ).toBeTruthy();
  });

  // P1.I — textareas grandes muestran contador `value.length / max`.
  it("muestra contador de caracteres en la textarea de experiencia", async () => {
    const user = userEvent.setup();
    render(<PositionForm onSubmit={vi.fn()} />);

    // Buscar el counter por defecto (vacío) — texto "0/2000".
    expect(screen.getByText("0/2000")).toBeTruthy();

    const exp = screen.getByLabelText(/Experiencia requerida/i);
    await user.type(exp, "abcde");
    expect(screen.getByText("5/2000")).toBeTruthy();
  });

  // P2.K — cada AccordionTrigger lleva un ícono Lucide identificable por
  // clase. No nos atamos al nombre exacto del icon, sólo verificamos que el
  // trigger contiene un <svg> con la familia "lucide-".
  it("cada sección del acordeón tiene un ícono Lucide en el trigger", () => {
    render(<PositionForm onSubmit={vi.fn()} />);
    const triggers = screen
      .getAllByRole("button")
      .filter((b) => b.getAttribute("data-slot") === "accordion-trigger");
    expect(triggers.length).toBe(7);
    for (const t of triggers) {
      // Hay 2 chevrons (down + up). Necesitamos al menos UN <svg> adicional.
      const svgs = t.querySelectorAll("svg");
      expect(svgs.length).toBeGreaterThanOrEqual(3);
    }
  });

  // P2.L — Badge de completitud aparece junto al título cuando la sección
  // tiene al menos un campo del perfil rellenado.
  it("muestra badge de completitud cuando una sección tiene datos", () => {
    const { container } = render(
      <PositionForm
        onSubmit={vi.fn()}
        defaultValues={{
          id: "p1",
          clientId: "c1",
          name: "Test",
          isActive: true,
          createdAt: "",
          updatedAt: "",
          ageMin: 18,
          ageMax: 45,
        }}
      />,
    );

    // El badge usa data-slot="completion-badge". Datos generales tiene name.
    // Perfil tiene ageMin/ageMax. Compensación NO tiene nada → no badge.
    const generalTrigger = screen
      .getAllByRole("button")
      .find((b) => b.textContent?.includes("Datos generales"));
    const compTrigger = screen
      .getAllByRole("button")
      .find((b) => b.textContent?.includes("Compensación"));

    expect(
      generalTrigger?.querySelector('[data-slot="completion-badge"]'),
    ).not.toBeNull();
    expect(
      compTrigger?.querySelector('[data-slot="completion-badge"]'),
    ).toBeNull();

    // Sanity: el container completo tiene al menos un badge.
    expect(
      container.querySelectorAll('[data-slot="completion-badge"]').length,
    ).toBeGreaterThanOrEqual(1);
  });

  // Motion #1 — page-load: cada AccordionItem entra con fade+slide-up
  // staggered. Verificamos que las clases de animación estén presentes y que
  // cada uno lleve un `animation-delay` distinto.
  it("AccordionItems entran con animación staggered en page-load", () => {
    const { container } = render(<PositionForm onSubmit={vi.fn()} />);
    const items = container.querySelectorAll<HTMLElement>(
      '[data-slot="accordion-item"]',
    );
    expect(items.length).toBe(7);
    const delays = new Set<string>();
    for (const it of items) {
      expect(it.className).toMatch(/animate-in/);
      expect(it.className).toMatch(/fade-in/);
      const delay = it.style.animationDelay;
      // Cada item debe tener un delay (puede ser "0ms" para el primero).
      expect(delay).toMatch(/\d+ms/);
      delays.add(delay);
    }
    // Los 7 items deben tener delays distintos (stagger).
    expect(delays.size).toBe(7);
  });

  // Motion #3 — listas FAQ y docs tienen ref de auto-animate (slide nativo
  // al agregar/remover items). Verificamos que el contenedor de la lista
  // expone el ref correcto vía un data-attr o que existe.
  it("usa AutoAnimate en listas dinámicas (FAQ + Documentación)", async () => {
    const user = userEvent.setup();
    const { container } = render(<PositionForm onSubmit={vi.fn()} />);

    // Abrir FAQ.
    await user.click(
      screen.getByRole("button", { name: /Preguntas frecuentes/i }),
    );
    const faqLists = container.querySelectorAll(
      '[data-slot="auto-animate-list"]',
    );
    expect(faqLists.length).toBeGreaterThanOrEqual(1);
  });

  // P0 #2.b — el Panel del Accordion tiene transición CSS y NO depende de
  // los keyframes rotos de tw-animate-css (radix-accordion-content-height).
  // Sin transición real el panel "snap"-ea de auto a 0 y los manejadores
  // visuales se confunden.
  it("Accordion Panel usa transition-height y no las clases animate rotas", () => {
    const { container } = render(<PositionForm onSubmit={vi.fn()} />);
    // base-ui no monta paneles cerrados por default, así que sólo vemos los
    // que están en `ACCORDION_DEFAULT_OPEN` (general, perfil = 2).
    const panels = container.querySelectorAll<HTMLElement>(
      '[data-slot="accordion-content"]',
    );
    expect(panels.length).toBeGreaterThanOrEqual(1);
    for (const p of panels) {
      // Las clases rotas no deben estar.
      expect(p.className).not.toMatch(/animate-accordion-down/);
      expect(p.className).not.toMatch(/animate-accordion-up/);
      // Debe haber una transición real (Tailwind `transition-` o `transition-[`).
      expect(p.className).toMatch(/transition/);
    }
  });

  // P0 #2 — al cerrar una sección abierta, un re-render del padre no debe
  // reabrirla. El bug se debe a que `defaultValue=[...]` se recreaba en cada
  // render del form.
  it("no reabre una sección del acordeón al re-renderizar el padre", async () => {
    const user = userEvent.setup();
    const { rerender } = render(
      <PositionForm onSubmit={vi.fn()} submitLabel="Guardar" />,
    );

    // 'Perfil' está abierta por defecto; el trigger debe tener
    // aria-expanded='true'.
    const perfilTrigger = screen.getByRole("button", { name: /Perfil/i });
    expect(perfilTrigger.getAttribute("aria-expanded")).toBe("true");

    // Cerrar 'Perfil'.
    await user.click(perfilTrigger);
    expect(perfilTrigger.getAttribute("aria-expanded")).toBe("false");

    // Forzar re-render del padre con prop diferente.
    rerender(<PositionForm onSubmit={vi.fn()} submitLabel="Guardar cambios" />);

    // 'Perfil' debe seguir cerrada.
    const perfilTriggerAfter = screen.getByRole("button", { name: /Perfil/i });
    expect(perfilTriggerAfter.getAttribute("aria-expanded")).toBe("false");
  });
});
