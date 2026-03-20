"use client";

import { useState } from "react";
import { toast } from "sonner";
import { Plus, Users } from "lucide-react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Loader2 } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { userService } from "@/services/userService";
import { USER_KEYS } from "@/hooks/useUsers";
import type { UserRole } from "@/types/auth";

const ROLE_CONFIG: Record<UserRole, { label: string; className: string }> = {
  admin: { label: "Admin", className: "bg-red-100 text-red-800" },
  manager: { label: "Gerente", className: "bg-purple-100 text-purple-800" },
  account_executive: { label: "Ejecutivo de cuenta", className: "bg-blue-100 text-blue-800" },
  recruiter: { label: "Reclutador", className: "bg-green-100 text-green-800" },
};

const createUserSchema = z.object({
  firstName: z.string().min(1, "Requerido").max(100),
  lastName: z.string().min(1, "Requerido").max(100),
  email: z.string().email("Email inválido").max(256),
  password: z.string().min(8, "Mínimo 8 caracteres"),
  role: z.enum(["admin", "manager", "account_executive", "recruiter"]),
  isFreelancer: z.boolean(),
});

type CreateUserForm = z.infer<typeof createUserSchema>;

export default function UsersPage() {
  const [open, setOpen] = useState(false);
  const qc = useQueryClient();

  const { data: users, isLoading } = useQuery({
    queryKey: USER_KEYS.all,
    queryFn: userService.getAll,
  });

  const createUser = useMutation({
    mutationFn: userService.create,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: USER_KEYS.all });
      toast.success("Usuario creado exitosamente");
      setOpen(false);
      reset();
    },
    onError: () => toast.error("Error al crear usuario"),
  });

  const {
    register,
    handleSubmit,
    reset,
    watch,
    setValue,
    formState: { errors },
  } = useForm<CreateUserForm>({
    resolver: zodResolver(createUserSchema),
    defaultValues: { role: "recruiter", isFreelancer: false },
  });

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Usuarios</h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            Gestión de usuarios del sistema
          </p>
        </div>
        <Button onClick={() => setOpen(true)}>
          <Plus className="h-4 w-4 mr-2" />
          Nuevo usuario
        </Button>
      </div>

      {isLoading ? (
        <div className="space-y-3">
          {[...Array(4)].map((_, i) => (
            <Skeleton key={i} className="h-16 w-full rounded-lg" />
          ))}
        </div>
      ) : !users?.length ? (
        <div className="flex flex-col items-center justify-center py-16 text-center">
          <Users className="h-12 w-12 text-muted-foreground mb-4" />
          <p className="text-muted-foreground">No hay usuarios registrados</p>
        </div>
      ) : (
        <div className="space-y-2">
          {users.map((u) => {
            const roleConfig = ROLE_CONFIG[u.role];
            return (
              <Card key={u.id}>
                <CardContent className="flex items-center justify-between p-4">
                  <div>
                    <div className="flex items-center gap-2">
                      <p className="font-medium">
                        {u.firstName} {u.lastName}
                      </p>
                      <span
                        className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${roleConfig.className}`}
                      >
                        {roleConfig.label}
                      </span>
                      {u.isFreelancer && (
                        <Badge variant="outline" className="text-xs">
                          Freelancer
                        </Badge>
                      )}
                      {!u.isActive && (
                        <Badge variant="secondary" className="text-xs">
                          Inactivo
                        </Badge>
                      )}
                    </div>
                    <p className="text-sm text-muted-foreground">{u.email}</p>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Nuevo usuario</DialogTitle>
          </DialogHeader>
          <form
            onSubmit={handleSubmit((data) => createUser.mutate(data))}
            className="space-y-4"
          >
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label>Nombre *</Label>
                <Input {...register("firstName")} placeholder="Nombre" />
                {errors.firstName && (
                  <p className="text-xs text-destructive">{errors.firstName.message}</p>
                )}
              </div>
              <div className="space-y-1">
                <Label>Apellido *</Label>
                <Input {...register("lastName")} placeholder="Apellido" />
                {errors.lastName && (
                  <p className="text-xs text-destructive">{errors.lastName.message}</p>
                )}
              </div>
            </div>
            <div className="space-y-1">
              <Label>Email *</Label>
              <Input type="email" {...register("email")} placeholder="usuario@bepro.com" />
              {errors.email && (
                <p className="text-xs text-destructive">{errors.email.message}</p>
              )}
            </div>
            <div className="space-y-1">
              <Label>Contraseña *</Label>
              <Input type="password" {...register("password")} placeholder="Mínimo 8 caracteres" />
              {errors.password && (
                <p className="text-xs text-destructive">{errors.password.message}</p>
              )}
            </div>
            <div className="space-y-1">
              <Label>Rol *</Label>
              <select
                className="w-full border rounded-md px-3 py-2 text-sm bg-background"
                {...register("role")}
                onChange={(e) => {
                  setValue("role", e.target.value as UserRole, { shouldValidate: true });
                  if (e.target.value !== "recruiter") setValue("isFreelancer", false);
                }}
              >
                {(Object.keys(ROLE_CONFIG) as UserRole[]).map((r) => (
                  <option key={r} value={r}>
                    {ROLE_CONFIG[r].label}
                  </option>
                ))}
              </select>
            </div>
            {watch("role") === "recruiter" && (
              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  id="isFreelancer"
                  {...register("isFreelancer")}
                  className="h-4 w-4 rounded border"
                />
                <Label htmlFor="isFreelancer" className="cursor-pointer font-normal">
                  Es freelancer
                </Label>
              </div>
            )}
            <Button type="submit" className="w-full" disabled={createUser.isPending}>
              {createUser.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Crear usuario
            </Button>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
