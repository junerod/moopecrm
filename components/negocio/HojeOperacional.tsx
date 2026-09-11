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

function Linha({
  href,
  titulo,
  detalhe,
}: {
  href: string;
  titulo: string;
  detalhe?: string;
}) {
  return (
    <li>
      <Link
        href={href}
        className="flex items-baseline justify-between gap-3 rounded-md py-1.5 text-sm hover:bg-muted/50"
      >
        <span className="truncate font-medium">{titulo}</span>
        {detalhe ? (
          <span className="shrink-0 text-[13px] text-muted-foreground">{detalhe}</span>
        ) : null}
      </Link>
    </li>
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
    <section className="space-y-5" data-testid="hoje-operacional">
      <header className="space-y-1">
        <h2 className="text-lg font-medium">Hoje</h2>
        <p className="text-[13px] text-muted-foreground">
          O que pede atenção agora.
        </p>
      </header>

      <div className="space-y-1">
        <h3 className="text-[13px] font-medium text-muted-foreground">Conversas</h3>
        <ul>
          <Linha
            href="/app/inbox?filter=mine"
            titulo="Nas suas mãos"
            detalhe={counts.isLoading ? "…" : String(minhas)}
          />
          <Linha
            href="/app/inbox?filter=unassigned"
            titulo="Na fila"
            detalhe={counts.isLoading ? "…" : String(fila)}
          />
        </ul>
      </div>

      <div className="space-y-1">
        <h3 className="text-[13px] font-medium text-muted-foreground">Negócios</h3>
        <ul>
          <Linha
            href="/app/radar"
            titulo="Sem próximo passo"
            detalhe={radar.isLoading ? "…" : String(semPasso)}
          />
          <Linha
            href="/app/radar"
            titulo="No radar"
            detalhe={radar.isLoading ? "…" : String(emRisco)}
          />
        </ul>
      </div>

      {compromissos.length > 0 ? (
        <div className="space-y-1">
          <h3 className="text-[13px] font-medium text-muted-foreground">Agenda</h3>
          <ul>
            {compromissos.slice(0, 4).map((a) => (
              <Linha
                key={a.id}
                href="/app/agenda"
                titulo={a.titulo}
                detalhe={new Date(a.comeca).toLocaleTimeString("pt-BR", {
                  hour: "2-digit",
                  minute: "2-digit",
                })}
              />
            ))}
          </ul>
        </div>
      ) : null}

      <nav aria-label="Atalhos" className="flex flex-wrap gap-2 pt-1">
        <Link
          href="/app/inbox"
          className="rounded-md border border-border px-3 py-1.5 text-sm hover:bg-muted"
        >
          Inbox
        </Link>
        <Link
          href="/app/kanban"
          className="rounded-md border border-border px-3 py-1.5 text-sm hover:bg-muted"
        >
          Funis
        </Link>
        <Link
          href="/app/contacts"
          className="rounded-md border border-border px-3 py-1.5 text-sm hover:bg-muted"
        >
          Contatos
        </Link>
      </nav>
    </section>
  );
}
