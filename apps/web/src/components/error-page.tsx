import { useNavigate } from "react-router-dom";
import { ShieldAlert, SearchX, ServerCrash, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";

const errorConfig = {
  403: {
    icon: ShieldAlert,
    title: "Acceso denegado",
    description: "No tienes permisos para ver esta página",
    actionLabel: "Ir al Dashboard",
    colorClass: "text-destructive",
  },
  404: {
    icon: SearchX,
    title: "Página no encontrada",
    description: "La página que buscas no existe",
    actionLabel: "Ir al Dashboard",
    colorClass: "text-muted-foreground",
  },
  500: {
    icon: ServerCrash,
    title: "Error del servidor",
    description: "Algo salió mal, intenta de nuevo",
    actionLabel: "Reintentar",
    colorClass: "text-destructive",
  },
} as const;

interface ErrorPageProps {
  code: 403 | 404 | 500;
  title?: string;
  description?: string;
  onRetry?: () => void;
}

export function ErrorPage({ code, title, description, onRetry }: ErrorPageProps) {
  const navigate = useNavigate();
  const config = errorConfig[code];
  const Icon = config.icon;

  function handleAction() {
    if (code === 500 && onRetry) {
      onRetry();
    } else {
      navigate("/");
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-background p-4">
      <Card className="w-full max-w-md text-center">
        <CardContent className="flex flex-col items-center gap-4 pt-8 pb-8">
          <Icon className={`h-16 w-16 ${config.colorClass}`} />
          <h1 className="font-heading text-2xl font-bold">{title ?? config.title}</h1>
          <p className="text-muted-foreground">{description ?? config.description}</p>
          <Button onClick={handleAction} variant={code === 500 ? "default" : "outline"}>
            {code === 500 ? <RefreshCw className="mr-2 h-4 w-4" /> : null}
            {code === 500 ? (onRetry ? "Reintentar" : config.actionLabel) : config.actionLabel}
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
