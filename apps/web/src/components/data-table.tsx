import {
  Fragment,
  useState,
  type ComponentType,
  type ReactNode,
} from "react";
import {
  type ColumnDef,
  type Column,
  type SortingState,
  flexRender,
  getCoreRowModel,
  getSortedRowModel,
  getPaginationRowModel,
  useReactTable,
} from "@tanstack/react-table";
import { ArrowUpDown, ArrowUp, ArrowDown } from "lucide-react";
import {
  Table,
  TableHeader,
  TableRow,
  TableHead,
  TableBody,
  TableCell,
} from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

export interface DataTableRowWrapperProps {
  children: ReactNode;
  index: number;
}

interface DataTableProps<TData, TValue> {
  columns: ColumnDef<TData, TValue>[];
  data: TData[];
  pageSize?: number;
  /** Feature 009 — estados opcionales (backwards compatible, FR-010). */
  isLoading?: boolean;
  error?: unknown;
  emptyState?: ReactNode;
  errorState?: ReactNode;
  loadingSkeletonRows?: number;
  /** Permite envolver cada fila de datos para orquestar motion/entrance. */
  rowWrapper?: ComponentType<DataTableRowWrapperProps>;
}

const DEFAULT_SKELETON_ROWS = 5;

function DefaultEmptyCell({ colSpan }: { colSpan: number }) {
  return (
    <TableRow>
      <TableCell
        colSpan={colSpan}
        className="h-24 text-center text-muted-foreground"
      >
        No hay resultados.
      </TableCell>
    </TableRow>
  );
}

function DefaultErrorCell({ colSpan }: { colSpan: number }) {
  return (
    <TableRow>
      <TableCell
        colSpan={colSpan}
        role="alert"
        className="h-24 text-center text-destructive"
      >
        No pudimos cargar los datos. Intenta de nuevo en unos segundos.
      </TableCell>
    </TableRow>
  );
}

function SkeletonRows({
  rows,
  colSpan,
}: {
  rows: number;
  colSpan: number;
}) {
  return (
    <>
      {Array.from({ length: rows }).map((_, rowIdx) => (
        <TableRow key={`skeleton-${rowIdx}`}>
          {Array.from({ length: colSpan }).map((_, colIdx) => (
            <TableCell key={`skeleton-${rowIdx}-${colIdx}`}>
              <Skeleton className="h-4 w-full" />
            </TableCell>
          ))}
        </TableRow>
      ))}
    </>
  );
}

export function DataTable<TData, TValue>({
  columns,
  data,
  pageSize = 10,
  isLoading = false,
  error,
  emptyState,
  errorState,
  loadingSkeletonRows = DEFAULT_SKELETON_ROWS,
  rowWrapper,
}: DataTableProps<TData, TValue>) {
  const [sorting, setSorting] = useState<SortingState>([]);

  const table = useReactTable({
    data,
    columns,
    state: { sorting },
    onSortingChange: setSorting,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    initialState: {
      pagination: { pageSize },
    },
  });

  // Feature 009: stagger de filas en mount. Primeras 10 filas en cascada (40ms
  // cada una); a partir de la 11 sin delay (aparicion simultanea al final del
  // stagger). motion-reduce:animate-none cancela todo.
  const rows = table.getRowModel().rows;

  // Precedencia de estados: error > loading (sin data) > empty > data.
  const showError = Boolean(error);
  const showLoading = !showError && isLoading && rows.length === 0;
  const showEmpty = !showError && !showLoading && rows.length === 0;

  const RowWrapper = rowWrapper ?? null;

  return (
    <div>
      {/* Table ya trae rounded-xl border shadow-sm desde components/ui/table.tsx */}
      <Table>
        <TableHeader>
          {table.getHeaderGroups().map((headerGroup) => (
            <TableRow key={headerGroup.id}>
              {headerGroup.headers.map((header) => (
                <TableHead key={header.id}>
                  {header.isPlaceholder
                    ? null
                    : flexRender(
                        header.column.columnDef.header,
                        header.getContext(),
                      )}
                </TableHead>
              ))}
            </TableRow>
          ))}
        </TableHeader>
        <TableBody>
          {showError ? (
            errorState !== undefined ? (
              <TableRow>
                <TableCell colSpan={columns.length}>{errorState}</TableCell>
              </TableRow>
            ) : (
              <DefaultErrorCell colSpan={columns.length} />
            )
          ) : showLoading ? (
            <SkeletonRows
              rows={loadingSkeletonRows}
              colSpan={columns.length}
            />
          ) : showEmpty ? (
            emptyState !== undefined ? (
              <TableRow>
                <TableCell
                  colSpan={columns.length}
                  className="h-24 text-center text-muted-foreground"
                >
                  {emptyState}
                </TableCell>
              </TableRow>
            ) : (
              <DefaultEmptyCell colSpan={columns.length} />
            )
          ) : (
            rows.map((row, index) => {
              const delayMs = index < 10 ? index * 40 : 400;
              const cells = row.getVisibleCells().map((cell) => (
                <TableCell key={cell.id}>
                  {flexRender(
                    cell.column.columnDef.cell,
                    cell.getContext(),
                  )}
                </TableCell>
              ));

              if (RowWrapper) {
                return (
                  <RowWrapper key={row.id} index={index}>
                    {cells}
                  </RowWrapper>
                );
              }

              return (
                <TableRow
                  key={row.id}
                  className="animate-in fade-in-0 slide-in-from-top-1 duration-[180ms] ease-out motion-reduce:animate-none motion-reduce:slide-in-from-top-0"
                  style={{
                    animationDelay: `${delayMs}ms`,
                    animationFillMode: "both",
                  }}
                >
                  {cells}
                </TableRow>
              );
            })
          )}
        </TableBody>
      </Table>

      <div className="mt-4 flex items-center justify-between gap-3 px-1">
        <p className="text-sm text-muted-foreground tabular-nums">
          {table.getFilteredRowModel().rows.length} registros
        </p>
        <div className="flex items-center gap-3">
          <p className="text-sm text-muted-foreground tabular-nums">
            Pagina {table.getState().pagination.pageIndex + 1} de{" "}
            {table.getPageCount() || 1}
          </p>
          <Button
            variant="outline"
            size="sm"
            onClick={() => table.previousPage()}
            disabled={!table.getCanPreviousPage()}
          >
            Anterior
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => table.nextPage()}
            disabled={!table.getCanNextPage()}
          >
            Siguiente
          </Button>
        </div>
      </div>
    </div>
  );
}

interface DataTableColumnHeaderProps<TData, TValue> {
  column: Column<TData, TValue>;
  title: string;
  className?: string;
}

export function DataTableColumnHeader<TData, TValue>({
  column,
  title,
  className,
}: DataTableColumnHeaderProps<TData, TValue>) {
  if (!column.getCanSort()) {
    return <span className={className}>{title}</span>;
  }

  const sorted = column.getIsSorted();

  return (
    <Button
      variant="ghost"
      size="sm"
      className={cn("-ml-3", className)}
      onClick={() => column.toggleSorting(sorted === "asc")}
    >
      {title}
      {sorted === "asc" ? (
        <ArrowUp className="ml-1 size-3.5" />
      ) : sorted === "desc" ? (
        <ArrowDown className="ml-1 size-3.5" />
      ) : (
        <ArrowUpDown className="ml-1 size-3.5" />
      )}
    </Button>
  );
}

// Re-export for callers who want the "no wrapping" explicit signal.
export { Fragment as DataTableRowFragment };
