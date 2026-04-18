import { useState } from "react";
import { ClientList } from "../components/ClientList";
import { ClientForm } from "../components/ClientForm";
import { PageHeader } from "@/components/page-header";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { RoleGate } from "@/components/role-gate";
import { Building2 } from "lucide-react";

export function ClientsPage() {
  const [showCreateDialog, setShowCreateDialog] = useState(false);

  return (
    <div className="page-container py-8 space-y-6">
      <PageHeader
        title="Clientes"
        description="Gestiona las empresas cliente de tu organización"
        action={
          <RoleGate action="create" subject="Client">
            <Button onClick={() => setShowCreateDialog(true)}>
              <Building2 className="h-4 w-4 mr-2" />
              Nuevo cliente
            </Button>
          </RoleGate>
        }
      />

      <ClientList />

      <Dialog open={showCreateDialog} onOpenChange={setShowCreateDialog}>
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle>Crear nuevo cliente</DialogTitle>
          </DialogHeader>
          <ClientForm
            onSuccess={() => setShowCreateDialog(false)}
            onCancel={() => setShowCreateDialog(false)}
          />
        </DialogContent>
      </Dialog>
    </div>
  );
}
