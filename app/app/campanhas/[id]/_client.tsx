"use client";

import Link from "next/link";

import { useCampanha, useCancelarCampanha, useDestinatarios } from "@/hooks/campanhas/useCampanhas";

export function CampanhaDetalheClient({ id }: { id: string }) {
  const camp = useCampanha(id);
  const dests = useDestinatarios(id);
  const cancelar = useCancelarCampanha();

  if (camp.isLoading) return <p className="text-sm text-muted-foreground">Carregando…</p>;
  if (!camp.data) return <p className="text-sm text-destructive">Campanha não encontrada.</p>;

  const m = camp.data.metricas;
  return (
    <div className="space-y-6" data-testid="campanha-resultado">
      <header>
        <Link href="/app/campanhas" className="text-xs text-muted-foreground hover:underline">
          ← Campanhas
        </Link>
        <h1 className="mt-2 text-2xl font-semibold tracking-tight">{camp.data.name}</h1>
        <p className="text-sm text-muted-foreground" data-testid="campanha-status">
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
    <div className="rounded-lg border border-border p-3">
      <dt className="text-xs text-muted-foreground">{rotulo}</dt>
      <dd className="text-lg tabular-nums">{valor}</dd>
    </div>
  );
}
