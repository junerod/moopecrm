"use client";

import Link from "next/link";

import { Button } from "@/components/ui/button";
import { useCampanhas, useCancelarCampanha } from "@/hooks/campanhas/useCampanhas";
import { lerSettings, statusVisual } from "@/lib/campanhas/settings";
import { rotuloStatusCampanha, tomStatusCampanha } from "@/lib/campanhas/rotulos";
import { rotuloDoObjetivo } from "@/lib/campanhas/objetivo";
import type { StatusVisualDaCampanha } from "@/lib/campanhas/tipos";
import { AppCard } from "@/components/ds/AppCard";
import { EmptyState } from "@/components/ds/EmptyState";
import { StatusBadge } from "@/components/ds/StatusBadge";
import { CaretRight, Megaphone } from "@/lib/ui/icons";

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
            ? "Clique numa campanha para ver o que saiu, quem respondeu e o que falhou."
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
            const settings = lerSettings(c.settings);
            const vis = statusVisual(c.status, settings);
            const canal =
              settings.channels === "ambos"
                ? "WhatsApp + e-mail"
                : settings.channels === "email"
                  ? "E-mail"
                  : "WhatsApp";
            const m = c.metricas;
            return (
              <li key={c.id} data-status={vis === "preparing" ? "preparing" : c.status}>
                <div className="flex items-stretch gap-2">
                  <Link
                    href={`/app/campanhas/${c.id}`}
                    data-testid={`campanha-abrir-${c.id}`}
                    className="min-w-0 flex-1 cursor-pointer"
                  >
                    <AppCard hover className="flex items-center justify-between gap-3">
                      <div className="min-w-0">
                        <p className="truncate text-sm font-semibold text-[var(--color-text)]">
                          {c.name}
                        </p>
                        <p className="mt-0.5 line-clamp-1 text-xs text-[var(--color-text-muted)]">
                          {rotuloDoObjetivo(settings.objective)} · {canal}
                          {c.body_text ? ` · ${c.body_text}` : ""}
                        </p>
                        <div className="mt-2 flex flex-wrap items-center gap-2">
                          <StatusBadge tone={tomStatusCampanha(vis)}>
                            {rotuloStatusCampanha(vis)}
                          </StatusBadge>
                          {m && m.destinatarios > 0 ? (
                            <span className="text-xs tabular-nums text-[var(--color-text-muted)]">
                              {m.enviadas} enviadas
                              {m.respondidas > 0 ? ` · ${m.respondidas} respostas` : ""}
                              {m.falharam > 0 ? ` · ${m.falharam} falhas` : ""}
                            </span>
                          ) : (
                            <span className="text-xs text-[var(--color-text-muted)]">
                              {c.finished_at
                                ? `Encerrada ${quando(c.finished_at)}`
                                : c.started_at
                                  ? `Iniciada ${quando(c.started_at)}`
                                  : `Criada ${quando(c.created_at)}`}
                            </span>
                          )}
                        </div>
                      </div>
                      <span className="flex shrink-0 items-center gap-1 text-xs font-medium text-[var(--color-text-muted)]">
                        Ver resultado
                        <CaretRight size={14} />
                      </span>
                    </AppCard>
                  </Link>
                  {podeEnviar &&
                  (c.status === "running" || c.status === "scheduled" || vis === "preparing") ? (
                    <Button
                      size="sm"
                      variant="outline"
                      className="self-center"
                      data-testid={`campanha-cancelar-${c.id}`}
                      onClick={() => cancelar.mutate(c.id)}
                    >
                      Cancelar
                    </Button>
                  ) : null}
                </div>
              </li>
            );
          })
        )}
      </ul>
    </div>
  );
}

function quando(iso: string): string {
  return new Date(iso).toLocaleString("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}
