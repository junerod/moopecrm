"use client";

import Link from "next/link";

import { useCampanha, useCancelarCampanha, useDestinatarios } from "@/hooks/campanhas/useCampanhas";
import { rotuloStatusCampanha, tomStatusCampanha } from "@/lib/campanhas/rotulos";
import { StatusBadge } from "@/components/ds/StatusBadge";

export function CampanhaDetalheClient({ id }: { id: string }) {
  const camp = useCampanha(id);
  const dests = useDestinatarios(id);
  const cancelar = useCancelarCampanha();

  if (camp.isLoading) return <p className="text-sm text-muted-foreground">Carregando…</p>;
  if (!camp.data) return <p className="text-sm text-destructive">Campanha não encontrada.</p>;

  const m = camp.data.metricas;
  return (
    <div className="space-y-6 bg-[var(--color-bg)]" data-testid="campanha-resultado">
      <header>
        <Link href="/app/campanhas" className="text-xs text-[var(--color-text-muted)] hover:underline">
          ← Campanhas
        </Link>
        <div className="mt-2 flex flex-wrap items-center gap-2">
          <h1 className="text-2xl font-semibold tracking-tight text-[var(--color-text)]">
            {camp.data.name}
          </h1>
          <StatusBadge tone={tomStatusCampanha(camp.data.status)}>
            {rotuloStatusCampanha(camp.data.status)}
          </StatusBadge>
        </div>
        <p className="sr-only" data-testid="campanha-status">
          {camp.data.status}
        </p>
        {camp.data.status === "running" || camp.data.status === "scheduled" ? (
          <button
            type="button"
            className="mt-2 text-sm underline"
            data-testid="campanha-cancelar"
            onClick={() => cancelar.mutate(id)}
          >
            Cancelar campanha
          </button>
        ) : null}
      </header>

      <dl className="grid grid-cols-2 gap-3 text-sm md:grid-cols-3" data-testid="campanha-metricas">
        <Item rotulo="Enviadas" valor={m.enviadas} />
        <Item rotulo="Entregues" valor={m.entregues} />
        <Item rotulo="Lidas" valor={m.lidas} />
        <Item rotulo="Respondidas" valor={m.respondidas} />
        <Item rotulo="Falharam" valor={m.falharam} />
        <Item rotulo="Opt-outs" valor={m.opt_outs} />
      </dl>

      <section>
        <h2 className="text-sm font-medium">Destinatários</h2>
        <ul className="mt-2 divide-y rounded-lg border border-border" data-testid="campanha-destinatarios">
          {(dests.data ?? []).map((d) => (
            <li key={d.id} className="flex justify-between p-2 text-sm">
              <span className="font-mono text-xs">{d.phone ?? d.contact_id.slice(0, 8)}</span>
              <span data-status={d.status}>{d.status}</span>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}

function Item({ rotulo, valor }: { rotulo: string; valor: number }) {
  return (
    <div className="rounded-[12px] bg-[var(--color-surface)] p-3 shadow-[var(--shadow-sm)] ring-1 ring-[var(--color-border)]">
      <dt className="text-xs text-[var(--color-text-muted)]">{rotulo}</dt>
      <dd className="text-lg font-semibold tabular-nums text-[var(--color-text)]">{valor}</dd>
    </div>
  );
}
