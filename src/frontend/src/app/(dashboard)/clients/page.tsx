"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Plus, Building2, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Skeleton } from "@/components/ui/skeleton";
import { useClients, useCreateClient } from "@/hooks/useClients";
import { useAuthStore } from "@/store/authStore";
import ClientForm from "@/components/clients/ClientForm";
import type { ClientFormValues } from "@/lib/schemas/client";

export default function ClientsPage() {
  const router = useRouter();
  const user = useAuthStore((s) => s.user);
  const isAdmin = user?.role === "admin";
  const [open, setOpen] = useState(false);

  const { data: clients, isLoading } = useClients();
  const createClient = useCreateClient();

  const handleCreate = async (data: ClientFormValues) => {
    try {
      const created = await createClient.mutateAsync(data);
      toast.success("Cliente creado exitosamente");
      setOpen(false);
      router.push(`/clients/${created.id}`);
    } catch {
      toast.error("Error al crear el cliente");
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Clientes</h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            Empresas clientes registradas
          </p>
        </div>
        {isAdmin && (
          <Button onClick={() => setOpen(true)}>
            <Plus className="h-4 w-4 mr-2" />
            Nuevo cliente
          </Button>
        )}
      </div>

      {isLoading ? (
        <div className="space-y-3">
          {[...Array(4)].map((_, i) => (
            <Skeleton key={i} className="h-16 w-full rounded-lg" />
          ))}
        </div>
      ) : !clients?.length ? (
        <div className="flex flex-col items-center justify-center py-16 text-center">
          <Building2 className="h-12 w-12 text-muted-foreground mb-4" />
          <p className="text-muted-foreground">No hay clientes registrados</p>
          {isAdmin && (
            <Button className="mt-4" onClick={() => setOpen(true)}>
              <Plus className="h-4 w-4 mr-2" />
              Crear primer cliente
            </Button>
          )}
        </div>
      ) : (
        <div className="space-y-2">
          {clients.map((client) => (
            <Card
              key={client.id}
              className="cursor-pointer hover:shadow-md transition-shadow"
              onClick={() => router.push(`/clients/${client.id}`)}
            >
              <CardContent className="flex items-center justify-between p-4">
                <div className="flex items-center gap-3">
                  <div className="h-9 w-9 rounded-full bg-primary/10 flex items-center justify-center">
                    <Building2 className="h-4 w-4 text-primary" />
                  </div>
                  <div>
                    <p className="font-medium">{client.name}</p>
                    {client.contactInfo && (
                      <p className="text-sm text-muted-foreground">
                        {client.contactInfo}
                      </p>
                    )}
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  {!client.isActive && (
                    <span className="text-xs text-muted-foreground bg-muted px-2 py-0.5 rounded">
                      Inactivo
                    </span>
                  )}
                  <ChevronRight className="h-4 w-4 text-muted-foreground" />
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Nuevo cliente</DialogTitle>
          </DialogHeader>
          <ClientForm
            onSubmit={handleCreate}
            isLoading={createClient.isPending}
          />
        </DialogContent>
      </Dialog>
    </div>
  );
}
