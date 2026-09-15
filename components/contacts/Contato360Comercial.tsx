"use client";

import Link from "next/link";
import { useQuery } from "@tanstack/react-query";

import { ListaDeAcoes } from "@/components/comercial/ListaDeAcoes";
import { AppCard } from "@/components/ds/AppCard";
import { StatusBadge } from "@/components/ds/StatusBadge";
import { RetratoMoope } from "@/components/moope/RetratoMoope";
import { apiClient } from "@/lib/api/client";
import { estadoDaProximaAcao, rotuloDoAtraso, rotuloDoQuando } from "@/lib/comercial/proxima-acao";
import type { CrmSummaryData } from "@/lib/inbox/crm-summary-tipos";
import type { ProximaAcaoLinha } from "@/lib/demandas/listar-proximas-acoes";
import { rotuloDaOrigem } from "@/lib/crm/origem-comercial";
import { cn } from "@/lib/utils";
import { isToday } from "date-fns";

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
  const ehHoje = Boolean(passo?.proximo_passo_em && isToday(new Date(passo.proximo_passo_em)));

  return (
    <div className="space-y-4" data-testid="contato-360-comercial">
      <RetratoMoope contactId={contactId} />
      <AppCard
        className={cn(
          estado === "atrasada" && "ring-[var(--color-error-fg)]/20",
          ehHoje && estado === "aberta" && "ring-[var(--moope-primary)]/25",
        )}
      >
        <h3 className="text-xs font-medium text-[var(--color-text-muted)]">Próxima ação</h3>
        {passo?.proximo_passo ? (
          <div className="mt-1">
            <p className="text-sm font-medium text-[var(--color-text)]">{passo.proximo_passo}</p>
            <p
              className={cn(
                "text-xs",
                estado === "atrasada"
                  ? "text-[var(--color-error-fg)]"
                  : ehHoje
                    ? "text-[var(--moope-primary)]"
                    : "text-[var(--color-text-muted)]",
              )}
            >
              {rotuloDoAtraso(passo.proximo_passo_em) ??
                rotuloDoQuando(passo.proximo_passo_em) ??
                "Sem hora"}
            </p>
          </div>
        ) : (
          <p className="mt-1 text-sm text-[var(--color-text-muted)]">Sem próxima ação</p>
        )}
      </AppCard>

      <AppCard>
        <h3 className="text-xs font-medium text-[var(--color-text-muted)]">Negócios</h3>
        <ul className="mt-2 space-y-2">
          {(data?.leads ?? []).length === 0 ? (
            <li className="text-sm text-[var(--color-text-muted)]">Nenhum negócio.</li>
          ) : (
            (data?.leads ?? []).map((l) => (
              <li key={l.id} className="flex flex-wrap items-center gap-2">
                <Link
                  href={`/app/leads/${l.id}`}
                  className="text-sm font-medium text-[var(--color-text)] hover:underline"
                >
                  {l.title}
                </Link>
                {l.stage?.name ? (
                  <StatusBadge tone="blue">{l.stage.name}</StatusBadge>
                ) : null}
                <span className="text-xs text-[var(--color-text-muted)]">{l.status}</span>
                {l.source ? (
                  <span className="text-xs text-[var(--color-text-muted)]" data-testid="contato-360-origem">
                    · {rotuloDaOrigem(l.source)}
                  </span>
                ) : null}
              </li>
            ))
          )}
        </ul>
      </AppCard>

      {(acoes.data ?? []).length > 0 ? (
        <section>
          <h3 className="text-xs font-medium text-muted-foreground">Agenda relacionada</h3>
          <ListaDeAcoes acoes={acoes.data ?? []} />
        </section>
      ) : null}
    </div>
  );
}
