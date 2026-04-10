import type { ReactNode } from "react";
import { useAppAbility } from "@/components/ability-provider";
import type { Actions, Subjects } from "@/lib/ability";

interface RoleGateProps {
  action: Actions;
  subject: Subjects;
  children: ReactNode;
  fallback?: ReactNode;
}

export function RoleGate({ action, subject, children, fallback = null }: RoleGateProps) {
  const ability = useAppAbility();
  if (ability.can(action, subject)) {
    return <>{children}</>;
  }
  return <>{fallback}</>;
}
