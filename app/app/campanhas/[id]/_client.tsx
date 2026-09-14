"use client";

import Link from "next/link";

import { Button } from "@/components/ui/button";
import { useCampanha, useCancelarCampanha, useDestinatarios } from "@/hooks/campanhas/useCampanhas";
import { lerSettings, statusVisual } from "@/lib/campanhas/settings";
import {
  rotuloMotivoPulo,
  rotuloStatusCampanha,
  rotuloStatusDestinatario,
  tomStatusCampanha,
} from "@/lib/campanhas/rotulos";
import { StatusBadge } from "@/components/ds/StatusBadge";

export function CampanhaDetalheClient({ id }: { id: string }) {
  const camp = useCampanha(id);
  const dests = useDestinatarios(id);
  const cancelar = useCancelarCampanha();

  if (camp.isLoading) return <p className="text-sm text-muted-foreground">Carregando…</p>;
  if (!camp.data) return <p className="text-sm text-destructive">Campanha não encontrada.</p>;

  const m = camp.data.metricas;
  const settings = lerSettings(camp.data.settings);
  const vis = statusVisual(camp.data.status, settings);
  const total = m.destinatarios || (m.enviadas + m.pendentes + m.puladas + m.falharam + m.ignoradas);
  const podeCancelar = camp.data.status === "running" || camp.data.status === "scheduled" || vis === "preparing";

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
          <StatusBadge tone={tomStatusCampanha(vis)}>{rotuloStatusCampanha(vis)}</StatusBadge>
        </div>
        <p className="sr-only" data-testid="campanha-status">
          {vis}
        </p>
        {settings.preparing ? (
          <p className="mt-2 text-sm" data-testid="campanha-preparando">
            Preparando destinatários…
          </p>
        ) : null}
        {m.enviadas + m.pendentes > 0 ? (
          <p className="mt-2 text-sm tabular-nums" data-testid="campanha-progresso">
            {m.enviadas} / {total} enviados
          </p>
        ) : null}
        {podeCancelar ? (
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

      <dl className="grid grid-cols-2 gap-3 text-sm md:grid-cols-4" data-testid="campanha-metricas">
        <Item rotulo="Destinatários" valor={m.destinatarios} />
        <Item rotulo="Na fila" valor={m.pendentes} />
        <Item rotulo="Enviadas" valor={m.enviadas} />
        <Item rotulo="Entregues" valor={m.entregues} hint={m.entregues === 0 ? "Não disponível neste canal" : undefined} />
        <Item rotulo="Lidas" valor={m.lidas} hint={m.lidas === 0 ? "Não disponível neste canal" : undefined} />
        <Item rotulo="Respondidas" valor={m.respondidas} />
        <Item rotulo="Falharam" valor={m.falharam} />
        <Item rotulo="Ignoradas" valor={m.ignoradas} />
        <Item rotulo="Opt-outs" valor={m.opt_outs} />
      </dl>

      <section>
        <h2 className="text-sm font-medium">Destinatários</h2>
        <ul className="mt-2 divide-y rounded-lg border border-border" data-testid="campanha-destinatarios">
          {(dests.data ?? []).map((d) => (
            <li key={d.id} className="flex flex-col gap-1 p-3 text-sm md:flex-row md:items-center md:justify-between">
              <span className="min-w-0 truncate">
                {d.destination ?? d.phone ?? d.contact_id.slice(0, 8)}
                {d.channel ? ` · ${d.channel === "email" ? "E-mail" : "WhatsApp"}` : ""}
              </span>
              <span className="flex flex-wrap items-center gap-2">
                <span data-status={d.status}>{rotuloStatusDestinatario(d.status)}</span>
                {d.error ? (
                  <span className="text-xs text-[var(--color-text-muted)]">{rotuloMotivoPulo(d.error)}</span>
                ) : null}
              </span>
            </li>
          ))}
        </ul>
      </section>

      {podeCancelar ? (
        <Button variant="outline" onClick={() => cancelar.mutate(id)}>
          Cancelar envios pendentes
        </Button>
      ) : null}
    </div>
  );
}

function Item({ rotulo, valor, hint }: { rotulo: string; valor: number; hint?: string }) {
  return (
    <div className="rounded-[12px] bg-[var(--color-surface)] p-3 shadow-[var(--shadow-sm)] ring-1 ring-[var(--color-border)]">
      <dt className="text-xs text-[var(--color-text-muted)]">{rotulo}</dt>
      <dd className="text-lg font-semibold tabular-nums text-[var(--color-text)]">{valor}</dd>
      {hint ? <p className="mt-1 text-[10px] text-[var(--color-text-muted)]">{hint}</p> : null}
    </div>
  );
}
