"use client";

import Link from "next/link";

import { Button } from "@/components/ui/button";
import { useCampanhas, useCancelarCampanha } from "@/hooks/campanhas/useCampanhas";
import { lerSettings, statusVisual } from "@/lib/campanhas/settings";
import { rotuloStatusCampanha, tomStatusCampanha } from "@/lib/campanhas/rotulos";
import type { StatusVisualDaCampanha } from "@/lib/campanhas/tipos";
import { AppCard } from "@/components/ds/AppCard";
import { EmptyState } from "@/components/ds/EmptyState";
import { StatusBadge } from "@/components/ds/StatusBadge";
import { Megaphone } from "@/lib/ui/icons";

const CARDS: Array<{ status: StatusVisualDaCampanha; titulo: string }> = [
  { status: "draft", titulo: "Rascunhos" },
  { status: "scheduled", titulo: "Agendadas" },
  { status: "running", titulo: "Enviando" },
  { status: "completed", titulo: "Finalizadas" },
];

export function CampanhasClient({ podeEnviar }: { podeEnviar: boolean }) {
  const lista = useCampanhas();
  const cancelar = useCancelarCampanha();
  const items = lista.data ?? [];

  const contagem = (alvo: StatusVisualDaCampanha) =>
    items.filter((c) => {
      const vis = statusVisual(c.status, lerSettings(c.settings));
      if (alvo === "draft") return vis === "draft" || vis === "preparing";
      if (alvo === "completed") return vis === "completed" || vis === "cancelled" || vis === "failed";
      return vis === alvo;
    }).length;

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-[var(--color-text-muted)]">
          {podeEnviar
            ? "Crie, revise e dispare. O envio real só ocorre quando o canal oficial ou o e-mail estão configurados."
            : "Você pode consultar campanhas. Envio é de manager/admin."}
        </p>
        {podeEnviar ? (
          <Button asChild data-testid="campanha-nova">
            <Link href="/app/campanhas/nova">+ Criar campanha</Link>
          </Button>
        ) : null}
      </div>

      <div className="grid grid-cols-2 gap-3 md:grid-cols-4" data-testid="campanhas-resumo">
        {CARDS.map((c) => (
          <AppCard key={c.status} className="text-center">
            <p className="text-xs text-[var(--color-text-muted)]">{c.titulo}</p>
            <p className="mt-1 text-2xl font-semibold tabular-nums text-[var(--color-text)]">
              {contagem(c.status)}
            </p>
          </AppCard>
        ))}
      </div>

      <ul className="space-y-2" data-testid="campanhas-lista">
        {items.length === 0 ? (
          <li>
            <EmptyState
              icon={Megaphone}
              tone="violet"
              titulo="Nenhuma campanha ainda"
              frase="Escolha o objetivo, o público e o conteúdo — com preview antes de enviar."
              acao={
                podeEnviar ? (
                  <Button asChild data-testid="campanha-nova-empty">
                    <Link href="/app/campanhas/nova">+ Criar campanha</Link>
                  </Button>
                ) : undefined
              }
            />
          </li>
        ) : (
          items.map((c) => {
            const vis = statusVisual(c.status, lerSettings(c.settings));
            return (
              <li key={c.id} data-status={vis === "preparing" ? "preparing" : c.status}>
                <AppCard className="flex items-center justify-between gap-3" hover>
                  <div className="min-w-0">
                    <Link
                      href={`/app/campanhas/${c.id}`}
                      className="text-sm font-semibold text-[var(--color-text)] hover:underline"
                    >
                      {c.name}
                    </Link>
                    <div className="mt-1 flex flex-wrap items-center gap-2">
                      <StatusBadge tone={tomStatusCampanha(vis)}>
                        {rotuloStatusCampanha(vis)}
                      </StatusBadge>
                    </div>
                  </div>
                  {podeEnviar && (c.status === "running" || c.status === "scheduled" || vis === "preparing") ? (
                    <Button
                      size="sm"
                      variant="outline"
                      data-testid={`campanha-cancelar-${c.id}`}
                      onClick={() => cancelar.mutate(c.id)}
                    >
                      Cancelar
                    </Button>
                  ) : null}
                </AppCard>
              </li>
            );
          })
        )}
      </ul>
    </div>
  );
}
