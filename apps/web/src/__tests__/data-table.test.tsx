import { afterEach, describe, expect, it } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import type { ColumnDef } from "@tanstack/react-table";
import { DataTable } from "@/components/data-table";

// Tests para las props opcionales que extienden DataTable (T074 — feature 009):
//  - isLoading: render de filas skeleton
//  - error: render del slot de error (default o custom)
//  - emptyState: reemplaza "No hay resultados." default
//  - loadingSkeletonRows: controla el conteo de filas skeleton
//  - rowWrapper: default Fragment (FR-010 — preserva markup actual)
//
// Los callers existentes que no pasan ninguna de estas props deben seguir
// renderizando identico (regresion guard).

interface Row {
  id: string;
  name: string;
}

const columns: ColumnDef<Row>[] = [
  { accessorKey: "id", header: "ID" },
  { accessorKey: "name", header: "Nombre" },
];

const sampleData: Row[] = [
  { id: "1", name: "Alice" },
  { id: "2", name: "Bob" },
];

afterEach(() => {
  cleanup();
});

describe("DataTable — backwards compatibility", () => {
  it("sin props opcionales, renderiza las filas como siempre", () => {
    render(<DataTable columns={columns} data={sampleData} />);
    expect(screen.getByText("Alice")).toBeDefined();
    expect(screen.getByText("Bob")).toBeDefined();
  });

  it("sin datos y sin loading/error renderiza el fallback por defecto", () => {
    render(<DataTable columns={columns} data={[]} />);
    expect(screen.getByText("No hay resultados.")).toBeDefined();
  });
});

describe("DataTable — loading state", () => {
  it("isLoading=true con data vacia renderiza filas skeleton", () => {
    const { container } = render(
      <DataTable
        columns={columns}
        data={[]}
        isLoading
        loadingSkeletonRows={3}
      />,
    );
    const skeletons = container.querySelectorAll('[data-slot="skeleton"]');
    // 3 filas skeleton x 2 columnas = 6 celdas con skeleton.
    expect(skeletons.length).toBe(3 * columns.length);
    // Durante loading NO debe aparecer el fallback de empty state.
    expect(screen.queryByText("No hay resultados.")).toBeNull();
  });

  it("isLoading=true usa 5 filas skeleton por defecto", () => {
    const { container } = render(
      <DataTable columns={columns} data={[]} isLoading />,
    );
    const skeletons = container.querySelectorAll('[data-slot="skeleton"]');
    expect(skeletons.length).toBe(5 * columns.length);
  });
});

describe("DataTable — empty state", () => {
  it("custom emptyState reemplaza el mensaje default", () => {
    render(
      <DataTable
        columns={columns}
        data={[]}
        emptyState={<span>Todavia no hay candidatos</span>}
      />,
    );
    expect(screen.getByText("Todavia no hay candidatos")).toBeDefined();
    expect(screen.queryByText("No hay resultados.")).toBeNull();
  });
});

describe("DataTable — error state", () => {
  it("error truthy renderiza el slot de error default", () => {
    render(
      <DataTable columns={columns} data={[]} error={new Error("boom")} />,
    );
    // Default error slot tiene rol alert y un mensaje generico en es-MX.
    expect(screen.getByText(/No pudimos cargar los datos/i)).toBeDefined();
  });

  it("errorState custom tiene precedencia", () => {
    render(
      <DataTable
        columns={columns}
        data={[]}
        error={new Error("boom")}
        errorState={<span>Algo salio mal en esta tabla</span>}
      />,
    );
    expect(screen.getByText("Algo salio mal en esta tabla")).toBeDefined();
    expect(screen.queryByText(/No pudimos cargar los datos/i)).toBeNull();
  });

  it("error tiene precedencia sobre isLoading y emptyState", () => {
    render(
      <DataTable
        columns={columns}
        data={[]}
        isLoading
        error={new Error("boom")}
        emptyState={<span>Empty slot</span>}
      />,
    );
    expect(screen.getByText(/No pudimos cargar los datos/i)).toBeDefined();
    expect(screen.queryByText("Empty slot")).toBeNull();
  });
});

describe("DataTable — rowWrapper", () => {
  it("rowWrapper envuelve cada fila de datos", () => {
    const Wrapper = ({
      children,
      index,
    }: {
      children: React.ReactNode;
      index: number;
    }) => <tr data-testid={`wrapper-${index}`}>{children}</tr>;

    render(
      <DataTable columns={columns} data={sampleData} rowWrapper={Wrapper} />,
    );
    // Con 2 filas de datos debemos ver dos wrappers indexados 0 y 1.
    expect(screen.getByTestId("wrapper-0")).toBeDefined();
    expect(screen.getByTestId("wrapper-1")).toBeDefined();
  });
});
