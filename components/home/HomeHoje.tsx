"use client";

import Link from "next/link";
import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

import { ProximaAcaoControles } from "@/components/comercial/ProximaAcaoControles";
import { Button } from "@/components/ui/button";
import { apiClient } from "@/lib/api/client";
import type { AcaoDaHome } from "@/lib/home/tipos";
import { cn } from "@/lib/utils";

function horaDaAcao(em: string | null): string {
  if (!em) return "—";
  const d = new Date(em);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
}

export function HomeHoje({ acoes }: { acoes: AcaoDaHome[] }) {
  const qc = useQueryClient();
  const [editando, setEditando] = useState<string | null>(null);

  async function recarregar() {
    await qc.invalidateQueries({ queryKey: ["proximas-acoes"] });
    await qc.invalidateQueries({ queryKey: ["board"] });
    await qc.invalidateQueries({ queryKey: ["home"] });
  }

  if (acoes.length === 0) {
    return (
      <div className="py-1">
        <p className="text-[14px] font-medium">Agenda livre hoje.</p>
        <p className="mt-0.5 text-[13px] text-[var(--color-text-muted)]">
          Você não tem retornos agendados para hoje.
        </p>
        <p className="text-[12px] text-[var(--color-text-subtle)]">Agenda livre por enquanto.</p>
      </div>
    );
  }

  return (
    <ul className="space-y-0" data-testid="lista-proximas-acoes">
      {acoes.slice(0, 5).map((a) => {
        const href = a.conversation_id
          ? `/app/inbox/${a.conversation_id}`
          : a.lead_id
            ? `/app/kanban?lead=${a.lead_id}`
            : `/app/contacts/${a.contact_id}`;
        const atrasada = a.estado === "atrasada";
        const meta = [a.lead_title, a.temperatura === "quente" ? "Quente" : null]
          .filter(Boolean)
          .join(" · ");
        return (
          <li key={a.demanda_id}>
            <div
              className="group grid grid-cols-[3.1rem_0.75rem_1fr_auto] items-start gap-x-2 py-2"
              data-testid="item-proxima-acao"
              data-estado={a.estado}
              data-demanda={a.demanda_id}
            >
              <time
                className={cn(
                  "pt-0.5 text-[12px] tabular-nums",
                  atrasada ? "font-medium text-[var(--color-error-fg)]" : "text-[var(--color-text-muted)]",
                )}
              >
                {horaDaAcao(a.em)}
              </time>
              <span className="flex flex-col items-center pt-1.5" aria-hidden>
                <span
                  className={cn(
                    "h-2 w-2 rounded-full",
                    atrasada ? "bg-[var(--color-error)]" : "bg-[var(--color-info)]",
                  )}
                />
                <span className="mt-1 w-px flex-1 bg-white/10" />
              </span>
              <Link
                href={href}
                className="min-w-0 rounded-sm transition-colors duration-150 hover:text-[var(--color-info-fg)]"
              >
                <p className="truncate text-[14px] font-medium">{a.contact_name}</p>
                <p className="truncate text-[13px] text-[var(--color-text-muted)]">
                  {a.texto ?? "Sem texto"}
                </p>
                {meta ? (
                  <p className="mt-0.5 truncate text-[11px] text-[var(--color-text-subtle)]">{meta}</p>
                ) : null}
              </Link>
              <div className="flex shrink-0 flex-col items-end gap-1">
                {atrasada ? (
                  <span className="rounded-full bg-[var(--color-error-bg)] px-2 py-0.5 text-[11px] font-medium text-[var(--color-error-fg)]">
                    Atrasada
                  </span>
                ) : (
                  <span className="rounded-full bg-[var(--moope-primary-bg)] px-2 py-0.5 text-[11px] font-medium text-[var(--moope-primary)]">
                    Hoje
                  </span>
                )}
                <div className="flex gap-1 md:opacity-0 md:transition-opacity md:duration-150 md:group-hover:opacity-100">
                  <Button
                    type="button"
                    size="sm"
                    variant="ghost"
                    className="h-6 px-2 text-[11px]"
                    data-testid="agenda-editar-acao"
                    onClick={() => setEditando(a.demanda_id)}
                  >
                    Editar
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    variant="ghost"
                    className="h-6 px-2 text-[11px]"
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
              </div>
            </div>
            {editando === a.demanda_id ? (
              <div className="mb-2 pl-14">
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
