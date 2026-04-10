import { Outlet, Navigate } from "react-router-dom";
import { useAppAbility } from "@/components/ability-provider";
import type { Actions, Subjects } from "@/lib/ability";

interface ProtectedRouteProps {
  action: Actions;
  subject: Subjects;
}

export function ProtectedRoute({ action, subject }: ProtectedRouteProps) {
  const ability = useAppAbility();
  if (!ability.can(action, subject)) {
    return <Navigate to="/403" replace />;
  }
  return <Outlet />;
}
