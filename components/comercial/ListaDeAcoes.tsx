"use client";

import Link from "next/link";
import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

import { ProximaAcaoControles } from "@/components/comercial/ProximaAcaoControles";
import { Button } from "@/components/ui/button";
import { apiClient } from "@/lib/api/client";
import { rotuloDoAtraso, rotuloDoQuando } from "@/lib/comercial/proxima-acao";
import type { ProximaAcaoLinha } from "@/lib/demandas/listar-proximas-acoes";
import { cn } from "@/lib/utils";

export function ListaDeAcoes({
  acoes,
  vazia,
  editavel,
}: {
  acoes: ProximaAcaoLinha[];
  vazia?: string;
  editavel?: boolean;
}) {
  const qc = useQueryClient();
  const [editando, setEditando] = useState<string | null>(null);

  if (acoes.length === 0) {
    return <p className="text-sm text-muted-foreground">{vazia ?? "Nenhuma ação."}</p>;
  }

  async function recarregar() {
    await qc.invalidateQueries({ queryKey: ["proximas-acoes"] });
    await qc.invalidateQueries({ queryKey: ["board"] });
  }

  return (
    <ul className="space-y-1" data-testid="lista-proximas-acoes">
      {acoes.map((a) => {
        const href = a.conversation_id
          ? `/app/inbox/${a.conversation_id}`
          : a.lead_id
            ? `/app/kanban?lead=${a.lead_id}`
            : `/app/contacts/${a.contact_id}`;
        const atraso = rotuloDoAtraso(a.em);
        const quando = rotuloDoQuando(a.em);
        return (
          <li key={a.demanda_id} className="rounded-md">
            <div
              className={cn(
                "flex items-baseline justify-between gap-3 py-1.5 text-sm",
                a.estado === "atrasada" && "text-destructive",
              )}
              data-testid="item-proxima-acao"
              data-estado={a.estado}
              data-demanda={a.demanda_id}
            >
              <Link href={href} className="min-w-0 truncate hover:underline">
                <span className="font-medium">{a.contact_name}</span>
                <span className="text-muted-foreground"> — {a.texto ?? "Sem texto"}</span>
              </Link>
              <span className="shrink-0 text-[13px] tabular-nums text-muted-foreground">
                {atraso ?? quando ?? "Sem hora"}
              </span>
            </div>
            {editavel ? (
              <div className="mb-2 flex flex-wrap gap-1">
                <Button
                  type="button"
                  size="sm"
                  variant="ghost"
                  className="h-7 text-xs"
                  data-testid="agenda-editar-acao"
                  onClick={() => setEditando(a.demanda_id)}
                >
                  Editar
                </Button>
                <Button
                  type="button"
                  size="sm"
                  variant="ghost"
                  className="h-7 text-xs"
                  data-testid="agenda-concluir-acao"
                  onClick={() => {
                    void apiClient
                      .post(`/api/v1/demandas/${a.demanda_id}/concluir`, {})
                      .then(() => {
                        toast.success("Ação concluída.");
                        return recarregar();
                      })
                      .catch(() => toast.error("Não consegui concluir."));
                  }}
                >
                  Concluir
                </Button>
              </div>
            ) : null}
            {editando === a.demanda_id ? (
              <div className="mb-3">
                <ProximaAcaoControles
                  textoInicial={a.texto ?? ""}
                  emInicial={a.em}
                  onSalvar={async (texto, em) => {
                    await apiClient.patch(`/api/v1/demandas/${a.demanda_id}`, {
                      proximo_passo: texto,
                      proximo_passo_em: em,
                    });
                    toast.success("Ação atualizada.");
                    setEditando(null);
                    await recarregar();
                  }}
                  onCancelar={() => setEditando(null)}
                />
              </div>
            ) : null}
          </li>
        );
      })}
    </ul>
  );
}
