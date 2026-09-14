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
import { previewDaCampanha } from "@/lib/campanhas/preview";
import { StatusBadge } from "@/components/ds/StatusBadge";
import { AppCard } from "@/components/ds/AppCard";

export function CampanhaDetalheClient({ id }: { id: string }) {
  const camp = useCampanha(id);
  const dests = useDestinatarios(id);
  const cancelar = useCancelarCampanha();

  if (camp.isLoading) return <p className="text-sm text-muted-foreground">Carregando…</p>;
  if (!camp.data) return <p className="text-sm text-destructive">Campanha não encontrada.</p>;

  const m = camp.data.metricas;
  const settings = lerSettings(camp.data.settings);
  const vis = statusVisual(camp.data.status, settings);
  const total = m.destinatarios || m.enviadas + m.pendentes + m.puladas + m.falharam + m.ignoradas;
  const podeCancelar = camp.data.status === "running" || camp.data.status === "scheduled" || vis === "preparing";
  const taxaResposta = m.enviadas > 0 ? Math.round((m.respondidas / m.enviadas) * 100) : null;
  const taxaEntrega = m.enviadas > 0 && m.entregues > 0 ? Math.round((m.entregues / m.enviadas) * 100) : null;
  const preview = previewDaCampanha({
    template: camp.data.body_text,
    valores: { nome: "Maria", telefone: "", email: "" },
  });
  const anexos = settings.attachments ?? [];

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
            Preparando a fila de destinatários…
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
        <Item
          rotulo="Entregues"
          valor={m.entregues}
          hint={m.entregues === 0 ? "O canal desta campanha não informa entrega" : taxaEntrega != null ? `${taxaEntrega}% das enviadas` : undefined}
        />
        <Item
          rotulo="Lidas"
          valor={m.lidas}
          hint={m.lidas === 0 ? "O canal desta campanha não informa leitura" : undefined}
        />
        <Item
          rotulo="Respostas"
          valor={m.respondidas}
          hint={taxaResposta != null ? `${taxaResposta}% responderam` : "Ainda sem envio"}
        />
        <Item rotulo="Falharam" valor={m.falharam} />
        <Item rotulo="Ignoradas" valor={m.ignoradas} />
        <Item rotulo="Opt-outs" valor={m.opt_outs} />
      </dl>

      <AppCard>
        <p className="text-xs uppercase tracking-wide text-[var(--color-text-muted)]">O que foi enviado</p>
        <p className="mt-2 whitespace-pre-wrap text-sm leading-relaxed">{preview.texto || camp.data.body_text}</p>
        {anexos.length > 0 ? (
          <ul className="mt-3 space-y-1 text-xs text-[var(--color-text-muted)]">
            {anexos.map((a) => (
              <li key={a.storage_path}>
                {a.kind === "image" ? "Imagem" : a.kind === "video" ? "Vídeo" : "Documento"} · {a.filename}
              </li>
            ))}
          </ul>
        ) : null}
      </AppCard>

      <section>
        <h2 className="text-sm font-medium">Quem recebeu</h2>
        <ul className="mt-2 divide-y rounded-lg border border-border" data-testid="campanha-destinatarios">
          {(dests.data ?? []).map((d) => (
            <li key={d.id} className="flex flex-col gap-1 p-3 text-sm md:flex-row md:items-center md:justify-between">
              <span className="min-w-0 truncate">
                <span className="font-medium">{d.nome || "Contato"}</span>
                <span className="text-[var(--color-text-muted)]">
                  {" "}
                  · {d.destination ?? d.phone ?? ""}
                  {d.channel ? ` · ${d.channel === "email" ? "E-mail" : "WhatsApp"}` : ""}
                </span>
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
