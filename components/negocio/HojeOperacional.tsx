"use client";

import Link from "next/link";
import { useMemo } from "react";

import { useAgendamentos } from "@/hooks/agenda/useAgendamentos";
import { useAuth } from "@/hooks/auth/AuthProvider";
import { useConversationCounts } from "@/hooks/inbox/useConversationCounts";
import { useAtRiskLeads } from "@/hooks/leads/useAtRiskLeads";

function recorteDeHoje(): { de: string; ate: string } {
  const agora = new Date();
  const de = new Date(agora.getFullYear(), agora.getMonth(), agora.getDate());
  const ate = new Date(de);
  ate.setDate(ate.getDate() + 1);
  return { de: de.toISOString(), ate: ate.toISOString() };
}

function Bloco({
  href,
  numero,
  rotulo,
  carregando,
}: {
  href: string;
  numero: number;
  rotulo: string;
  carregando?: boolean;
}) {
  return (
    <Link
      href={href}
      className="block rounded-lg bg-muted/40 px-4 py-3 transition-colors hover:bg-muted/70"
    >
      <div className="text-3xl font-semibold tabular-nums leading-none">
        {carregando ? "…" : numero}
      </div>
      <div className="mt-2 text-sm text-muted-foreground">{rotulo}</div>
    </Link>
  );
}

export function HojeOperacional() {
  const { activeOrg } = useAuth();
  const recorte = useMemo(() => recorteDeHoje(), []);
  const counts = useConversationCounts(activeOrg?.orgId ?? null);
  const radar = useAtRiskLeads();
  const agenda = useAgendamentos(recorte);

  const minhas = counts.data?.mine ?? 0;
  const fila = counts.data?.unassigned ?? 0;
  const semPasso = radar.data?.total_sem_proximo_passo ?? 0;
  const emRisco = radar.data?.total ?? 0;
  const compromissos = agenda.data ?? [];

  return (
    <section className="space-y-6" data-testid="hoje-operacional">
      <header className="space-y-1">
        <h2 className="text-lg font-semibold">Hoje</h2>
        <p className="text-[13px] text-muted-foreground">O que pede atenção agora.</p>
      </header>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Bloco
          href="/app/inbox?filter=mine"
          numero={minhas}
          rotulo="nas suas mãos"
          carregando={counts.isLoading}
        />
        <Bloco
          href="/app/inbox?filter=unassigned"
          numero={fila}
          rotulo="na fila"
          carregando={counts.isLoading}
        />
        <Bloco
          href="/app/radar"
          numero={semPasso}
          rotulo="sem próximo passo"
          carregando={radar.isLoading}
        />
        <Bloco
          href="/app/radar"
          numero={emRisco}
          rotulo="no radar"
          carregando={radar.isLoading}
        />
      </div>

      {compromissos.length > 0 ? (
        <div className="space-y-2">
          <h3 className="text-xs text-muted-foreground">Agenda</h3>
          <ul className="space-y-1">
            {compromissos.slice(0, 4).map((a) => (
              <li key={a.id}>
                <Link
                  href="/app/agenda"
                  className="flex items-baseline justify-between gap-3 rounded-md py-1.5 text-sm hover:bg-muted/50"
                >
                  <span className="truncate font-medium">{a.titulo}</span>
                  <span className="shrink-0 text-[13px] text-muted-foreground">
                    {new Date(a.comeca).toLocaleTimeString("pt-BR", {
                      hour: "2-digit",
                      minute: "2-digit",
                    })}
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      <nav aria-label="Atalhos" className="flex flex-wrap gap-2 pt-1">
        <Link href="/app/inbox" className="rounded-md px-3 py-1.5 text-sm hover:bg-muted">
          Inbox
        </Link>
        <Link href="/app/kanban" className="rounded-md px-3 py-1.5 text-sm hover:bg-muted">
          Funis
        </Link>
        <Link href="/app/contacts" className="rounded-md px-3 py-1.5 text-sm hover:bg-muted">
          Contatos
        </Link>
      </nav>
    </section>
  );
}
