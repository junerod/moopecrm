"use client";

import { useState } from "react";

import { ListaDeAcoes } from "@/components/comercial/ListaDeAcoes";
import { Button } from "@/components/ui/button";
import { useProximasAcoes } from "@/hooks/comercial/useProximasAcoes";
import { useAuth } from "@/hooks/auth/AuthProvider";
import type { VisaoDaAcao } from "@/lib/demandas/listar-proximas-acoes";
import { cn } from "@/lib/utils";

const ABAS: Array<{ id: "hoje" | "proximos" | "atrasados"; rotulo: string }> = [
  { id: "hoje", rotulo: "Hoje" },
  { id: "proximos", rotulo: "Próximos" },
  { id: "atrasados", rotulo: "Atrasados" },
];

export function ObrigacoesComerciais() {
  const [visao, setVisao] = useState<Extract<VisaoDaAcao, "hoje" | "proximos" | "atrasados">>(
    () => {
      if (typeof window === "undefined") return "hoje";
      const inicial = new URLSearchParams(window.location.search).get("visao");
      return inicial === "proximos" || inicial === "atrasados" || inicial === "hoje"
        ? inicial
        : "hoje";
    },
  );
  const { activeOrg } = useAuth();
  const manager = activeOrg?.role === "manager" || activeOrg?.role === "admin";
  const [equipe, setEquipe] = useState(false);
  const q = useProximasAcoes(visao, manager && !equipe ? { mine: true } : undefined);

  return (
    <section className="space-y-3 rounded-lg border border-border p-4" data-testid="agenda-obrigacoes">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-sm font-semibold">Obrigações comerciais</h2>
        {manager ? (
          <Button
            type="button"
            size="sm"
            variant="ghost"
            className="h-7 text-xs"
            data-testid="agenda-filtro-equipe"
            onClick={() => setEquipe((v) => !v)}
          >
            {equipe ? "Minhas" : "Da equipe"}
          </Button>
        ) : null}
      </div>
      <div className="flex flex-wrap gap-1">
        {ABAS.map((a) => (
          <Button
            key={a.id}
            type="button"
            size="sm"
            variant={visao === a.id ? "default" : "outline"}
            className={cn("h-7 text-xs", visao === "atrasados" && a.id === "atrasados" && "bg-destructive")}
            data-testid={`agenda-visao-${a.id}`}
            onClick={() => setVisao(a.id)}
          >
            {a.rotulo}
          </Button>
        ))}
      </div>
      {q.isLoading ? (
        <p className="text-sm text-muted-foreground">Carregando…</p>
      ) : (
        <ListaDeAcoes acoes={q.data ?? []} vazia="Nenhuma obrigação nesta visão." editavel />
      )}
    </section>
  );
}
