"use client";

import Link from "next/link";
import { useState, type ReactNode } from "react";

import { AlertRow } from "@/components/ds/AlertRow";
import { AppCard } from "@/components/ds/AppCard";
import { AppIcon } from "@/components/ds/AppIcon";
import { MetricCard } from "@/components/ds/MetricCard";
import { SectionHeader } from "@/components/ds/SectionHeader";
import { StatusBadge } from "@/components/ds/StatusBadge";
import { useHomeSnapshot } from "@/hooks/home/useHomeSnapshot";
import {
  deltaAbsoluto,
  deltaEspera,
  deltaPercentual,
  deltaPontos,
  esperaAnomala,
  formatarConversaoFina,
  formatarEspera,
  formatarValorEtapa,
  primeiroNome,
  saudacaoDoDia,
  type DeltaExibido,
} from "@/lib/home/formatar";
import { insightsDoSnapshot } from "@/lib/home/insights";
import type { AcaoDaHome, EtapaDoFunilDaHome, SnapshotDaHome } from "@/lib/home/tipos";
import type { PeriodoPronto } from "@/lib/supervisao/periodo";
import {
  Buildings,
  ChatCircle,
  CheckCircle,
  Clock,
  Fire,
  Funnel,
  Headset,
  Lightbulb,
  Lightning,
  Megaphone,
  Pulse,
  TrendUp,
  Trophy,
  UsersThree,
  Warning,
} from "@/lib/ui/icons";
import { cn } from "@/lib/utils";

import { ChecklistCompacto, type ItemDoSetup } from "./ChecklistCompacto";
import { HomeHoje } from "./HomeHoje";

const PASTEL_FUNIL = [
  "var(--funnel-1)",
  "var(--funnel-2)",
  "var(--funnel-3)",
  "var(--funnel-4)",
  "var(--funnel-5)",
];

function PeriodoPills({
  periodo,
  onChange,
}: {
  periodo: PeriodoPronto;
  onChange: (p: PeriodoPronto) => void;
}) {
  return (
    <div className="flex flex-wrap items-center gap-1" data-testid="home-periodo">
      {(["hoje", "7d", "30d"] as const).map((p) => (
        <button
          key={p}
          type="button"
          onClick={() => onChange(p)}
          data-testid={`home-periodo-${p}`}
          aria-pressed={periodo === p}
          className={cn(
            "rounded-full px-3 py-1 text-[12px] font-medium transition-colors duration-150",
            "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--moope-primary)]",
            periodo === p
              ? "bg-[var(--moope-primary)] text-white"
              : "text-[var(--color-text-muted)] hover:bg-[var(--color-surface)] hover:text-[var(--color-text)]",
          )}
        >
          {p === "hoje" ? "Hoje" : p === "7d" ? "7 dias" : "30 dias"}
        </button>
      ))}
    </div>
  );
}

function segundosMaisAntiga(acoes: AcaoDaHome[]): number | null {
  let max = 0;
  const agora = Date.now();
  for (const a of acoes) {
    if (a.estado !== "atrasada" || !a.em) continue;
    const t = new Date(a.em).getTime();
    if (Number.isNaN(t)) continue;
    max = Math.max(max, agora - t);
  }
  return max > 0 ? Math.round(max / 1000) : null;
}

function iniciais(nome: string): string {
  const partes = nome.trim().split(/\s+/);
  const a = partes[0]?.[0] ?? "";
  const b = partes[1]?.[0] ?? "";
  return (a + b).toUpperCase() || "?";
}

function Delta({ d }: { d: DeltaExibido | null }) {
  if (!d) return null;
  return (
    <p
      className={cn(
        "mt-1.5 text-[12px] leading-snug",
        d.sentido === "alta" && "text-[var(--color-success-fg)]",
        d.sentido === "baixa" && "text-[var(--color-error-fg)]",
        d.sentido === "neutro" && "text-[var(--color-text-muted)]",
      )}
    >
      {d.texto}
    </p>
  );
}

function KpiRow({ snap }: { snap: SnapshotDaHome }) {
  const c = snap.commercial;
  const ant = c?.vs_anterior;
  const leads = c?.leads_novos ?? 0;
  const ganhos = c?.ganhos ?? 0;
  const conv = c?.conversao ?? null;
  const resp = snap.team?.primeira_resposta_media_s ?? null;
  const itens = [
    {
      label: "Novos leads",
      valor: String(leads),
      tone: "blue" as const,
      icon: TrendUp,
      delta: ant ? deltaPercentual(leads, ant.leads_novos) : null,
    },
    {
      label: "Conversão",
      valor: formatarConversaoFina(conv),
      tone: "green" as const,
      icon: Funnel,
      delta: ant ? deltaPontos(conv, ant.conversao) : null,
    },
    {
      label: "Ganhos",
      valor: String(ganhos),
      tone: "amber" as const,
      icon: Trophy,
      delta: ant ? deltaAbsoluto(ganhos, ant.ganhos) : null,
    },
    {
      label: "1ª resposta",
      valor: formatarEspera(resp),
      tone: "violet" as const,
      icon: Clock,
      delta: ant ? deltaEspera(resp, ant.primeira_resposta_media_s) : null,
    },
  ];
  return (
    <div data-testid="home-kpis" className="grid grid-cols-2 gap-3 lg:grid-cols-4">
      {itens.map((item) => (
        <MetricCard
          key={item.label}
          icon={item.icon}
          tone={item.tone}
          label={item.label}
          value={item.valor}
          delta={<Delta d={item.delta} />}
        />
      ))}
    </div>
  );
}

function Prioridades({
  snap,
  funilHref,
}: {
  snap: SnapshotDaHome | undefined;
  funilHref: string;
}) {
  const p = snap?.personal;
  const team = snap?.team;
  const atrasadas = p?.atrasadas ?? 0;
  const quentes = p?.quentes_sem_acao ?? 0;
  const minhas = p?.conversas_minhas ?? 0;
  const fila = team?.fila ?? 0;
  const espera = team?.espera_mais_antiga_s ?? 0;
  const paradas = snap?.commercial?.paradas ?? 0;
  const manager = snap?.papel === "manager";
  const maisAntiga = segundosMaisAntiga(p?.acoes ?? []);
  const linhas: ReactNode[] = [];

  if (atrasadas > 0) {
    linhas.push(
      <AlertRow
        key="atrasadas"
        href="/app/agenda?visao=atrasados"
        testid="home-chip-atrasadas"
        icon={Warning}
        tone="red"
        destaque
        titulo={`${atrasadas} ${atrasadas === 1 ? "retorno vencido" : "retornos vencidos"}`}
        detalhe={maisAntiga ? `Mais antigo há ${formatarEspera(maisAntiga)}` : undefined}
        cta="Resolver agora"
      />,
    );
  }
  if (quentes > 0) {
    linhas.push(
      <AlertRow
        key="quentes"
        href={`${funilHref}${funilHref.includes("?") ? "&" : "?"}sem_acao=1&quentes=1`}
        testid="home-chip-quentes"
        icon={Fire}
        tone="amber"
        titulo={`${quentes} ${quentes === 1 ? "lead quente sem próxima ação" : "leads quentes sem próxima ação"}`}
        cta="Abrir funil"
      />,
    );
  }
  if (manager && fila > 0) {
    linhas.push(
      <AlertRow
        key="fila"
        href="/app/inbox?filter=unassigned"
        testid="home-chip-fila"
        icon={ChatCircle}
        tone="blue"
        titulo={`${fila} ${fila === 1 ? "cliente aguardando atendimento" : "clientes aguardando atendimento"}`}
        detalhe={espera > 0 ? `Mais antigo há ${formatarEspera(espera)}` : undefined}
        cta="Abrir fila"
      />,
    );
  }
  if (!manager && minhas > 0) {
    linhas.push(
      <AlertRow
        key="minhas"
        href="/app/inbox?filter=mine"
        testid="home-chip-minhas"
        icon={ChatCircle}
        tone="blue"
        titulo={`${minhas} ${minhas === 1 ? "cliente aguardando você" : "clientes aguardando você"}`}
        cta="Abrir Inbox"
      />,
    );
  }
  if (manager && paradas > 0) {
    linhas.push(
      <AlertRow
        key="paradas"
        href="/app/radar"
        icon={Lightning}
        tone="indigo"
        titulo={`${paradas} ${paradas === 1 ? "oportunidade parada" : "oportunidades paradas"}`}
        cta="Abrir Radar"
      />,
    );
  }

  const ok = linhas.length === 0;

  return (
    <AppCard testid="home-atencao" className="lg:col-span-2">
      <SectionHeader
        titulo="Prioridades de hoje"
        subtitulo="O que merece sua atenção agora."
        cta="Ver todas"
        href="/app/agenda"
        icon={<AppIcon icon={Warning} tone="red" size="sm" />}
      />
      {ok ? (
        <div className="flex items-start gap-2.5 py-1">
          <CheckCircle className="mt-0.5 h-4 w-4 text-[var(--color-success-fg)]" weight="fill" />
          <div>
            <p className="text-[14px] font-medium">Operação em dia</p>
            <p className="mt-0.5 text-[13px] text-[var(--color-text-muted)]">
              Nenhuma pendência crítica agora. Tudo em dia.
            </p>
          </div>
        </div>
      ) : (
        <div className="space-y-1">{linhas.slice(0, 5)}</div>
      )}
    </AppCard>
  );
}

function FunilSegmentado({
  etapas,
  href,
  erro,
  className,
}: {
  etapas: EtapaDoFunilDaHome[];
  href: string;
  erro?: boolean;
  className?: string;
}) {
  const comVolume = etapas.filter((e) => e.count > 0);
  const visiveis = (comVolume.length > 0 ? comVolume : etapas).slice(0, 5);
  const resto = Math.max(0, (comVolume.length > 0 ? comVolume : etapas).length - visiveis.length);

  return (
    <AppCard testid="home-funil" className={className}>
      <SectionHeader
        titulo="Pipeline de vendas"
        cta="Abrir funil"
        href={href}
        icon={<AppIcon icon={Funnel} tone="blue" size="sm" />}
      />
      {erro ? (
        <p className="text-[13px] text-[var(--color-text-muted)]">
          Funil agora indisponível temporariamente.
        </p>
      ) : comVolume.length === 0 ? (
        <p className="text-[13px] text-[var(--color-text-muted)]">Nenhuma oportunidade aberta.</p>
      ) : (
        <div>
          <div className="ds-funnel">
            {visiveis.map((e, i) => {
              const valor = formatarValorEtapa(e.value_cents);
              return (
                <Link
                  key={e.stage_id}
                  href={`/app/pipelines/${e.pipeline_id}`}
                  className="ds-funnel-seg"
                  style={{ background: PASTEL_FUNIL[i % PASTEL_FUNIL.length] }}
                >
                  <p className="truncate text-[11px] font-semibold uppercase tracking-wide text-[var(--color-text-muted)]">
                    {e.stage_name}
                  </p>
                  <p className="mt-1 text-[22px] font-bold leading-none tabular-nums text-[var(--color-text)]">
                    {e.count}
                  </p>
                  {valor ? (
                    <p className="mt-1 text-[12px] text-[var(--color-text-muted)]">{valor}</p>
                  ) : null}
                </Link>
              );
            })}
          </div>
          {resto > 0 ? (
            <Link
              href={href}
              className="mt-3 inline-block text-[12px] font-medium text-[var(--moope-primary)] hover:underline"
            >
              Ver todas
            </Link>
          ) : null}
        </div>
      )}
    </AppCard>
  );
}

function AtendimentoAgora({ snap }: { snap: SnapshotDaHome | undefined }) {
  const fila = snap?.team?.fila ?? 0;
  const espera = snap?.team?.espera_mais_antiga_s ?? 0;
  const disp = snap?.team?.disponiveis ?? 0;
  const abertas = snap?.team?.conversas_abertas ?? 0;
  const resp = snap?.team?.primeira_resposta_media_s ?? null;
  const critica = esperaAnomala(espera) || espera >= 15 * 60;

  return (
    <AppCard testid="home-atendimento">
      <SectionHeader
        titulo="Atendimento agora"
        cta="Abrir Inbox"
        href="/app/inbox?filter=unassigned"
        icon={<AppIcon icon={Headset} tone="indigo" size="sm" />}
      />
      {snap?.sources.team === "error" ? (
        <p className="text-[13px] text-[var(--color-text-muted)]">
          Atendimento agora indisponível temporariamente.
        </p>
      ) : (
        <div>
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="text-[36px] font-bold leading-none tabular-nums text-[var(--color-text)]">
                {fila}
              </p>
              <p className="mt-1 text-[13px] text-[var(--color-text-muted)]">aguardando</p>
            </div>
            {espera > 0 ? (
              <Link
                href="/app/inbox?filter=unassigned"
                data-testid="home-chip-espera"
                aria-label={`${formatarEspera(espera)} maior espera`}
                className={cn(
                  "rounded-lg px-2.5 py-2 text-right transition-colors duration-150",
                  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--moope-primary)]",
                  critica ? "bg-[var(--color-error-bg)]" : "bg-[var(--color-surface-elevated)]",
                )}
              >
                <p className="text-[11px] text-[var(--color-text-muted)]">Maior espera</p>
                <p
                  title={esperaAnomala(espera) ? `Espera anômala: ${formatarEspera(espera)}` : undefined}
                  className={cn(
                    "mt-0.5 text-[18px] font-bold tabular-nums",
                    critica ? "text-[var(--color-error-fg)]" : "text-[var(--color-text)]",
                  )}
                >
                  {formatarEspera(espera)}
                </p>
              </Link>
            ) : null}
          </div>
          <dl className="mt-4 grid grid-cols-3 gap-2 border-t border-[var(--color-border)] pt-3">
            <div>
              <dt className="text-[11px] text-[var(--color-text-muted)]">disponíveis</dt>
              <dd className="mt-0.5 text-[15px] font-semibold tabular-nums">{disp}</dd>
            </div>
            <div>
              <dt className="text-[11px] text-[var(--color-text-muted)]">abertas</dt>
              <dd className="mt-0.5 text-[15px] font-semibold tabular-nums">{abertas}</dd>
            </div>
            <div>
              <dt className="text-[11px] text-[var(--color-text-muted)]">1ª resposta</dt>
              <dd className="mt-0.5 text-[15px] font-semibold tabular-nums">{formatarEspera(resp)}</dd>
            </div>
          </dl>
        </div>
      )}
    </AppCard>
  );
}

function Pulso({ snap }: { snap: SnapshotDaHome }) {
  const frases = insightsDoSnapshot(snap);
  const com = snap.commercial;
  if (frases.length === 0 && snap.papel !== "manager") return null;
  return (
    <AppCard
      testid="home-pulso"
      className="relative overflow-hidden bg-[var(--moope-primary-bg)] ring-[color-mix(in_srgb,var(--moope-primary)_18%,transparent)]"
    >
      <Lightbulb
        aria-hidden
        size={88}
        weight="duotone"
        className="pointer-events-none absolute -right-2 -top-2 text-[var(--moope-primary)] opacity-[0.12]"
      />
      <SectionHeader
        titulo="Pulso comercial"
        icon={<AppIcon icon={Pulse} tone="blue" size="sm" />}
      />
      {frases.length === 0 ? (
        <p className="text-[13px] text-[var(--color-text-muted)]">
          Sem alerta factual neste período.
        </p>
      ) : (
        <ul className="relative space-y-2">
          {frases.slice(0, 4).map((f) => (
            <li key={f.texto} className="text-[14px] leading-snug text-[var(--color-text)]">
              {f.texto}
            </li>
          ))}
        </ul>
      )}
      {snap.papel === "manager" && com ? (
        <ul
          data-testid="hoje-supervisor"
          className="mt-4 flex flex-wrap gap-x-5 gap-y-1 border-t border-[color-mix(in_srgb,var(--moope-primary)_16%,transparent)] pt-3 text-[13px] text-[var(--color-text-muted)]"
        >
          <li>
            <strong className="mr-1 tabular-nums text-[var(--color-text)]">{com.sem_proxima_acao}</strong>
            sem próxima ação
          </li>
          <li>
            <strong className="mr-1 tabular-nums text-[var(--color-text)]">{com.paradas ?? 0}</strong>
            paradas
          </li>
          <li>
            <strong className="mr-1 tabular-nums text-[var(--color-text)]">{com.atrasadas}</strong>
            atrasadas
          </li>
        </ul>
      ) : snap.papel === "manager" ? (
        <div data-testid="hoje-supervisor" className="sr-only">
          Comercial
        </div>
      ) : null}
    </AppCard>
  );
}

function Equipe({ snap }: { snap: SnapshotDaHome }) {
  const pessoas = (snap.team?.pessoas ?? []).slice(0, 4);
  return (
    <AppCard testid="home-equipe">
      <SectionHeader
        titulo="Equipe de atendimento"
        href="/app/team"
        cta="Ver equipe"
        icon={<AppIcon icon={UsersThree} tone="teal" size="sm" />}
      />
      {pessoas.length === 0 ? (
        <p className="text-[13px] text-[var(--color-text-muted)]">Sem roster no momento.</p>
      ) : (
        <ul className="space-y-2.5">
          {pessoas.map((pessoa) => (
            <li key={pessoa.user_id} className="flex items-center gap-2.5">
              <span className="relative">
                <span
                  aria-hidden
                  className="flex h-8 w-8 items-center justify-center rounded-full bg-[var(--moope-primary-bg)] text-[11px] font-semibold text-[var(--moope-primary)]"
                >
                  {iniciais(pessoa.nome)}
                </span>
                <span
                  aria-hidden
                  className={cn(
                    "absolute -bottom-0.5 -right-0.5 h-2.5 w-2.5 rounded-full ring-2 ring-[var(--color-surface)]",
                    pessoa.disponivel ? "bg-[var(--color-success)]" : "bg-[var(--color-neutral-400)]",
                  )}
                />
              </span>
              <span className="min-w-0 flex-1">
                <span className="block truncate text-[13px] font-medium">{pessoa.nome}</span>
                <span className="text-[12px] text-[var(--color-text-muted)]">
                  {pessoa.disponivel ? "Disponível" : "Indisponível"}
                  {pessoa.abertas > 0
                    ? ` · ${pessoa.abertas} ${pessoa.abertas === 1 ? "conversa" : "conversas"}`
                    : ""}
                </span>
              </span>
            </li>
          ))}
        </ul>
      )}
    </AppCard>
  );
}

function Campanha({ snap }: { snap: SnapshotDaHome }) {
  if (snap.sources.campaigns === "error") {
    return (
      <AppCard testid="home-campanha">
        <p className="text-[13px] text-[var(--color-text-muted)]">
          Campanha indisponível temporariamente.
        </p>
      </AppCard>
    );
  }
  if (!snap.campaigns) {
    return (
      <AppCard testid="home-campanha">
        <SectionHeader
          titulo="Última campanha"
          href="/app/campanhas"
          cta="Ver campanhas"
          icon={<AppIcon icon={Megaphone} tone="violet" size="sm" />}
        />
        <p className="text-[13px] text-[var(--color-text-muted)]">Nenhuma campanha recente.</p>
      </AppCard>
    );
  }
  const c = snap.campaigns;
  const taxa = c.enviados > 0 ? ((c.respostas / c.enviados) * 100).toFixed(1).replace(".", ",") : null;
  const progresso = c.enviados > 0 ? Math.min(100, Math.round((c.respostas / c.enviados) * 100)) : 0;
  return (
    <AppCard testid="home-campanha">
      <SectionHeader
        titulo="Última campanha"
        href={`/app/campanhas/${c.id}`}
        cta="Ver campanhas"
        icon={<AppIcon icon={Megaphone} tone="violet" size="sm" />}
      />
      <div className="flex items-start justify-between gap-2">
        <p className="text-[14px] font-semibold">{c.name}</p>
        {c.status ? (
          <StatusBadge tone={c.status === "running" ? "green" : "blue"}>
            {c.status === "running" ? "Em andamento" : "Concluída"}
          </StatusBadge>
        ) : null}
      </div>
      <dl className="mt-3 grid grid-cols-3 gap-2 text-center">
        <div>
          <dt className="text-[11px] text-[var(--color-text-muted)]">enviados</dt>
          <dd className="text-[16px] font-semibold tabular-nums">{c.enviados}</dd>
        </div>
        <div>
          <dt className="text-[11px] text-[var(--color-text-muted)]">respondidos</dt>
          <dd className="text-[16px] font-semibold tabular-nums">{c.respostas}</dd>
        </div>
        <div>
          <dt className="text-[11px] text-[var(--color-text-muted)]">resposta</dt>
          <dd className="text-[16px] font-semibold tabular-nums">{taxa ? `${taxa}%` : "—"}</dd>
        </div>
      </dl>
      <p className="mt-2 text-[12px] text-[var(--color-text-muted)]">{c.opt_outs} opt-out</p>
      {c.enviados > 0 ? (
        <div
          className="mt-3 h-1.5 overflow-hidden rounded-full bg-[var(--color-surface-elevated)]"
          aria-hidden
        >
          <div
            className="h-full rounded-full bg-[var(--moope-primary)]"
            style={{ width: `${progresso}%` }}
          />
        </div>
      ) : null}
    </AppCard>
  );
}

function BlocoHoje({
  snap,
  className,
}: {
  snap: SnapshotDaHome | undefined;
  className?: string;
}) {
  const hojeCount = snap?.personal.hoje ?? 0;
  return (
    <AppCard testid="home-hoje" className={className}>
      <SectionHeader
        titulo="Hoje"
        cta="Ver agenda"
        href="/app/agenda"
        icon={<AppIcon icon={Clock} tone="amber" size="sm" />}
      />
      <Link
        href="/app/agenda?visao=hoje"
        data-testid="home-chip-hoje"
        className="mb-2 inline-block text-[12px] text-[var(--color-text-muted)] hover:text-[var(--moope-primary)]"
      >
        {hojeCount} retornos hoje
      </Link>
      <HomeHoje acoes={snap?.personal.acoes ?? []} />
    </AppCard>
  );
}

function SkeletonHome() {
  return (
    <div className="space-y-4" aria-busy="true" aria-label="Carregando início">
      <div className="h-20 animate-pulse rounded-xl bg-[var(--color-surface-elevated)]" />
      <div className="grid gap-3 lg:grid-cols-3">
        <div className="h-40 animate-pulse rounded-xl bg-[var(--color-surface-elevated)] lg:col-span-2" />
        <div className="h-40 animate-pulse rounded-xl bg-[var(--color-surface-elevated)]" />
      </div>
    </div>
  );
}

export function HomeDashboard({
  nome,
  empresa,
  subtitulo,
  setup,
}: {
  nome?: string | null;
  empresa: string;
  subtitulo?: string;
  setup: { itens: ItemDoSetup[]; completo: boolean };
}) {
  const [periodo, setPeriodo] = useState<PeriodoPronto>("7d");
  const q = useHomeSnapshot(periodo);
  const snap = q.data;
  const funilHref = snap?.pipeline_href ?? "/app/kanban";
  const manager = snap?.papel === "manager";
  const primeiro = primeiroNome(nome);
  const contexto = [empresa, subtitulo].filter(Boolean).join(" · ");

  return (
    <div
      className="mx-auto flex w-full max-w-6xl flex-col gap-4"
      data-testid="hoje-operacional"
    >
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex min-w-0 items-start gap-3">
          <AppIcon icon={Buildings} tone="blue" size="lg" />
          <div className="min-w-0 space-y-1">
            <h1 className="sr-only">Início</h1>
            <p className="text-[28px] font-bold leading-tight tracking-tight text-[var(--color-text)]">
              {primeiro ? `${saudacaoDoDia()}, ${primeiro}` : `${saudacaoDoDia()}`}
            </p>
            <p className="text-[14px] text-[var(--color-text-muted)]">
              {manager
                ? "Aqui está o pulso comercial da sua empresa."
                : "Aqui está o que precisa da sua atenção hoje."}
            </p>
            {contexto ? (
              <p className="text-[12px] text-[var(--color-text-muted)]">{contexto}</p>
            ) : null}
          </div>
        </div>
        <div className="flex flex-col items-end gap-2">
          {manager ? <PeriodoPills periodo={periodo} onChange={setPeriodo} /> : null}
          {!setup.completo ? <ChecklistCompacto itens={setup.itens} /> : null}
        </div>
      </header>

      {q.isLoading && !snap ? (
        <SkeletonHome />
      ) : q.isError && !snap ? (
        <p className="text-[13px] text-[var(--color-error-fg)]">
          Não consegui carregar o início. Tente de novo.
        </p>
      ) : (
        <>
          {manager && snap ? <KpiRow snap={snap} /> : null}

          {manager ? (
            <>
              <div className="grid grid-cols-1 gap-3 lg:grid-cols-3">
                <Prioridades snap={snap} funilHref={funilHref} />
                <AtendimentoAgora snap={snap} />
                <FunilSegmentado
                  etapas={snap?.funnel ?? []}
                  href={funilHref}
                  erro={snap?.sources.funnel === "error"}
                  className="lg:col-span-2"
                />
                {snap ? <Pulso snap={snap} /> : null}
              </div>
              <div className="grid gap-3 md:grid-cols-3">
                <BlocoHoje snap={snap} />
                {snap ? <Equipe snap={snap} /> : null}
                {snap ? <Campanha snap={snap} /> : null}
              </div>
            </>
          ) : (
            <>
              <div className="grid grid-cols-1 gap-3 lg:grid-cols-3">
                <Prioridades snap={snap} funilHref={funilHref} />
                <BlocoHoje snap={snap} />
                <FunilSegmentado
                  etapas={snap?.funnel ?? []}
                  href={funilHref}
                  erro={snap?.sources.funnel === "error"}
                  className="lg:col-span-3"
                />
              </div>
              {snap ? <Pulso snap={snap} /> : null}
            </>
          )}
        </>
      )}
    </div>
  );
}
