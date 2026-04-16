import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { updateUserSchema, type UpdateUserFormValues } from "@bepro/shared";
import type { IUserDto } from "@bepro/shared";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useUpdateUser } from "../hooks/useUsers";
import { ROLE_OPTIONS } from "../constants";
import { getApiErrorMessage } from "@/lib/error-utils";
import { useAuth } from "@/modules/auth/hooks/useAuth";
import { useAuthStore } from "@/store/auth-store";
import { toast } from "sonner";
import { Pencil, X, Save } from "lucide-react";

interface UserDetailProps {
  user: IUserDto;
}

export function UserDetail({ user }: UserDetailProps) {
  const [isEditing, setIsEditing] = useState(false);
  const { user: currentUser } = useAuth();
  const setAuth = useAuthStore((s) => s.setAuth);
  const updateUser = useUpdateUser(user.id);

  const isAdmin = currentUser?.role === "admin";
  const isSelf = currentUser?.id === user.id;
  const canEdit = isAdmin || isSelf;

  const {
    register,
    handleSubmit,
    setValue,
    watch,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<UpdateUserFormValues>({
    resolver: zodResolver(updateUserSchema),
    defaultValues: {
      firstName: user.firstName,
      lastName: user.lastName,
      role: user.role,
      isFreelancer: user.isFreelancer,
    },
  });

  const selectedRole = watch("role");
  const isFreelancer = watch("isFreelancer");

  const onSubmit = async (data: UpdateUserFormValues) => {
    try {
      const updated = await updateUser.mutateAsync(data);
      toast.success("Usuario actualizado exitosamente");
      setIsEditing(false);

      // Sync auth store if editing own profile
      if (isSelf && currentUser) {
        const token = localStorage.getItem("accessToken");
        if (token) {
          setAuth(token, {
            ...currentUser,
            firstName: updated.firstName,
            lastName: updated.lastName,
          });
        }
      }
    } catch (err) {
      toast.error(getApiErrorMessage(err, "Error al actualizar el usuario"));
    }
  };

  const handleCancel = () => {
    reset({
      firstName: user.firstName,
      lastName: user.lastName,
      role: user.role,
      isFreelancer: user.isFreelancer,
    });
    setIsEditing(false);
  };

  if (!isEditing) {
    return (
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="text-lg">Datos del usuario</CardTitle>
          {canEdit && (
            <Button variant="ghost" size="sm" onClick={() => setIsEditing(true)}>
              <Pencil className="h-4 w-4 mr-1" />
              Editar
            </Button>
          )}
        </CardHeader>
        <CardContent className="space-y-3">
          <div>
            <p className="text-sm text-muted-foreground">Nombre</p>
            <p>{user.firstName} {user.lastName}</p>
          </div>
          <div>
            <p className="text-sm text-muted-foreground">Correo electrónico</p>
            <p>{user.email}</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg">Editar usuario</CardTitle>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <Label htmlFor="edit-firstName" className="mb-1">Nombre</Label>
              <Input id="edit-firstName" {...register("firstName")} error={!!errors.firstName} />
              {errors.firstName && (
                <p className="text-sm text-destructive mt-1">{errors.firstName.message}</p>
              )}
            </div>
            <div>
              <Label htmlFor="edit-lastName" className="mb-1">Apellido</Label>
              <Input id="edit-lastName" {...register("lastName")} error={!!errors.lastName} />
              {errors.lastName && (
                <p className="text-sm text-destructive mt-1">{errors.lastName.message}</p>
              )}
            </div>
          </div>

          {isAdmin && (
            <>
              <div>
                <Label htmlFor="edit-role" className="mb-1">Rol</Label>
                <Select
                  value={selectedRole}
                  onValueChange={(v) =>
                    setValue("role", v as UpdateUserFormValues["role"], { shouldValidate: true })
                  }
                >
                  <SelectTrigger id="edit-role">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {ROLE_OPTIONS.map((opt) => (
                      <SelectItem key={opt.value} value={opt.value}>
                        {opt.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="flex items-center gap-2">
                <Checkbox
                  id="edit-isFreelancer"
                  checked={isFreelancer}
                  onCheckedChange={(checked) =>
                    setValue("isFreelancer", checked === true, { shouldValidate: true })
                  }
                />
                <Label htmlFor="edit-isFreelancer" className="cursor-pointer">
                  Es freelancer
                </Label>
              </div>
            </>
          )}

          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="outline" onClick={handleCancel}>
              <X className="h-4 w-4 mr-1" />
              Cancelar
            </Button>
            <Button type="submit" disabled={isSubmitting}>
              <Save className="h-4 w-4 mr-1" />
              {isSubmitting ? "Guardando\u2026" : "Guardar"}
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}
