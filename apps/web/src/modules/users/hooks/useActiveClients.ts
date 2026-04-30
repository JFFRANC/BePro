// 010-user-client-assignment / US1 — hook que alimenta el Select de "Cliente"
// en el modal de creación de usuario. Trae sólo los clientes activos del
// tenant. La query key es `["clients", "activeList"]` para que se pueda
// invalidar de forma quirúrgica desde el form cuando el server responde 400
// "cliente inactivo o inexistente" (FR-007 / Q5 del clarify).
//
// Consideraciones:
//  - Vive en `users/hooks/` (no en `clients/hooks/`) para mantener este
//    feature como puramente aditivo dentro del módulo users — la frontera
//    modular se respeta porque sólo se llama un servicio público de clients.
//  - `staleTime` 60s: los clientes no rotan tanto como para justificar refetch
//    en cada montaje, pero suficientemente corto para reflejar
//    activations/deactivations dentro de la misma sesión.
//  - `limit: 100` es el máximo aceptado por `listClientsQuerySchema`
//    (Assumption #4 cubre tenants típicos); si un tenant excede esto, el modal
//    mostrará los primeros 100 — el upgrade a typeahead/paginación está fuera
//    de scope de este feature.

import { useQuery } from "@tanstack/react-query";
import { listClients } from "@/modules/clients/services/clientService";
import type { IClientDto } from "@bepro/shared";

export const ACTIVE_CLIENTS_QUERY_KEY = ["clients", "activeList"] as const;

export function useActiveClients() {
  return useQuery<IClientDto[]>({
    queryKey: ACTIVE_CLIENTS_QUERY_KEY,
    queryFn: async () => {
      const res = await listClients({ isActive: true, limit: 100, page: 1 });
      return res.data;
    },
    staleTime: 60_000,
  });
}
