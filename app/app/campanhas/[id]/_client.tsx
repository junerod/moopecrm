"use client";

import { useMemo, useState } from "react";
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
import { rotuloDoObjetivo } from "@/lib/campanhas/objetivo";
import { ROTULO_DA_TEMPERATURA, ROTULO_DO_PAPEL } from "@/lib/crm/papel-e-temperatura";
import type { SegmentoDaCampanha } from "@/lib/campanhas/tipos";
import { PainelDeAjuda } from "@/components/ajuda/PainelDeAjuda";
import { StatusBadge } from "@/components/ds/StatusBadge";
import { AppCard } from "@/components/ds/AppCard";
import { MetricCard } from "@/components/ds/MetricCard";
import { PageHeader } from "@/components/ds/PageHeader";
import { AppIcon } from "@/components/ds/AppIcon";
import { ChatCircle, Checks, Megaphone, PaperPlaneTilt, Warning } from "@/lib/ui/icons";

type FiltroDest = "todos" | "enviados" | "respostas" | "falhas" | "ignorados";

export function CampanhaDetalheClient({ id }: { id: string }) {
  const camp = useCampanha(id);
  const dests = useDestinatarios(id);
  const cancelar = useCancelarCampanha();
  const [filtro, setFiltro] = useState<FiltroDest>("todos");

  const linhas = dests.data ?? [];
  const filtradas = useMemo(() => {
    return linhas.filter((d) => {
      if (filtro === "enviados") return ["sent", "delivered", "read", "replied"].includes(d.status);
      if (filtro === "respostas") return d.status === "replied" || !!d.resposta;
      if (filtro === "falhas") return d.status === "failed";
      if (filtro === "ignorados") return d.status === "skipped" || d.status === "cancelled";
      return true;
    });
  }, [linhas, filtro]);

  const respostas = useMemo(
    () =>
      linhas.filter((d) => d.status === "replied" || d.resposta).sort((a, b) => {
        const ta = a.resposta_em ?? a.replied_at ?? "";
        const tb = b.resposta_em ?? b.replied_at ?? "";
        return tb.localeCompare(ta);
      }),
    [linhas],
  );

  if (camp.isLoading) {
    return <p className="text-sm text-[var(--color-text-muted)]">Abrindo a campanha…</p>;
  }
  if (camp.isError || !camp.data) {
    return (
      <div className="space-y-3" data-testid="campanha-resultado">
        <Link href="/app/campanhas" className="text-xs text-[var(--color-text-muted)] hover:underline">
          ← Campanhas
        </Link>
        <p className="text-sm text-destructive">
          Não consegui abrir esta campanha.
          {camp.error instanceof Error ? ` ${camp.error.message}` : ""}
        </p>
      </div>
    );
  }

  const m = camp.data.metricas;
  const settings = lerSettings(camp.data.settings);
  const vis = statusVisual(camp.data.status, settings);
  const total = m.destinatarios || m.enviadas + m.pendentes + m.puladas + m.falharam + m.ignoradas;
  const podeCancelar = camp.data.status === "running" || camp.data.status === "scheduled" || vis === "preparing";
  const taxaResposta = m.enviadas > 0 ? Math.round((m.respondidas / m.enviadas) * 100) : null;
  const taxaEnvio = total > 0 ? Math.round((m.enviadas / total) * 100) : null;
  const canal =
    settings.channels === "ambos"
      ? "WhatsApp + e-mail"
      : settings.channels === "email"
        ? "E-mail"
        : "WhatsApp";
  const anexos = settings.attachments ?? [];
  const porCanal = m.por_canal;

  return (
    <div className="space-y-6" data-testid="campanha-resultado">
      <PageHeader
        icon={<AppIcon icon={Megaphone} tone="violet" size="lg" />}
        titulo={camp.data.name}
        descricao={`${rotuloDoObjetivo(settings.objective)} · ${canal}`}
        acoes={
          <div className="flex flex-wrap items-center gap-2">
            <StatusBadge tone={tomStatusCampanha(vis)}>{rotuloStatusCampanha(vis)}</StatusBadge>
            <Button variant="outline" size="sm" asChild>
              <Link href="/app/campanhas">Voltar</Link>
            </Button>
            {podeCancelar ? (
              <Button
                variant="outline"
                size="sm"
                data-testid="campanha-cancelar"
                onClick={() => cancelar.mutate(id)}
              >
                Cancelar envios
              </Button>
            ) : null}
          </div>
        }
      />
      <p className="sr-only" data-testid="campanha-status">
        {vis}
      </p>
      {settings.preparing ? (
        <p className="text-sm" data-testid="campanha-preparando">
          Preparando a fila de destinatários…
        </p>
      ) : null}
      {linhas.some((d) => d.error === "mock_nao_enviou") ? (
        <AppCard testid="campanha-nao-saiu">
          <p className="text-sm font-medium">Esta campanha não saiu no WhatsApp.</p>
          <p className="mt-1 text-xs leading-relaxed text-[var(--color-text-muted)]">
            Foi um envio de prova. Nada chegou no celular.
          </p>
        </AppCard>
      ) : null}
      {linhas.some((d) => d.error === "sem_conversa_no_numero") ? (
        <AppCard testid="campanha-sem-conversa">
          <p className="text-sm font-medium">Alguns contatos ainda não têm conversa neste número.</p>
          <p className="mt-1 text-xs leading-relaxed text-[var(--color-text-muted)]">
            A campanha não abre fio frio. Abra Nova conversa na caixa com esses
            contatos e dispare de novo. Quem já falou neste WhatsApp recebe.
          </p>
        </AppCard>
      ) : null}

      <PainelDeAjuda
        testid="campanha-ajuda-detalhe"
        titulo="Como ler este resultado"
        texto="Enviado saiu no WhatsApp. Respondeu é resposta depois do envio. Ignorado ficou de fora — o motivo está na linha. Sem conversa neste número: abra Nova conversa na caixa e só então dispare de novo."
        href="/app/manual#campanhas"
        rotuloDoLink="Guia de campanhas"
      />

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4" data-testid="campanha-metricas">
        <MetricCard
          icon={PaperPlaneTilt}
          tone="blue"
          label="Enviadas"
          value={String(m.enviadas)}
          delta={
            <p className="mt-2 text-xs text-[var(--color-text-muted)]" data-testid="campanha-progresso">
              {m.enviadas} / {total || 0}
              {taxaEnvio != null ? ` · ${taxaEnvio}% da fila` : ""}
            </p>
          }
        />
        <MetricCard
          icon={ChatCircle}
          tone="green"
          label="Respostas"
          value={String(m.respondidas)}
          delta={
            <p className="mt-2 text-xs text-[var(--color-text-muted)]">
              {taxaResposta != null ? `${taxaResposta}% de quem recebeu` : "Ainda sem resposta"}
            </p>
          }
        />
        <MetricCard
          icon={Checks}
          tone="teal"
          label="Na fila / lidas"
          value={`${m.pendentes} · ${m.lidas}`}
          delta={
            <p className="mt-2 text-xs text-[var(--color-text-muted)]">
              {m.lidas === 0 ? "Leitura só se o canal informar" : "Lidas pelo contato"}
            </p>
          }
        />
        <MetricCard
          icon={Warning}
          tone="amber"
          label="Falhas + ignoradas"
          value={String(m.falharam + m.ignoradas)}
          delta={
            <p className="mt-2 text-xs text-[var(--color-text-muted)]">
              {m.falharam} falharam · {m.ignoradas} de fora · {m.opt_outs} opt-out
            </p>
          }
        />
      </div>

      {respostas.length > 0 ? (
        <AppCard>
          <p className="text-xs uppercase tracking-wide text-[var(--color-text-muted)]">
            O que voltou
          </p>
          <ul className="mt-3 space-y-3" data-testid="campanha-respostas">
            {respostas.slice(0, 8).map((d) => (
              <li key={d.id} className="rounded-lg bg-[var(--color-bg)] px-3 py-2.5">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <Link
                    href={d.conversation_id ? `/app/inbox?id=${d.conversation_id}` : `/app/contacts/${d.contact_id}`}
                    className="text-sm font-medium hover:underline"
                  >
                    {d.nome || "Contato"}
                  </Link>
                  <span className="text-[11px] text-[var(--color-text-muted)]">
                    {d.resposta_em || d.replied_at ? quando(d.resposta_em ?? d.replied_at!) : "Respondeu"}
                  </span>
                </div>
                <p className="mt-1 whitespace-pre-wrap text-sm leading-relaxed text-[var(--color-text)]">
                  {d.resposta || "Respondeu — abra a conversa para ler."}
                </p>
              </li>
            ))}
          </ul>
          {respostas.length > 8 ? (
            <p className="mt-2 text-xs text-[var(--color-text-muted)]">
              +{respostas.length - 8} respostas nesta campanha. Use o filtro abaixo.
            </p>
          ) : null}
        </AppCard>
      ) : vis === "completed" || vis === "running" ? (
        <AppCard>
          <p className="text-sm text-[var(--color-text-muted)]">
            Ainda ninguém respondeu esta campanha. Quando alguém responder no WhatsApp, a
            conversa aparece aqui e na caixa de entrada.
          </p>
        </AppCard>
      ) : null}

      <div className="grid gap-4 lg:grid-cols-2">
        <AppCard>
          <p className="text-xs uppercase tracking-wide text-[var(--color-text-muted)]">
            O que foi enviado
          </p>
          <p className="mt-3 whitespace-pre-wrap text-sm leading-relaxed text-[var(--color-text)]">
            {camp.data.body_text || "Sem texto."}
          </p>
          <p className="mt-2 text-[11px] text-[var(--color-text-muted)]">
            {`{{nome}}`} vira o nome de cada contato na hora do envio.
          </p>
          {anexos.length > 0 ? (
            <ul className="mt-3 space-y-2">
              {anexos.map((a) => (
                <li key={a.storage_path} className="overflow-hidden rounded-lg bg-[var(--color-bg)]">
                  {a.kind === "image" && a.preview_url ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={a.preview_url} alt={a.filename} className="max-h-48 w-full object-cover" />
                  ) : null}
                  <p className="px-2 py-1.5 text-xs text-[var(--color-text-muted)]">
                    {a.kind === "image" ? "Imagem" : a.kind === "video" ? "Vídeo" : "Documento"} ·{" "}
                    {a.filename}
                  </p>
                </li>
              ))}
            </ul>
          ) : (
            <p className="mt-3 text-xs text-[var(--color-text-muted)]">Sem mídia anexada.</p>
          )}
          {settings.cta_label ? (
            <p className="mt-3 text-sm font-medium">
              Botão: {settings.cta_label}
              {settings.cta_url ? ` → ${settings.cta_url}` : ""}
            </p>
          ) : null}
        </AppCard>

        <AppCard>
          <p className="text-xs uppercase tracking-wide text-[var(--color-text-muted)]">
            Para o gestor
          </p>
          <dl className="mt-3 space-y-2 text-sm">
            <Linha rotulo="Público" valor={rotuloPublico(camp.data.segment)} />
            <Linha rotulo="Canal" valor={canal} />
            {porCanal?.whatsapp || porCanal?.email ? (
              <Linha
                rotulo="Por canal"
                valor={[
                  porCanal.whatsapp
                    ? `WhatsApp ${porCanal.whatsapp.enviadas} env. / ${porCanal.whatsapp.falharam} falhas`
                    : null,
                  porCanal.email
                    ? `E-mail ${porCanal.email.enviadas} env. / ${porCanal.email.falharam} falhas`
                    : null,
                ]
                  .filter(Boolean)
                  .join(" · ")}
              />
            ) : null}
            <Linha
              rotulo="Quando"
              valor={
                camp.data.scheduled_at
                  ? `Agendada para ${quando(camp.data.scheduled_at)}`
                  : camp.data.started_at
                    ? `Enviou ${quando(camp.data.started_at)}`
                    : "Ainda não disparou"
              }
            />
            <Linha
              rotulo="Encerrou"
              valor={camp.data.finished_at ? quando(camp.data.finished_at) : "—"}
            />
            <Linha rotulo="Destinatários" valor={String(m.destinatarios)} />
            <Linha
              rotulo="Entrega"
              valor={
                m.entregues > 0
                  ? `${m.entregues} confirmadas`
                  : m.enviadas > 0
                    ? "Canal não confirma entrega neste envio"
                    : "Ainda sem envio"
              }
            />
          </dl>
        </AppCard>
      </div>

      <section>
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 className="text-sm font-medium">Quem entrou nesta campanha</h2>
          <div className="flex flex-wrap gap-1">
            {(
              [
                ["todos", `Todos (${linhas.length})`],
                ["enviados", "Enviados"],
                ["respostas", `Responderam (${respostas.length})`],
                ["falhas", "Falharam"],
                ["ignorados", "De fora"],
              ] as const
            ).map(([fid, rotulo]) => (
              <button
                key={fid}
                type="button"
                onClick={() => setFiltro(fid)}
                className={`rounded-full px-2.5 py-1 text-xs ${
                  filtro === fid
                    ? "bg-[var(--color-accent)] text-white"
                    : "bg-[var(--color-surface)] text-[var(--color-text-muted)] ring-1 ring-[var(--color-border)]"
                }`}
              >
                {rotulo}
              </button>
            ))}
          </div>
        </div>
        <ul
          className="mt-3 divide-y divide-[var(--color-border)] overflow-hidden rounded-[12px] bg-[var(--color-surface)] ring-1 ring-[var(--color-border)]"
          data-testid="campanha-destinatarios"
        >
          {filtradas.length === 0 ? (
            <li className="p-4 text-sm text-[var(--color-text-muted)]">
              {linhas.length === 0
                ? "Ainda não há destinatários nesta campanha."
                : "Ninguém neste recorte."}
            </li>
          ) : (
            filtradas.map((d) => (
              <li
                key={d.id}
                className="flex flex-col gap-1 px-4 py-3 text-sm md:flex-row md:items-start md:justify-between"
              >
                <span className="min-w-0">
                  <Link
                    href={
                      d.conversation_id
                        ? `/app/inbox?id=${d.conversation_id}`
                        : `/app/contacts/${d.contact_id}`
                    }
                    className="font-medium text-[var(--color-text)] hover:underline"
                  >
                    {d.nome || "Contato"}
                  </Link>
                  <span className="block truncate text-xs text-[var(--color-text-muted)]">
                    {d.channel === "email" ? "E-mail" : "WhatsApp"}
                    {d.destination || d.phone ? ` · ${d.destination ?? d.phone}` : ""}
                    {d.sent_at ? ` · ${quando(d.sent_at)}` : ""}
                  </span>
                  {d.resposta ? (
                    <span className="mt-1 block text-xs leading-relaxed text-[var(--color-text)]">
                      Respondeu: {d.resposta}
                    </span>
                  ) : null}
                </span>
                <span className="flex flex-wrap items-center gap-2">
                  <StatusBadge tone={tomDoDestinatario(d.status)}>
                    <span data-status={d.status}>{rotuloStatusDestinatario(d.status)}</span>
                  </StatusBadge>
                  {d.error ? (
                    <span className="text-xs text-[var(--color-text-muted)]">
                      {rotuloMotivoPulo(d.error)}
                    </span>
                  ) : null}
                </span>
              </li>
            ))
          )}
        </ul>
      </section>
    </div>
  );
}

function Linha({ rotulo, valor }: { rotulo: string; valor: string }) {
  return (
    <div className="flex justify-between gap-3">
      <dt className="text-[var(--color-text-muted)]">{rotulo}</dt>
      <dd className="text-right font-medium">{valor}</dd>
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

function rotuloPublico(segment: unknown): string {
  if (!segment || typeof segment !== "object") return "Recorte da base";
  const s = segment as SegmentoDaCampanha;
  const partes: string[] = [];
  if (s.contact_ids?.length) partes.push(`${s.contact_ids.length} pessoas escolhidas`);
  if (s.papel && s.papel in ROTULO_DO_PAPEL) {
    partes.push(ROTULO_DO_PAPEL[s.papel as keyof typeof ROTULO_DO_PAPEL]);
  } else if (s.papel) {
    partes.push(s.papel);
  }
  if (s.temperatura && s.temperatura in ROTULO_DA_TEMPERATURA) {
    partes.push(ROTULO_DA_TEMPERATURA[s.temperatura as keyof typeof ROTULO_DA_TEMPERATURA]);
  } else if (s.temperatura) {
    partes.push(s.temperatura);
  }
  if (s.tags?.length) partes.push(s.tags.join(", "));
  return partes.length ? partes.join(" · ") : "Recorte da base";
}

function tomDoDestinatario(status: string): "green" | "blue" | "amber" | "red" | "indigo" {
  if (status === "replied" || status === "read" || status === "delivered") return "green";
  if (status === "sent" || status === "pending") return "blue";
  if (status === "failed") return "red";
  return "amber";
}
