import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { createContactSchema, type CreateContactFormValues } from "@bepro/shared";
import { useContacts, useCreateContact, useUpdateContact, useDeleteContact } from "../hooks/useClients";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Skeleton } from "@/components/ui/skeleton";
import { EmptyState } from "@/components/empty-state";
import { Plus, Pencil, Trash2, Check, X, Contact } from "lucide-react";
import { getApiErrorMessage } from "@/lib/error-utils";
import { toast } from "sonner";
import type { IClientContactDto } from "@bepro/shared";

interface ContactDirectoryProps {
  clientId: string;
  readOnly?: boolean;
}

export function ContactDirectory({ clientId, readOnly = false }: ContactDirectoryProps) {
  const { data: contacts, isLoading } = useContacts(clientId);
  const createContact = useCreateContact(clientId);
  const updateContact = useUpdateContact(clientId);
  const deleteContact = useDeleteContact(clientId);

  const [showAddForm, setShowAddForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);

  return (
    <div className="space-y-4">
      {!readOnly && (
        <div className="flex justify-end">
          <Button variant="outline" size="sm" onClick={() => setShowAddForm(true)} disabled={showAddForm}>
            <Plus className="h-4 w-4 mr-2" />
            Agregar contacto
          </Button>
        </div>
      )}

      <div className="rounded-lg border overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Nombre</TableHead>
              <TableHead>Teléfono</TableHead>
              <TableHead>Email</TableHead>
              {!readOnly && <TableHead className="w-24" />}
            </TableRow>
          </TableHeader>
          <TableBody>
            {showAddForm && (
              <AddContactRow
                clientId={clientId}
                onSave={() => setShowAddForm(false)}
                onCancel={() => setShowAddForm(false)}
              />
            )}
            {isLoading ? (
              Array.from({ length: 3 }).map((_, i) => (
                <TableRow key={i}>
                  <TableCell><Skeleton className="h-4 w-28" /></TableCell>
                  <TableCell><Skeleton className="h-4 w-24" /></TableCell>
                  <TableCell><Skeleton className="h-4 w-36" /></TableCell>
                  {!readOnly && <TableCell><Skeleton className="h-8 w-16" /></TableCell>}
                </TableRow>
              ))
            ) : !contacts?.length && !showAddForm ? (
              <TableRow>
                <TableCell colSpan={readOnly ? 3 : 4} className="h-32 p-0">
                  <EmptyState
                    icon={Contact}
                    title="Sin contactos"
                    description="No hay contactos registrados para este cliente"
                  />
                </TableCell>
              </TableRow>
            ) : (
              contacts?.map((contact) =>
                editingId === contact.id ? (
                  <EditContactRow
                    key={contact.id}
                    contact={contact}
                    clientId={clientId}
                    onSave={() => setEditingId(null)}
                    onCancel={() => setEditingId(null)}
                  />
                ) : (
                  <TableRow key={contact.id}>
                    <TableCell className="font-medium">{contact.name}</TableCell>
                    <TableCell className="text-muted-foreground">{contact.phone}</TableCell>
                    <TableCell className="text-muted-foreground">{contact.email}</TableCell>
                    {!readOnly && (
                      <TableCell>
                        <div className="flex gap-1">
                          <Button variant="ghost" size="icon" onClick={() => setEditingId(contact.id)}>
                            <Pencil className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={async () => {
                              try {
                                await deleteContact.mutateAsync(contact.id);
                                toast.success("Contacto eliminado");
                              } catch (err) {
                                toast.error(getApiErrorMessage(err, "Error al eliminar contacto"));
                              }
                            }}
                          >
                            <Trash2 className="h-4 w-4 text-destructive" />
                          </Button>
                        </div>
                      </TableCell>
                    )}
                  </TableRow>
                ),
              )
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}

function AddContactRow({
  clientId,
  onSave,
  onCancel,
}: {
  clientId: string;
  onSave: () => void;
  onCancel: () => void;
}) {
  const createContact = useCreateContact(clientId);
  const { register, handleSubmit, formState: { errors } } = useForm<CreateContactFormValues>({
    resolver: zodResolver(createContactSchema),
  });

  const onSubmit = async (data: CreateContactFormValues) => {
    try {
      await createContact.mutateAsync(data);
      toast.success("Contacto creado");
      onSave();
    } catch (err) {
      toast.error(getApiErrorMessage(err, "Error al crear contacto"));
    }
  };

  return (
    <TableRow>
      <TableCell>
        <Input placeholder="Nombre" {...register("name")} error={!!errors.name} className="h-8" />
      </TableCell>
      <TableCell>
        <Input placeholder="5512345678" {...register("phone")} error={!!errors.phone} className="h-8" />
      </TableCell>
      <TableCell>
        <Input placeholder="correo@empresa.com" {...register("email")} error={!!errors.email} className="h-8" />
      </TableCell>
      <TableCell>
        <div className="flex gap-1">
          <Button variant="ghost" size="icon" onClick={handleSubmit(onSubmit)} disabled={createContact.isPending}>
            <Check className="h-4 w-4 text-success" />
          </Button>
          <Button variant="ghost" size="icon" onClick={onCancel}>
            <X className="h-4 w-4" />
          </Button>
        </div>
      </TableCell>
    </TableRow>
  );
}

function EditContactRow({
  contact,
  clientId,
  onSave,
  onCancel,
}: {
  contact: IClientContactDto;
  clientId: string;
  onSave: () => void;
  onCancel: () => void;
}) {
  const updateContact = useUpdateContact(clientId);
  const { register, handleSubmit } = useForm<CreateContactFormValues>({
    resolver: zodResolver(createContactSchema),
    defaultValues: {
      name: contact.name,
      phone: contact.phone,
      email: contact.email,
    },
  });

  const onSubmit = async (data: CreateContactFormValues) => {
    try {
      await updateContact.mutateAsync({ contactId: contact.id, data });
      toast.success("Contacto actualizado");
      onSave();
    } catch (err) {
      toast.error(getApiErrorMessage(err, "Error al actualizar contacto"));
    }
  };

  return (
    <TableRow>
      <TableCell>
        <Input {...register("name")} className="h-8" />
      </TableCell>
      <TableCell>
        <Input {...register("phone")} className="h-8" />
      </TableCell>
      <TableCell>
        <Input {...register("email")} className="h-8" />
      </TableCell>
      <TableCell>
        <div className="flex gap-1">
          <Button variant="ghost" size="icon" onClick={handleSubmit(onSubmit)} disabled={updateContact.isPending}>
            <Check className="h-4 w-4 text-success" />
          </Button>
          <Button variant="ghost" size="icon" onClick={onCancel}>
            <X className="h-4 w-4" />
          </Button>
        </div>
      </TableCell>
    </TableRow>
  );
}
