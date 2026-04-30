import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import {
  createUserSchema,
  type CreateUserFormValues,
} from "@bepro/shared";
import { useEffect, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { Input } from "@/components/ui/input";
import { PasswordInput } from "@/components/password-input";
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
import { useCreateUser } from "../hooks/useUsers";
import {
  useActiveClients,
  ACTIVE_CLIENTS_QUERY_KEY,
} from "../hooks/useActiveClients";
import { ROLE_OPTIONS, PASSWORD_HINT } from "../constants";
import { getApiErrorMessage } from "@/lib/error-utils";
import { toast } from "sonner";

// 010 — Roles que deben capturar Cliente al crear el usuario.
const CLIENT_REQUIRED_ROLES = new Set<CreateUserFormValues["role"]>([
  "account_executive",
  "recruiter",
]);

const INVALID_CLIENT_MESSAGE = "cliente inactivo o inexistente";

interface CreateUserFormProps {
  onSuccess?: () => void;
  onCancel?: () => void;
}

export function CreateUserForm({ onSuccess, onCancel }: CreateUserFormProps) {
  const [serverError, setServerError] = useState<string | null>(null);
  const createUser = useCreateUser();
  const queryClient = useQueryClient();
  const activeClients = useActiveClients();

  const {
    register,
    handleSubmit,
    setValue,
    setError,
    clearErrors,
    watch,
    formState: { errors, isSubmitting },
  } = useForm<CreateUserFormValues>({
    resolver: zodResolver(createUserSchema),
    defaultValues: {
      email: "",
      password: "",
      firstName: "",
      lastName: "",
      role: "recruiter",
      isFreelancer: false,
      clientId: undefined,
    },
  });

  const selectedRole = watch("role");
  const isFreelancer = watch("isFreelancer");
  const clientId = watch("clientId");
  const showClientField = CLIENT_REQUIRED_ROLES.has(selectedRole);

  // 010 / US3 — Al cambiar a un rol que NO requiere cliente (admin/manager),
  // limpiamos cualquier valor previo y removemos errores; así el form queda
  // consistente y no enviamos un clientId stale al server (FR-005 sigue
  // siendo defensivo en el server, pero esto evita confusión visual).
  useEffect(() => {
    if (!CLIENT_REQUIRED_ROLES.has(selectedRole)) {
      setValue("clientId", undefined, { shouldValidate: false });
      clearErrors("clientId");
    }
  }, [selectedRole, setValue, clearErrors]);

  const onSubmit = async (data: CreateUserFormValues) => {
    setServerError(null);
    // Defensiva: si el rol no requiere cliente, removemos el clientId del
    // payload (aunque el useEffect ya debería haberlo limpiado).
    const payload: CreateUserFormValues = CLIENT_REQUIRED_ROLES.has(data.role)
      ? data
      : { ...data, clientId: undefined };

    try {
      await createUser.mutateAsync(payload);
      toast.success("Usuario creado exitosamente");
      onSuccess?.();
    } catch (err) {
      // 010 / Q5 — Cuando el server rechaza por cliente inactivo/inexistente,
      // refrescamos la lista activa para que el operador pueda re-elegir
      // sin re-tipear el resto del formulario.
      const message = getApiErrorMessage(err, "Error al crear el usuario");
      if (message === INVALID_CLIENT_MESSAGE) {
        await queryClient.invalidateQueries({
          queryKey: ACTIVE_CLIENTS_QUERY_KEY,
        });
        setError("clientId", {
          type: "server",
          message: INVALID_CLIENT_MESSAGE,
        });
      }
      setServerError(message);
    }
  };

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <Label htmlFor="firstName" className="mb-1">
            Nombre <span className="text-destructive">*</span>
          </Label>
          <Input
            id="firstName"
            type="text"
            placeholder="María"
            error={!!errors.firstName}
            {...register("firstName")}
          />
          {errors.firstName && (
            <p className="text-sm text-destructive mt-1">
              {errors.firstName.message}
            </p>
          )}
        </div>

        <div>
          <Label htmlFor="lastName" className="mb-1">
            Apellido <span className="text-destructive">*</span>
          </Label>
          <Input
            id="lastName"
            type="text"
            placeholder="García"
            error={!!errors.lastName}
            {...register("lastName")}
          />
          {errors.lastName && (
            <p className="text-sm text-destructive mt-1">
              {errors.lastName.message}
            </p>
          )}
        </div>
      </div>

      <div>
        <Label htmlFor="email" className="mb-1">
          Correo electrónico <span className="text-destructive">*</span>
        </Label>
        <Input
          id="email"
          type="email"
          autoComplete="off"
          spellCheck={false}
          placeholder="correo@ejemplo.com"
          error={!!errors.email}
          {...register("email")}
        />
        {errors.email && (
          <p className="text-sm text-destructive mt-1">
            {errors.email.message}
          </p>
        )}
      </div>

      <div>
        <Label htmlFor="password" className="mb-1">
          Contraseña <span className="text-destructive">*</span>
        </Label>
        <PasswordInput
          id="password"
          autoComplete="new-password"
          placeholder="••••••••"
          error={!!errors.password}
          {...register("password")}
        />
        {errors.password && (
          <p className="text-sm text-destructive mt-1">
            {errors.password.message}
          </p>
        )}
        <p className="text-xs text-muted-foreground mt-1">{PASSWORD_HINT}</p>
      </div>

      <div>
        <Label htmlFor="role" className="mb-1">
          Rol <span className="text-destructive">*</span>
        </Label>
        <Select
          value={selectedRole}
          onValueChange={(value) =>
            setValue("role", value as CreateUserFormValues["role"], {
              shouldValidate: true,
            })
          }
        >
          <SelectTrigger id="role" data-testid="select-rol">
            <SelectValue placeholder="Seleccionar rol">
              {(value: string | null) =>
                value
                  ? (ROLE_OPTIONS.find((o) => o.value === value)?.label ?? value)
                  : null
              }
            </SelectValue>
          </SelectTrigger>
          <SelectContent>
            {ROLE_OPTIONS.map((option) => (
              <SelectItem key={option.value} value={option.value}>
                {option.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        {errors.role && (
          <p className="text-sm text-destructive mt-1">
            {errors.role.message}
          </p>
        )}
      </div>

      {showClientField && (
        <div>
          <Label htmlFor="clientId" className="mb-1">
            Cliente <span className="text-destructive">*</span>
          </Label>
          <Select
            value={clientId ?? ""}
            onValueChange={(value) =>
              setValue("clientId", value ?? undefined, {
                shouldValidate: true,
              })
            }
          >
            <SelectTrigger id="clientId" data-testid="select-cliente">
              <SelectValue placeholder="Seleccionar cliente">
                {(value: string | null) =>
                  value
                    ? (activeClients.data?.find((c) => c.id === value)?.name ??
                      value)
                    : null
                }
              </SelectValue>
            </SelectTrigger>
            <SelectContent>
              {activeClients.isLoading ? (
                <SelectItem value="__loading__" disabled>
                  Cargando clientes…
                </SelectItem>
              ) : activeClients.data && activeClients.data.length > 0 ? (
                activeClients.data.map((client) => (
                  <SelectItem key={client.id} value={client.id}>
                    {client.name}
                  </SelectItem>
                ))
              ) : (
                <SelectItem value="__empty__" disabled>
                  No hay clientes activos
                </SelectItem>
              )}
            </SelectContent>
          </Select>
          {errors.clientId && (
            <p className="text-sm text-destructive mt-1">
              {errors.clientId.message}
            </p>
          )}
        </div>
      )}

      <div className="flex items-center gap-2">
        <Checkbox
          id="isFreelancer"
          checked={isFreelancer}
          onCheckedChange={(checked) =>
            setValue("isFreelancer", checked === true, { shouldValidate: true })
          }
        />
        <Label htmlFor="isFreelancer" className="cursor-pointer">
          Es freelancer
        </Label>
      </div>

      {serverError && (
        <p className="text-sm text-destructive bg-destructive/10 rounded-md p-2">
          {serverError}
        </p>
      )}

      <div className="flex justify-end gap-2 pt-2">
        {onCancel && (
          <Button type="button" variant="outline" onClick={onCancel}>
            Cancelar
          </Button>
        )}
        <Button type="submit" disabled={isSubmitting}>
          {isSubmitting ? "Creando\u2026" : "Crear usuario"}
        </Button>
      </div>
    </form>
  );
}
