// 012-client-detail-ux / US2 — copia la dirección al portapapeles.
// Whitespace-normaliza (\s+ → " ") y trimea antes de escribir. Toast con
// fallback en navegadores sin clipboard API (contextos no-secure / iframes).
import { Copy } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";

interface CopyAddressButtonProps {
  address?: string | null;
  className?: string;
}

function normalize(address: string): string {
  return address.replace(/\s+/g, " ").trim();
}

export function CopyAddressButton({ address, className }: CopyAddressButtonProps) {
  if (!address || address.trim().length === 0) {
    return null;
  }

  const handleCopy = async () => {
    const formatted = normalize(address);
    if (
      typeof navigator !== "undefined" &&
      navigator.clipboard?.writeText
    ) {
      try {
        await navigator.clipboard.writeText(formatted);
        toast.success("Ubicación copiada");
        return;
      } catch {
        // fallthrough to fallback toast
      }
    }
    // Fallback: el usuario selecciona y copia manualmente desde el toast.
    toast.message(`Copia manual: ${formatted}`, { duration: 8000 });
  };

  return (
    <Button
      type="button"
      variant="outline"
      size="sm"
      onClick={handleCopy}
      className={className}
    >
      <Copy className="h-4 w-4 mr-2" aria-hidden="true" />
      Copiar ubicación
    </Button>
  );
}
