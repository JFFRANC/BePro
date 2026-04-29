import * as React from "react"
import { ArrowUpDown, ArrowUp, ArrowDown } from "lucide-react"

import { cn } from "@/lib/utils"

// Table primitive modernizado (feature 009 follow-up).
// - Sticky header con backdrop-blur (no solo visual: sticky top-0 real).
// - Sortable TableHead via prop opcional `sortable` + `sortDirection`.
// - Row hover con barra lateral de 2px (estilo Linear / Attio).
// - data-density="compact|comfortable" en <Table> para alternar altura.

type Density = "compact" | "comfortable"

function Table({
  className,
  density = "comfortable",
  ...props
}: React.ComponentProps<"table"> & { density?: Density }) {
  return (
    <div
      data-slot="table-container"
      className="relative w-full overflow-x-auto rounded-xl border border-border bg-card shadow-sm"
    >
      <table
        data-slot="table"
        data-density={density}
        className={cn("w-full caption-bottom text-sm", className)}
        {...props}
      />
    </div>
  )
}

function TableHeader({ className, ...props }: React.ComponentProps<"thead">) {
  return (
    <thead
      data-slot="table-header"
      // Sticky real + backdrop-blur para que el header flote al hacer scroll.
      className={cn(
        "sticky top-0 z-10 bg-background/90 backdrop-blur-md",
        "[&_tr]:border-b [&_tr]:border-border",
        "[&_th]:text-muted-foreground [&_th]:uppercase [&_th]:tracking-wide [&_th]:text-[11px] [&_th]:font-semibold",
        className
      )}
      {...props}
    />
  )
}

function TableBody({ className, ...props }: React.ComponentProps<"tbody">) {
  return (
    <tbody
      data-slot="table-body"
      // Zebra con intensidad suficiente para leerse como ritmo (no artefacto).
      className={cn(
        "[&_tr:nth-child(even)]:bg-muted/30",
        "[&_tr:last-child]:border-0",
        className
      )}
      {...props}
    />
  )
}

function TableFooter({ className, ...props }: React.ComponentProps<"tfoot">) {
  return (
    <tfoot
      data-slot="table-footer"
      className={cn(
        "border-t bg-muted/50 font-medium [&>tr]:last:border-b-0",
        className
      )}
      {...props}
    />
  )
}

function TableRow({ className, ...props }: React.ComponentProps<"tr">) {
  return (
    <tr
      data-slot="table-row"
      // Hover con barra acento de 2px a la izquierda (signature Linear/Attio).
      // Implementada via box-shadow inset — no altera layout ni requiere
      // markup extra.
      className={cn(
        "relative border-b border-border/60 transition-[background-color,box-shadow] duration-150 ease-out",
        "hover:bg-accent/40 has-aria-expanded:bg-accent/40",
        "hover:shadow-[inset_2px_0_0_0_hsl(var(--primary))] focus-within:shadow-[inset_2px_0_0_0_hsl(var(--primary))]",
        "motion-reduce:transition-none",
        "data-[state=selected]:bg-accent data-[state=selected]:text-accent-foreground",
        // Densidad: padding vertical cambia via data-attr en el <table> ancestro.
        "[table[data-density=compact]_&_td]:py-2 [table[data-density=comfortable]_&_td]:py-3",
        className
      )}
      {...props}
    />
  )
}

interface TableHeadProps extends React.ComponentProps<"th"> {
  /** Marca la cabecera como sortable: muestra chevron y wire aria-sort. */
  sortable?: boolean
  /** Direccion activa del sort. "false" = no esta activa. */
  sortDirection?: "asc" | "desc" | false
  /** Callback de click/enter para toggle del sort. */
  onSort?: () => void
}

function TableHead({
  className,
  sortable = false,
  sortDirection = false,
  onSort,
  children,
  ...props
}: TableHeadProps) {
  const ariaSort: React.AriaAttributes["aria-sort"] = sortable
    ? sortDirection === "asc"
      ? "ascending"
      : sortDirection === "desc"
      ? "descending"
      : "none"
    : undefined

  if (!sortable) {
    return (
      <th
        data-slot="table-head"
        className={cn(
          "h-11 px-3 text-left align-middle font-medium whitespace-nowrap text-foreground [&:has([role=checkbox])]:pr-0",
          className
        )}
        {...props}
      >
        {children}
      </th>
    )
  }

  const SortIcon =
    sortDirection === "asc"
      ? ArrowUp
      : sortDirection === "desc"
      ? ArrowDown
      : ArrowUpDown

  return (
    <th
      data-slot="table-head"
      aria-sort={ariaSort}
      className={cn(
        "h-11 px-3 text-left align-middle font-medium whitespace-nowrap text-foreground [&:has([role=checkbox])]:pr-0",
        "group/th",
        className
      )}
      {...props}
    >
      <button
        type="button"
        onClick={onSort}
        className={cn(
          "-mx-2 inline-flex items-center gap-1.5 rounded-md px-2 py-1",
          "text-[11px] font-semibold uppercase tracking-wide text-muted-foreground",
          "transition-colors duration-150 ease-out",
          "hover:text-foreground hover:bg-accent/50",
          "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1 focus-visible:ring-offset-background",
          sortDirection && "text-foreground",
        )}
        data-slot="table-head-sort"
        data-active={sortDirection ? "true" : "false"}
      >
        {children}
        <SortIcon
          aria-hidden="true"
          className={cn(
            "size-3 transition-opacity duration-150",
            sortDirection
              ? "opacity-100"
              : "opacity-40 group-hover/th:opacity-80",
          )}
        />
      </button>
    </th>
  )
}

function TableCell({ className, ...props }: React.ComponentProps<"td">) {
  return (
    <td
      data-slot="table-cell"
      className={cn(
        "py-3 px-3 align-middle whitespace-nowrap [&:has([role=checkbox])]:pr-0",
        className
      )}
      {...props}
    />
  )
}

function TableCaption({
  className,
  ...props
}: React.ComponentProps<"caption">) {
  return (
    <caption
      data-slot="table-caption"
      className={cn("mt-4 text-sm text-muted-foreground", className)}
      {...props}
    />
  )
}

export {
  Table,
  TableHeader,
  TableBody,
  TableFooter,
  TableHead,
  TableRow,
  TableCell,
  TableCaption,
}
