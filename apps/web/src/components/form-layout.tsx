import { Children, cloneElement, isValidElement, type ReactNode } from "react";
import { AlertCircle, type LucideIcon } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { cn } from "@/lib/utils";

interface FormLayoutProps {
  title: string;
  description?: string;
  children: ReactNode;
  className?: string;
}

export function FormLayout({ title, description, children, className }: FormLayoutProps) {
  return (
    <Card className={className}>
      <CardHeader>
        <CardTitle className="font-heading">{title}</CardTitle>
        {description && <CardDescription>{description}</CardDescription>}
      </CardHeader>
      <CardContent className="space-y-6">{children}</CardContent>
    </Card>
  );
}

interface FormSectionProps {
  title: ReactNode;
  children: ReactNode;
}

export function FormSection({ title, children }: FormSectionProps) {
  return (
    <div className="space-y-4">
      <div className="space-y-1">
        <h4 className="text-sm font-medium text-muted-foreground">{title}</h4>
        <Separator />
      </div>
      {children}
    </div>
  );
}

interface FormFieldProps {
  label: string;
  error?: string;
  icon?: LucideIcon;
  children: ReactNode;
  htmlFor?: string;
  /** Feature 009 follow-up: marca el campo como obligatorio.
   *  - Muestra asterisco rojo en el label.
   *  - Inyecta aria-required="true" en el unico child (si es elemento).
   *  - Si hay error, inyecta aria-invalid="true" + aria-describedby al <p role="alert">. */
  required?: boolean;
  /** Opcional: muestra texto de ayuda persistente debajo del input. */
  hint?: string;
}

export function FormField({
  label,
  error,
  icon: Icon,
  children,
  htmlFor,
  required,
  hint,
}: FormFieldProps) {
  const errorId = error && htmlFor ? `${htmlFor}-error` : undefined;
  const hintId = hint && htmlFor ? `${htmlFor}-hint` : undefined;
  const describedBy =
    [errorId, hintId].filter(Boolean).join(" ") || undefined;

  // Inyecta aria-required / aria-invalid / aria-describedby en el child
  // (cuando es un elemento React solo).
  const arrayChildren = Children.toArray(children);
  const enhanced = arrayChildren.map((child, idx) => {
    if (!isValidElement(child)) return child;
    if (idx !== 0) return child;
    return cloneElement(child as React.ReactElement<Record<string, unknown>>, {
      "aria-required": required || undefined,
      "aria-invalid": error ? "true" : undefined,
      "aria-describedby": describedBy,
    });
  });

  return (
    <div className="space-y-2">
      <Label htmlFor={htmlFor} className="flex items-center gap-2">
        {Icon && <Icon className="h-4 w-4 text-muted-foreground" />}
        <span>
          {label}
          {required && (
            <span
              aria-hidden="true"
              className="ml-1 text-destructive"
            >
              *
            </span>
          )}
        </span>
      </Label>
      {enhanced}
      {hint && !error && (
        <p
          id={hintId}
          className="text-xs text-muted-foreground"
        >
          {hint}
        </p>
      )}
      {error && (
        <p
          id={errorId}
          role="alert"
          className={cn(
            "flex items-center gap-1.5 text-sm text-destructive",
            "animate-in fade-in-0 slide-in-from-top-1 duration-150",
          )}
        >
          <AlertCircle className="size-3.5 shrink-0" aria-hidden="true" />
          {error}
        </p>
      )}
    </div>
  );
}

interface FormRowProps {
  children: ReactNode;
}

export function FormRow({ children }: FormRowProps) {
  return <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">{children}</div>;
}
