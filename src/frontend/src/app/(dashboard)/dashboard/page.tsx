"use client";

import { useAuthStore } from "@/store/authStore";

export default function DashboardPage() {
  const user = useAuthStore((s) => s.user);

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-bold">
          Bienvenido, {user?.firstName} 👋
        </h1>
        <p className="text-muted-foreground text-sm mt-1">
          Sistema de reclutamiento y selección de personal
        </p>
      </div>
    </div>
  );
}
