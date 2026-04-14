import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import {
  createUserSchema,
  type CreateUserFormValues,
} from "@bepro/shared";
import { useState } from "react";
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
import { ROLE_OPTIONS, PASSWORD_HINT } from "../constants";
import { getApiErrorMessage } from "@/lib/error-utils";
import { toast } from "sonner";

interface CreateUserFormProps {
  onSuccess?: () => void;
  onCancel?: () => void;
}

export function CreateUserForm({ onSuccess, onCancel }: CreateUserFormProps) {
  const [serverError, setServerError] = useState<string | null>(null);
  const createUser = useCreateUser();

  const {
    register,
    handleSubmit,
    setValue,
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
    },
  });

  const selectedRole = watch("role");
  const isFreelancer = watch("isFreelancer");

  const onSubmit = async (data: CreateUserFormValues) => {
    setServerError(null);
    try {
      await createUser.mutateAsync(data);
      toast.success("Usuario creado exitosamente");
      onSuccess?.();
    } catch (err) {
      setServerError(getApiErrorMessage(err, "Error al crear el usuario"));
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
          <SelectTrigger id="role">
            <SelectValue placeholder="Seleccionar rol" />
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
