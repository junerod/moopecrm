"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

import { useAgentInbox } from "@/hooks/ai/useAgentInbox";
import { useMovimentacoesFunil } from "@/hooks/home/useMovimentacoesFunil";
import { kindLabel } from "@/lib/ai/agent-inbox-copy";
import {
  contarNaoVistas,
  lidoEmMs,
  marcarAlteracoesVistas,
} from "@/lib/home/visto-alteracoes-funil";
import { Bell } from "@/lib/ui/icons";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";

/**
 * Sino: avisos de operação (Central) + alterações de etapa do funil.
 * Os dois não se misturam na mesma lista — um pede decisão, o outro informa.
 */
export function AlertsBell() {
  const { data: avisos } = useAgentInbox("open");
  const { data: movs } = useMovimentacoesFunil();
  const [aberto, setAberto] = useState(false);
  const [vistoEm, setVistoEm] = useState<number | null>(null);

  useEffect(() => {
    setVistoEm(lidoEmMs(window.localStorage));
  }, []);

  const naoVistas = contarNaoVistas(movs ?? [], vistoEm);
  const operacao = avisos?.open_count ?? 0;
  const count = operacao + naoVistas;
  const itensOperacao = (avisos?.items ?? []).slice(0, 3);
  const itensFunil = (movs ?? []).slice(0, 5);

  return (
    <Popover
      open={aberto}
      onOpenChange={(next) => {
        setAberto(next);
        if (next) {
          const agora = new Date();
          marcarAlteracoesVistas(window.localStorage, agora);
          setVistoEm(agora.getTime());
        }
      }}
    >
      <PopoverTrigger asChild>
        <button
          type="button"
          aria-label={count > 0 ? `Alertas — ${count} sem ver` : "Alertas"}
          data-testid="alerts-bell"
          className="relative inline-flex h-11 w-11 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-muted hover:text-foreground lg:h-9 lg:w-9"
        >
          <Bell size={18} aria-hidden />
          {count > 0 ? (
            <span
              data-testid="alerts-bell-count"
              className="absolute -right-0.5 -top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-destructive px-1 text-[10px] font-semibold leading-none text-destructive-foreground"
            >
              {count > 99 ? "99+" : count}
            </span>
          ) : null}
        </button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-80 p-0" data-testid="alerts-bell-panel">
        <section className="border-b border-border p-3">
          <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
            Operação
          </p>
          {itensOperacao.length === 0 ? (
            <p className="mt-2 text-sm text-muted-foreground">Nenhum aviso aberto.</p>
          ) : (
            <ul className="mt-2 space-y-2">
              {itensOperacao.map((item) => (
                <li key={item.id} className="text-sm leading-snug">
                  {kindLabel(item.kind)}
                </li>
              ))}
            </ul>
          )}
          <Link
            href="/app/ai/inbox"
            className="mt-2 inline-block text-[12px] font-medium text-[var(--moope-primary)] hover:underline"
          >
            Ver todos os avisos
          </Link>
        </section>
        <section className="p-3">
          <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
            Funil
          </p>
          {itensFunil.length === 0 ? (
            <p className="mt-2 text-sm text-muted-foreground">Nenhuma mudança de etapa recente.</p>
          ) : (
            <ul className="mt-2 space-y-2" data-testid="alerts-funil">
              {itensFunil.map((m) => (
                <li key={m.activity_id}>
                  <Link href={`/app/leads/${m.lead_id}`} className="block text-sm leading-snug hover:underline">
                    <span className="font-medium">{m.titulo}</span>
                    <span className="mt-0.5 block text-[12px] text-muted-foreground">{m.texto}</span>
                  </Link>
                </li>
              ))}
            </ul>
          )}
          <Link
            href="/app/inicio"
            className="mt-2 inline-block text-[12px] font-medium text-[var(--moope-primary)] hover:underline"
          >
            Ver na Início
          </Link>
        </section>
      </PopoverContent>
    </Popover>
  );
}
