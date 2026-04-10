import { QueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

function handleMutationError(error: unknown) {
  const err = error as { status?: number; message?: string };
  const status = err?.status;

  if (status === 401) {
    toast.error("Sesión expirada, inicia sesión de nuevo");
    return;
  }
  if (status === 403) {
    toast.error("No tienes permisos para esta acción");
    return;
  }
  if (!navigator.onLine || !status) {
    toast.error("Verifica tu conexión a internet");
    return;
  }
  if (status >= 500) {
    toast.error("Error del servidor, intenta de nuevo");
    return;
  }
  toast.error(err?.message ?? "Algo salió mal");
}

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 3,
      retryDelay: (attempt) => Math.min(1000 * 2 ** attempt, 10000),
      staleTime: 30_000,
    },
    mutations: {
      retry: 1,
      onError: handleMutationError,
    },
  },
});
