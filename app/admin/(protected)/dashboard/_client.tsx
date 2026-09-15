"use client";
import Link from "next/link";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { KPICards } from "@/components/admin/dashboard/KPICards";
import { AlertsBanner } from "@/components/admin/dashboard/AlertsBanner";
import { useAdminDashboardKPIs } from "@/hooks/useAdminDashboardKPIs";
import { useAlertsRealtime } from "@/hooks/useAlertsRealtime";

function KPISkeleton() {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
      {Array.from({ length: 5 }).map((_, i) => (
        <Card key={i}>
          <CardContent className="pt-6 space-y-3">
            <Skeleton className="h-3 w-24" />
            <Skeleton className="h-8 w-16" />
            <Skeleton className="h-3 w-32" />
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

function AlertsSkeleton() {
  return (
    <Card>
      <CardContent className="py-4 space-y-3">
        {Array.from({ length: 3 }).map((_, i) => (
          <Skeleton key={i} className="h-10 w-full" />
        ))}
      </CardContent>
    </Card>
  );
}

export function DashboardClient() {
  const { data, isLoading } = useAdminDashboardKPIs();
  useAlertsRealtime();

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Dashboard</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Visão cross-tenant — atualiza a cada 30 segundos.
        </p>
      </div>

      <Card>
        <CardContent className="flex flex-col gap-3 py-5 sm:flex-row sm:items-center sm:justify-between">
          <div className="space-y-1">
            <h2 className="text-sm font-semibold">Suporte a um tenant</h2>
            <p className="text-sm text-muted-foreground">
              Impersonar abre a empresa do cliente por 1 hora. Você continua
              sendo o admin da instalação — não vira o login deles. Cada ação
              fica no audit.
            </p>
          </div>
          <Button asChild className="shrink-0">
            <Link href="/admin/tenants">Abrir tenants</Link>
          </Button>
        </CardContent>
      </Card>

      {isLoading || !data ? (
        <>
          <KPISkeleton />
          <AlertsSkeleton />
        </>
      ) : (
        <>
          <KPICards kpis={data} />
          <AlertsBanner alerts={data.alerts} />
        </>
      )}
    </div>
  );
}
