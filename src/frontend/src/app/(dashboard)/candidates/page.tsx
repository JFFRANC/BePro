"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Plus, UserCheck, ChevronRight, Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { useCandidatesByClient, useMyCandidates } from "@/hooks/useCandidates";
import { useClients } from "@/hooks/useClients";
import { useAuthStore } from "@/store/authStore";
import StatusBadge from "@/components/candidates/StatusBadge";

export default function CandidatesPage() {
  const router = useRouter();
  const user = useAuthStore((s) => s.user);
  const isRecruiterOrFreelancer = user?.role === "recruiter";

  const [selectedClientId, setSelectedClientId] = useState("");
  const [search, setSearch] = useState("");

  const { data: clients } = useClients();

  const byClientQuery = useCandidatesByClient(selectedClientId);
  const myQuery = useMyCandidates();

  const isLoading = isRecruiterOrFreelancer
    ? myQuery.isLoading
    : byClientQuery.isLoading;

  const allCandidates = isRecruiterOrFreelancer
    ? myQuery.data ?? []
    : byClientQuery.data ?? [];

  const filtered = allCandidates.filter((c) =>
    c.fullName.toLowerCase().includes(search.toLowerCase()) ||
    c.phone.includes(search)
  );

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Candidatos</h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            {isRecruiterOrFreelancer ? "Mis candidatos" : "Candidatos por cliente"}
          </p>
        </div>
        <Button onClick={() => router.push("/candidates/new")}>
          <Plus className="h-4 w-4 mr-2" />
          Registrar
        </Button>
      </div>

      {/* Filtros */}
      <div className="flex flex-col sm:flex-row gap-3">
        {!isRecruiterOrFreelancer && (
          <select
            className="border rounded-md px-3 py-2 text-sm bg-background sm:w-64"
            value={selectedClientId}
            onChange={(e) => setSelectedClientId(e.target.value)}
          >
            <option value="">Selecciona un cliente</option>
            {clients?.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
        )}
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            className="pl-9"
            placeholder="Buscar por nombre o teléfono..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
      </div>

      {/* Lista */}
      {isLoading ? (
        <div className="space-y-3">
          {[...Array(5)].map((_, i) => (
            <Skeleton key={i} className="h-20 w-full rounded-lg" />
          ))}
        </div>
      ) : !isRecruiterOrFreelancer && !selectedClientId ? (
        <div className="flex flex-col items-center justify-center py-16 text-center">
          <UserCheck className="h-12 w-12 text-muted-foreground mb-4" />
          <p className="text-muted-foreground">
            Selecciona un cliente para ver sus candidatos
          </p>
        </div>
      ) : !filtered.length ? (
        <div className="flex flex-col items-center justify-center py-16 text-center">
          <UserCheck className="h-12 w-12 text-muted-foreground mb-4" />
          <p className="text-muted-foreground">No se encontraron candidatos</p>
          <Button className="mt-4" onClick={() => router.push("/candidates/new")}>
            <Plus className="h-4 w-4 mr-2" />
            Registrar candidato
          </Button>
        </div>
      ) : (
        <div className="space-y-2">
          {filtered.map((c) => (
            <Card
              key={c.id}
              className="cursor-pointer hover:shadow-md transition-shadow"
              onClick={() => router.push(`/candidates/${c.id}`)}
            >
              <CardContent className="flex items-center justify-between p-4">
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <p className="font-medium truncate">{c.fullName}</p>
                    <StatusBadge status={c.status} />
                  </div>
                  <p className="text-sm text-muted-foreground mt-0.5">
                    {c.phone}
                    {c.position && ` · ${c.position}`}
                    {c.clientName && ` · ${c.clientName}`}
                  </p>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    Entrevista:{" "}
                    {new Date(c.interviewDate).toLocaleDateString("es-MX")}
                    {c.interviewTime && ` ${c.interviewTime}`}
                    {" · "}Reclutador: {c.recruiterFullName}
                  </p>
                </div>
                <ChevronRight className="h-4 w-4 text-muted-foreground shrink-0 ml-2" />
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
