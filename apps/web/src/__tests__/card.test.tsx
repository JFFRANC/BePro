import { afterEach, describe, expect, it } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { CardGrid } from "@/components/motion/CardGrid";

// Tests para la modernizacion del primitive Card (feature 009 follow-up).
// Cubre:
//   - Variants (default / outline / ghost / feature / accent)
//   - interactive prop (reemplaza al attr data-interactive)
//   - accentColor opt-in para la variante accent
//   - CardGrid stagger (40ms por item, cap en 10)
//   - Backwards compatibility: <Card /> sin props sigue renderizando igual

afterEach(() => {
  cleanup();
});

describe("Card — backwards compatibility", () => {
  it("renderiza un nodo con data-slot=card cuando no se pasan props", () => {
    const { container } = render(<Card>contenido</Card>);
    const el = container.querySelector('[data-slot="card"]');
    expect(el).not.toBeNull();
  });

  it("default variant mantiene border + shadow-sm (regresion guard)", () => {
    const { container } = render(<Card data-testid="default">hi</Card>);
    const el = container.querySelector('[data-slot="card"]');
    const cls = el?.className ?? "";
    expect(cls).toMatch(/\bborder\b/);
    expect(cls).toContain("shadow-sm");
  });

  it("data-interactive continua siendo legible cuando se setea por atributo (compat)", () => {
    const { container } = render(
      <Card data-interactive="true">contenido</Card>,
    );
    const el = container.querySelector('[data-slot="card"]') as HTMLElement;
    expect(el.dataset.interactive).toBe("true");
  });
});

describe("Card — variants", () => {
  it("variant outline usa borde fuerte sin shadow", () => {
    const { container } = render(<Card variant="outline">x</Card>);
    const cls =
      container.querySelector('[data-slot="card"]')?.className ?? "";
    expect(cls).toContain("shadow-none");
    expect(cls).toContain("border-2");
  });

  it("variant ghost no tiene border y usa bg-muted/40", () => {
    const { container } = render(<Card variant="ghost">x</Card>);
    const cls =
      container.querySelector('[data-slot="card"]')?.className ?? "";
    expect(cls).toContain("border-transparent");
    expect(cls).toContain("bg-muted/40");
  });

  it("variant feature agrega la clase group/card-feature y el sheen backdrop", () => {
    const { container } = render(<Card variant="feature">x</Card>);
    const cls =
      container.querySelector('[data-slot="card"]')?.className ?? "";
    expect(cls).toContain("group/card-feature");
    // El sheen se implementa con before: o after: utility que apunta a --mx / --my.
    expect(cls).toMatch(/before:|after:/);
  });

  it("variant accent aplica el accentColor pasado por prop", () => {
    const { container } = render(
      <Card variant="accent" accentColor="border-t-success">
        x
      </Card>,
    );
    const cls =
      container.querySelector('[data-slot="card"]')?.className ?? "";
    expect(cls).toContain("border-t-[3px]");
    expect(cls).toContain("border-t-success");
  });

  it("variant accent sin accentColor cae a border-t-primary como fallback", () => {
    const { container } = render(<Card variant="accent">x</Card>);
    const cls =
      container.querySelector('[data-slot="card"]')?.className ?? "";
    expect(cls).toContain("border-t-[3px]");
    expect(cls).toContain("border-t-primary");
  });
});

describe("Card — interactive prop", () => {
  it("interactive=true setea data-interactive, cursor-pointer y tabIndex 0", () => {
    const { container } = render(<Card interactive>contenido</Card>);
    const el = container.querySelector('[data-slot="card"]') as HTMLElement;
    expect(el.dataset.interactive).toBe("true");
    expect(el.className).toContain("cursor-pointer");
    expect(el.tabIndex).toBe(0);
  });

  it("sin interactive, tabIndex no se setea explicitamente y no hay cursor-pointer", () => {
    const { container } = render(<Card>contenido</Card>);
    const el = container.querySelector('[data-slot="card"]') as HTMLElement;
    // tabIndex por defecto en <div> es -1 cuando se accede via DOM.
    expect(el.tabIndex).toBe(-1);
    expect(el.className).not.toContain("cursor-pointer");
  });

  it("interactive activa el lift en hover via data-selector (clase presente)", () => {
    const { container } = render(<Card interactive>x</Card>);
    const cls =
      container.querySelector('[data-slot="card"]')?.className ?? "";
    // El selector actual usa data-[interactive=true]:hover:-translate-y-0.5
    expect(cls).toContain("data-[interactive=true]:hover:-translate-y-0.5");
  });
});

describe("Card — slots se renderizan correctamente", () => {
  it("CardHeader / CardTitle / CardDescription / CardContent / CardFooter", () => {
    render(
      <Card>
        <CardHeader>
          <CardTitle>titulo</CardTitle>
          <CardDescription>descripcion</CardDescription>
        </CardHeader>
        <CardContent>contenido</CardContent>
        <CardFooter>pie</CardFooter>
      </Card>,
    );
    expect(screen.getByText("titulo")).toBeDefined();
    expect(screen.getByText("descripcion")).toBeDefined();
    expect(screen.getByText("contenido")).toBeDefined();
    expect(screen.getByText("pie")).toBeDefined();
  });
});

describe("CardGrid — stagger entrance", () => {
  it("envuelve cada hijo y aplica animation-delay escalonado en los primeros 10", () => {
    const items = Array.from({ length: 5 }).map((_, i) => (
      <Card key={i} data-testid={`card-${i}`}>
        item {i}
      </Card>
    ));

    const { container } = render(<CardGrid>{items}</CardGrid>);

    // CardGrid envuelve cada child en un <div> con clases de motion + animationDelay inline.
    const wrappers = container.querySelectorAll<HTMLElement>(
      '[data-slot="card-grid-item"]',
    );
    expect(wrappers.length).toBe(5);
    for (let i = 0; i < 5; i++) {
      expect(wrappers[i].style.animationDelay).toBe(`${i * 40}ms`);
    }
  });

  it("cap en 10: el item 11+ recibe delay constante de 400ms", () => {
    const items = Array.from({ length: 12 }).map((_, i) => (
      <Card key={i}>item {i}</Card>
    ));

    const { container } = render(<CardGrid>{items}</CardGrid>);
    const wrappers = container.querySelectorAll<HTMLElement>(
      '[data-slot="card-grid-item"]',
    );
    expect(wrappers.length).toBe(12);
    expect(wrappers[9].style.animationDelay).toBe("360ms");
    expect(wrappers[10].style.animationDelay).toBe("400ms");
    expect(wrappers[11].style.animationDelay).toBe("400ms");
  });

  it("acepta className para el contenedor grid", () => {
    const { container } = render(
      <CardGrid className="grid grid-cols-4 gap-4">
        <Card>a</Card>
      </CardGrid>,
    );
    const grid = container.querySelector('[data-slot="card-grid"]');
    expect(grid?.className).toContain("grid-cols-4");
    expect(grid?.className).toContain("gap-4");
  });

  it("las clases de entrada incluyen animate-in + motion-reduce", () => {
    const { container } = render(
      <CardGrid>
        <Card>a</Card>
      </CardGrid>,
    );
    const wrapper = container.querySelector(
      '[data-slot="card-grid-item"]',
    );
    const cls = wrapper?.className ?? "";
    expect(cls).toContain("animate-in");
    expect(cls).toContain("motion-reduce:animate-none");
  });
});
