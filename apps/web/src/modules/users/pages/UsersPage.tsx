import { useState } from "react";
import { UserList } from "../components/UserList";
import { CreateUserForm } from "../components/CreateUserForm";
import { BulkImportForm } from "../components/BulkImportForm";
import { PageHeader } from "@/components/page-header";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { RoleGate } from "@/components/role-gate";
import { UserPlus, Upload } from "lucide-react";

export function UsersPage() {
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [showImportDialog, setShowImportDialog] = useState(false);

  return (
    <div className="page-container py-8 space-y-6">
      <PageHeader
        title="Usuarios"
        description="Gestiona los usuarios de tu organización"
        action={
          <RoleGate action="create" subject="User">
            <div className="flex gap-2">
              <Button variant="outline" onClick={() => setShowImportDialog(true)}>
                <Upload className="h-4 w-4 mr-2" />
                Importar
              </Button>
              <Button onClick={() => setShowCreateDialog(true)}>
                <UserPlus className="h-4 w-4 mr-2" />
                Nuevo usuario
              </Button>
            </div>
          </RoleGate>
        }
      />

      <UserList />

      <Dialog open={showCreateDialog} onOpenChange={setShowCreateDialog}>
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle>Crear nuevo usuario</DialogTitle>
          </DialogHeader>
          <CreateUserForm
            onSuccess={() => setShowCreateDialog(false)}
            onCancel={() => setShowCreateDialog(false)}
          />
        </DialogContent>
      </Dialog>

      <Dialog open={showImportDialog} onOpenChange={setShowImportDialog}>
        <DialogContent className="sm:max-w-[600px]">
          <DialogHeader>
            <DialogTitle>Importar usuarios</DialogTitle>
          </DialogHeader>
          <BulkImportForm onClose={() => setShowImportDialog(false)} />
        </DialogContent>
      </Dialog>
    </div>
  );
}
