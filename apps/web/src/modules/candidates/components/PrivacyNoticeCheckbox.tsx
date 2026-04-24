// 007-candidates-module — checkbox obligatorio del aviso LFPDPPP (FR-013 / R11).
import { Checkbox } from "@/components/ui/checkbox";
import { ScrollArea } from "@/components/ui/scroll-area";

interface PrivacyNoticeCheckboxProps {
  notice: { id: string; version: string; text_md: string } | null;
  loading?: boolean;
  checked: boolean;
  onCheckedChange: (checked: boolean) => void;
  error?: string;
}

export function PrivacyNoticeCheckbox({
  notice,
  loading,
  checked,
  onCheckedChange,
  error,
}: PrivacyNoticeCheckboxProps) {
  if (loading) {
    return (
      <div className="text-sm text-muted-foreground">
        Cargando aviso de privacidad…
      </div>
    );
  }

  if (!notice) {
    return (
      <div className="text-sm text-destructive">
        No hay un aviso de privacidad activo para este tenant. Contacta al admin.
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <div className="rounded-md border bg-muted/30 p-3">
        <ScrollArea className="h-32 pr-4">
          <p className="whitespace-pre-wrap text-sm leading-relaxed text-muted-foreground">
            {notice.text_md}
          </p>
        </ScrollArea>
      </div>
      <label className="flex items-start gap-3 cursor-pointer">
        <Checkbox
          checked={checked}
          onCheckedChange={(v) => onCheckedChange(Boolean(v))}
          aria-label="Aceptar aviso de privacidad"
          aria-invalid={Boolean(error)}
          aria-describedby={error ? "privacy-error" : undefined}
        />
        <span className="text-sm leading-snug">
          He leído y acepto el aviso de privacidad LFPDPPP (versión{" "}
          <span className="font-mono">{notice.version}</span>).
        </span>
      </label>
      {error ? (
        <p id="privacy-error" className="text-sm text-destructive">
          {error}
        </p>
      ) : null}
    </div>
  );
}
