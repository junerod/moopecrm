"use client";

import Link from "next/link";
import { useQuery } from "@tanstack/react-query";

import { ListaDeAcoes } from "@/components/comercial/ListaDeAcoes";
import { RetratoMoope } from "@/components/moope/RetratoMoope";
import { apiClient } from "@/lib/api/client";
import { estadoDaProximaAcao, rotuloDoAtraso, rotuloDoQuando } from "@/lib/comercial/proxima-acao";
import type { CrmSummaryData } from "@/lib/inbox/crm-summary-tipos";
import type { ProximaAcaoLinha } from "@/lib/demandas/listar-proximas-acoes";
import { cn } from "@/lib/utils";

export function Contato360Comercial({ contactId }: { contactId: string }) {
  const summary = useQuery({
    queryKey: ["crm-summary", contactId],
    queryFn: () =>
      apiClient.get<{ data: CrmSummaryData }>(`/api/v1/contacts/${contactId}/crm-summary`).then((r) => r.data),
  });
  const acoes = useQuery({
    queryKey: ["proximas-acoes", "todas", contactId],
    queryFn: () =>
      apiClient.get<{ data: ProximaAcaoLinha[] }>("/api/v1/demandas?visao=todas").then((r) =>
        r.data.filter((a) => a.contact_id === contactId),
      ),
  });

  const data = summary.data;
  const passo = data?.proximo_passo_comercial;
  const estado = estadoDaProximaAcao({
    texto: passo?.proximo_passo,
    em: passo?.proximo_passo_em,
  });

  return (
    <div className="space-y-4" data-testid="contato-360-comercial">
      <RetratoMoope contactId={contactId} />
      <section className="rounded-lg border border-border p-3">
        <h3 className="text-xs font-medium text-muted-foreground">Próxima ação</h3>
        {passo?.proximo_passo ? (
          <div className="mt-1">
            <p className="text-sm font-medium">{passo.proximo_passo}</p>
            <p
              className={cn(
                "text-xs",
                estado === "atrasada" ? "text-destructive" : "text-muted-foreground",
              )}
            >
              {rotuloDoAtraso(passo.proximo_passo_em) ??
                rotuloDoQuando(passo.proximo_passo_em) ??
                "Sem hora"}
            </p>
          </div>
        ) : (
          <p className="mt-1 text-sm text-muted-foreground">Sem próxima ação</p>
        )}
      </section>

      <section>
        <h3 className="text-xs font-medium text-muted-foreground">Negócios</h3>
        <ul className="mt-1 space-y-1">
          {(data?.leads ?? []).length === 0 ? (
            <li className="text-sm text-muted-foreground">Nenhum negócio.</li>
          ) : (
            (data?.leads ?? []).map((l) => (
              <li key={l.id}>
                <Link href={`/app/leads/${l.id}`} className="text-sm hover:underline">
                  {l.title} · {l.status}
                  {l.stage?.name ? ` · ${l.stage.name}` : ""}
                </Link>
              </li>
            ))
          )}
        </ul>
      </section>

      {(acoes.data ?? []).length > 0 ? (
        <section>
          <h3 className="text-xs font-medium text-muted-foreground">Agenda relacionada</h3>
          <ListaDeAcoes acoes={acoes.data ?? []} />
        </section>
      ) : null}
    </div>
  );
}
