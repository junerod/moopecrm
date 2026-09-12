"use client";

import Link from "next/link";
import { useState, type ReactNode } from "react";

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
import { CheckCircle, Warning } from "@/lib/ui/icons";
import { cn } from "@/lib/utils";

import { ChecklistCompacto, type ItemDoSetup } from "./ChecklistCompacto";
import { HomeHoje } from "./HomeHoje";

function Superficie({
  children,
  testid,
  elevated,
  className,
}: {
  children: ReactNode;
  testid?: string;
  elevated?: boolean;
  className?: string;
}) {
  return (
    <section
      data-testid={testid}
      className={cn(
        "rounded-xl px-4 py-3.5",
        elevated
          ? "bg-[var(--color-surface-elevated)] shadow-[var(--shadow-sm)] ring-1 ring-white/[0.07]"
          : "bg-[var(--color-surface)] ring-1 ring-white/[0.045]",
        className,
      )}
    >
      {children}
    </section>
  );
}

function CabecalhoDeBloco({
  titulo,
  subtitulo,
  cta,
  href,
}: {
  titulo: string;
  subtitulo?: string;
  cta?: string;
  href?: string;
}) {
  return (
    <header className="mb-3 flex items-start justify-between gap-3">
      <div className="min-w-0">
        <h2 className="text-[13px] font-semibold tracking-tight">{titulo}</h2>
        {subtitulo ? (
          <p className="mt-0.5 text-[12px] text-[var(--color-text-muted)]">{subtitulo}</p>
        ) : null}
      </div>
      {href && cta ? (
        <Link
          href={href}
          className="shrink-0 text-[12px] text-[var(--color-info-fg)] transition-colors duration-150 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-info)]"
        >
          {cta} →
        </Link>
      ) : null}
    </header>
  );
}

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
            "rounded-md px-2.5 py-1 text-[12px] transition-colors duration-150",
            "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-info)]",
            periodo === p
              ? "bg-[var(--color-info)]/20 text-[var(--color-info-fg)]"
              : "text-[var(--color-text-muted)] hover:text-[var(--color-text)]",
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
        "mt-1 text-[12px] leading-snug",
        d.sentido === "alta" && "text-[var(--color-success-fg)]",
        d.sentido === "baixa" && "text-[var(--color-error-fg)]",
        d.sentido === "neutro" && "text-[var(--color-text-muted)]",
      )}
    >
      {d.texto}
    </p>
  );
}

function KpiStrip({ snap }: { snap: SnapshotDaHome }) {
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
      delta: ant ? deltaPercentual(leads, ant.leads_novos) : null,
    },
    {
      label: "Conversão",
      valor: formatarConversaoFina(conv),
      delta: ant ? deltaPontos(conv, ant.conversao) : null,
    },
    {
      label: "Ganhos",
      valor: String(ganhos),
      delta: ant ? deltaAbsoluto(ganhos, ant.ganhos) : null,
    },
    {
      label: "1ª resposta",
      valor: formatarEspera(resp),
      delta: ant ? deltaEspera(resp, ant.primeira_resposta_media_s) : null,
    },
  ];
  return (
    <div
      data-testid="home-kpis"
      className="grid grid-cols-2 divide-y divide-white/[0.06] overflow-hidden rounded-xl bg-[var(--color-surface)] ring-1 ring-white/[0.045] lg:grid-cols-4 lg:divide-x lg:divide-y-0"
    >
      {itens.map((item) => (
        <div key={item.label} className="px-4 py-3.5">
          <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-[var(--color-text-muted)]">
            {item.label}
          </p>
          <p className="mt-1.5 text-[28px] font-semibold leading-none tabular-nums tracking-tight">
            {item.valor}
          </p>
          <Delta d={item.delta} />
        </div>
      ))}
    </div>
  );
}

function PrioridadeLinha({
  href,
  testid,
  tom,
  titulo,
  detalhe,
  cta,
}: {
  href: string;
  testid?: string;
  tom: "critico" | "atencao" | "aviso" | "neutro";
  titulo: string;
  detalhe?: string;
  cta: string;
}) {
  return (
    <Link
      href={href}
      data-testid={testid}
      className={cn(
        "group grid grid-cols-[0.7rem_1fr_auto] items-start gap-3 rounded-lg px-1 py-2 transition-colors duration-150",
        "hover:bg-white/[0.04] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-info)]",
      )}
    >
      <span
        aria-hidden
        className={cn(
          "mt-1.5 h-2 w-2 rounded-full",
          tom === "critico" && "bg-[var(--color-error)]",
          tom === "atencao" && "bg-[var(--color-warning)]",
          tom === "aviso" && "bg-[var(--color-info)]",
          tom === "neutro" && "bg-white/30",
        )}
      />
      <span className="min-w-0">
        <span className="block text-[14px] font-medium leading-snug">{titulo}</span>
        {detalhe ? (
          <span className="mt-0.5 block text-[12px] text-[var(--color-text-muted)]">{detalhe}</span>
        ) : null}
      </span>
      <span className="pt-0.5 text-[12px] text-[var(--color-info-fg)] opacity-80 group-hover:opacity-100">
        {cta}
      </span>
    </Link>
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
      <PrioridadeLinha
        key="atrasadas"
        href="/app/agenda?visao=atrasados"
        testid="home-chip-atrasadas"
        tom="critico"
        titulo={`${atrasadas} ${atrasadas === 1 ? "ação atrasada" : "ações atrasadas"}`}
        detalhe={maisAntiga ? `Mais antiga há ${formatarEspera(maisAntiga)}` : undefined}
        cta="Resolver"
      />,
    );
  }
  if (quentes > 0) {
    linhas.push(
      <PrioridadeLinha
        key="quentes"
        href={`${funilHref}${funilHref.includes("?") ? "&" : "?"}sem_acao=1&quentes=1`}
        testid="home-chip-quentes"
        tom="atencao"
        titulo={`${quentes} ${quentes === 1 ? "lead quente sem próxima ação" : "leads quentes sem próxima ação"}`}
        cta="Abrir funil"
      />,
    );
  }
  if (manager && fila > 0) {
    linhas.push(
      <PrioridadeLinha
        key="fila"
        href="/app/inbox?filter=unassigned"
        testid="home-chip-fila"
        tom="aviso"
        titulo={`${fila} ${fila === 1 ? "cliente aguardando atendimento" : "clientes aguardando atendimento"}`}
        detalhe={espera > 0 ? `Mais antigo há ${formatarEspera(espera)}` : undefined}
        cta="Abrir fila"
      />,
    );
  }
  if (!manager && minhas > 0) {
    linhas.push(
      <PrioridadeLinha
        key="minhas"
        href="/app/inbox?filter=mine"
        testid="home-chip-minhas"
        tom="aviso"
        titulo={`${minhas} ${minhas === 1 ? "cliente aguardando você" : "clientes aguardando você"}`}
        cta="Abrir Inbox"
      />,
    );
  }
  if (manager && paradas > 0) {
    linhas.push(
      <PrioridadeLinha
        key="paradas"
        href="/app/radar"
        tom="neutro"
        titulo={`${paradas} ${paradas === 1 ? "oportunidade parada" : "oportunidades paradas"}`}
        cta="Abrir Radar"
      />,
    );
  }

  const ok = linhas.length === 0;

  return (
    <Superficie testid="home-atencao" elevated className="order-1 lg:col-span-2">
      <CabecalhoDeBloco titulo="Prioridades" subtitulo="O que merece sua atenção agora." />
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
        <div className="divide-y divide-white/[0.05]">{linhas.slice(0, 5)}</div>
      )}
    </Superficie>
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
    <Superficie testid="home-funil" className={className}>
      <CabecalhoDeBloco titulo="Pipeline" cta="Abrir funil" href={href} />
      {erro ? (
        <p className="text-[13px] text-[var(--color-text-muted)]">
          Funil agora indisponível temporariamente.
        </p>
      ) : comVolume.length === 0 ? (
        <p className="text-[13px] text-[var(--color-text-muted)]">Nenhuma oportunidade aberta.</p>
      ) : (
        <div>
          <ol className="flex flex-wrap items-stretch gap-y-3">
            {visiveis.map((e, i) => {
              const valor = formatarValorEtapa(e.value_cents);
              return (
                <li key={e.stage_id} className="flex min-w-[7.5rem] flex-1 items-stretch">
                  {i > 0 ? (
                    <span
                      aria-hidden
                      className="mx-1 mt-3 hidden text-[var(--color-text-muted)] sm:block"
                    >
                      →
                    </span>
                  ) : null}
                  <Link
                    href={`/app/pipelines/${e.pipeline_id}`}
                    className="min-w-0 flex-1 rounded-lg px-1 py-0.5 transition-colors duration-150 hover:bg-white/[0.04] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-info)]"
                  >
                    <p className="truncate text-[12px] text-[var(--color-text-muted)]">{e.stage_name}</p>
                    <p className="mt-0.5 text-[22px] font-semibold leading-none tabular-nums">{e.count}</p>
                    {valor ? (
                      <p className="mt-1 text-[12px] text-[var(--color-text-muted)]">{valor}</p>
                    ) : null}
                  </Link>
                </li>
              );
            })}
          </ol>
          {resto > 0 ? (
            <Link
              href={href}
              className="mt-3 inline-block text-[12px] text-[var(--color-info-fg)] hover:underline"
            >
              Ver todas
            </Link>
          ) : null}
        </div>
      )}
    </Superficie>
  );
}

function AtendimentoAgora({ snap }: { snap: SnapshotDaHome | undefined }) {
  const fila = snap?.team?.fila ?? 0;
  const espera = snap?.team?.espera_mais_antiga_s ?? 0;
  const disp = snap?.team?.disponiveis ?? 0;
  const resp = snap?.team?.primeira_resposta_media_s ?? null;
  const critica = esperaAnomala(espera) || espera >= 15 * 60;

  return (
    <Superficie testid="home-atendimento" className="order-3 lg:order-2">
      <CabecalhoDeBloco
        titulo="Atendimento agora"
        cta="Abrir Inbox"
        href="/app/inbox?filter=unassigned"
      />
      {snap?.sources.team === "error" ? (
        <p className="text-[13px] text-[var(--color-text-muted)]">
          Atendimento agora indisponível temporariamente.
        </p>
      ) : (
        <div>
          <p className="text-[32px] font-semibold leading-none tabular-nums">{fila}</p>
          <p className="mt-1 text-[13px] text-[var(--color-text-muted)]">aguardando</p>
          <dl className="mt-4 grid grid-cols-3 gap-2">
            <div>
              <dt className="text-[11px] text-[var(--color-text-muted)]">Maior espera</dt>
              <dd
                title={esperaAnomala(espera) ? `Espera anômala: ${formatarEspera(espera)}` : undefined}
                className={cn(
                  "mt-0.5 text-[15px] font-semibold tabular-nums",
                  esperaAnomala(espera) && "text-[var(--color-error-fg)]",
                )}
              >
                {formatarEspera(espera)}
              </dd>
            </div>
            <div>
              <dt className="text-[11px] text-[var(--color-text-muted)]">Disponíveis</dt>
              <dd className="mt-0.5 text-[15px] font-semibold tabular-nums">{disp}</dd>
            </div>
            <div>
              <dt className="text-[11px] text-[var(--color-text-muted)]">1ª resposta</dt>
              <dd className="mt-0.5 text-[15px] font-semibold tabular-nums">{formatarEspera(resp)}</dd>
            </div>
          </dl>
          {espera > 0 ? (
            <Link
              href="/app/inbox?filter=unassigned"
              data-testid="home-chip-espera"
              aria-label={`${formatarEspera(espera)} maior espera`}
              className={cn(
                "mt-3 inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[12px] transition-colors duration-150",
                "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-info)]",
                critica
                  ? "bg-[var(--color-warning-bg)] text-[var(--color-warning-fg)]"
                  : "bg-white/[0.04] text-[var(--color-text-muted)]",
              )}
            >
              {esperaAnomala(espera) ? (
                <Warning className="h-3.5 w-3.5" weight="fill" />
              ) : null}
              {esperaAnomala(espera)
                ? `Atendimento parado há ${formatarEspera(espera)}`
                : `Maior espera ${formatarEspera(espera)}`}
            </Link>
          ) : null}
        </div>
      )}
    </Superficie>
  );
}

function Pulso({ snap }: { snap: SnapshotDaHome }) {
  const frases = insightsDoSnapshot(snap);
  const com = snap.commercial;
  if (frases.length === 0 && snap.papel !== "manager") return null;
  return (
    <Superficie testid="home-pulso">
      <CabecalhoDeBloco titulo="Pulso comercial" />
      {frases.length === 0 ? (
        <p className="text-[13px] text-[var(--color-text-muted)]">
          Sem alerta factual neste período.
        </p>
      ) : (
        <ul className="space-y-2">
          {frases.map((f) => (
            <li key={f.texto} className="text-[14px] leading-snug">
              {f.texto}
            </li>
          ))}
        </ul>
      )}
      {snap.papel === "manager" && com ? (
        <ul
          data-testid="hoje-supervisor"
          className="mt-4 flex flex-wrap gap-x-5 gap-y-1 border-t border-white/[0.06] pt-3 text-[13px] text-[var(--color-text-muted)]"
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
    </Superficie>
  );
}

function Equipe({ snap }: { snap: SnapshotDaHome }) {
  const pessoas = (snap.team?.pessoas ?? []).slice(0, 4);
  return (
    <Superficie testid="home-equipe">
      <CabecalhoDeBloco titulo="Equipe" href="/app/team" cta="Ver equipe" />
      {pessoas.length === 0 ? (
        <p className="text-[13px] text-[var(--color-text-muted)]">Sem roster no momento.</p>
      ) : (
        <ul className="space-y-2.5">
          {pessoas.map((pessoa) => (
            <li key={pessoa.user_id} className="flex items-center gap-2.5">
              <span
                aria-hidden
                className="flex h-7 w-7 items-center justify-center rounded-full bg-white/[0.06] text-[11px] font-semibold"
              >
                {iniciais(pessoa.nome)}
              </span>
              <span
                aria-hidden
                className={cn(
                  "h-2 w-2 shrink-0 rounded-full",
                  pessoa.disponivel ? "bg-[var(--color-success)]" : "bg-white/25",
                )}
              />
              <span className="min-w-0">
                <span className="block truncate text-[13px] font-medium">{pessoa.nome}</span>
                <span className="text-[12px] text-[var(--color-text-muted)]">
                  {pessoa.disponivel ? "Disponível" : "Indisponível"}
                  {pessoa.disponivel && pessoa.abertas > 0
                    ? ` · ${pessoa.abertas} ${pessoa.abertas === 1 ? "conversa" : "conversas"}`
                    : ""}
                </span>
              </span>
            </li>
          ))}
        </ul>
      )}
    </Superficie>
  );
}

function Campanha({ snap }: { snap: SnapshotDaHome }) {
  if (snap.sources.campaigns === "error") {
    return (
      <Superficie testid="home-campanha">
        <p className="text-[13px] text-[var(--color-text-muted)]">
          Campanha indisponível temporariamente.
        </p>
      </Superficie>
    );
  }
  if (!snap.campaigns) return null;
  const c = snap.campaigns;
  const taxa = c.enviados > 0 ? ((c.respostas / c.enviados) * 100).toFixed(1).replace(".", ",") : null;
  return (
    <Superficie testid="home-campanha">
      <CabecalhoDeBloco
        titulo="Última campanha"
        href={`/app/campanhas/${c.id}`}
        cta="Ver campanha"
      />
      <p className="text-[14px] font-medium">{c.name}</p>
      <p className="mt-1 text-[13px] text-[var(--color-text-muted)]">
        {c.enviados} enviados · {c.respostas} respondidos
        {taxa ? ` · ${taxa}% resposta` : ""} · {c.opt_outs} opt-out
      </p>
    </Superficie>
  );
}

function SkeletonHome() {
  return (
    <div className="space-y-4" aria-busy="true" aria-label="Carregando início">
      <div className="h-20 animate-pulse rounded-xl bg-white/5" />
      <div className="grid gap-3 lg:grid-cols-3">
        <div className="h-40 animate-pulse rounded-xl bg-white/5 lg:col-span-2" />
        <div className="h-40 animate-pulse rounded-xl bg-white/5" />
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
  const hojeCount = snap?.personal.hoje ?? 0;

  return (
    <div
      className="mx-auto flex w-full max-w-6xl flex-col gap-4 p-5 md:p-6"
      data-testid="hoje-operacional"
    >
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0 space-y-1">
          <h1 className="sr-only">Início</h1>
          <p className="text-[26px] font-semibold leading-tight tracking-tight">
            {primeiro ? `${saudacaoDoDia()}, ${primeiro}` : `${saudacaoDoDia()}`}
          </p>
          <p className="text-[14px] text-[var(--color-text-muted)]">
            {manager
              ? "Aqui está o pulso comercial de hoje."
              : "Aqui está o que precisa da sua atenção hoje."}
          </p>
          {contexto ? (
            <p className="text-[12px] text-[var(--color-text-muted)]">{contexto}</p>
          ) : null}
        </div>
        {manager ? <PeriodoPills periodo={periodo} onChange={setPeriodo} /> : null}
      </header>

      {!setup.completo ? <ChecklistCompacto itens={setup.itens} /> : null}

      {q.isLoading && !snap ? (
        <SkeletonHome />
      ) : q.isError && !snap ? (
        <p className="text-[13px] text-[var(--color-error-fg)]">
          Não consegui carregar o início. Tente de novo.
        </p>
      ) : (
        <>
          {manager && snap ? <KpiStrip snap={snap} /> : null}

          <div className="grid grid-cols-1 gap-3 lg:grid-cols-3">
            <Prioridades snap={snap} funilHref={funilHref} />

            {manager ? (
              <AtendimentoAgora snap={snap} />
            ) : (
              <Superficie testid="home-hoje" className="order-2">
                <CabecalhoDeBloco titulo="Hoje" cta="Ver agenda" href="/app/agenda" />
                <Link
                  href="/app/agenda?visao=hoje"
                  data-testid="home-chip-hoje"
                  className="mb-2 inline-block text-[12px] text-[var(--color-text-muted)] hover:text-[var(--color-info-fg)]"
                >
                  {hojeCount} retornos hoje
                </Link>
                <HomeHoje acoes={snap?.personal.acoes ?? []} />
              </Superficie>
            )}

            {manager ? (
              <FunilSegmentado
                etapas={snap?.funnel ?? []}
                href={funilHref}
                erro={snap?.sources.funnel === "error"}
                className="order-4 lg:order-3 lg:col-span-2"
              />
            ) : (
              <FunilSegmentado
                etapas={snap?.funnel ?? []}
                href={funilHref}
                erro={snap?.sources.funnel === "error"}
                className="order-4 lg:col-span-3"
              />
            )}

            {manager ? (
              <Superficie testid="home-hoje" className="order-2 lg:order-4">
                <CabecalhoDeBloco titulo="Hoje" cta="Ver agenda" href="/app/agenda" />
                <Link
                  href="/app/agenda?visao=hoje"
                  data-testid="home-chip-hoje"
                  className="mb-2 inline-block text-[12px] text-[var(--color-text-muted)] hover:text-[var(--color-info-fg)]"
                >
                  {hojeCount} retornos hoje
                </Link>
                <HomeHoje acoes={snap?.personal.acoes ?? []} />
              </Superficie>
            ) : null}
          </div>

          {snap ? (
            <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
              <Pulso snap={snap} />
              {manager ? <Equipe snap={snap} /> : null}
              {manager ? <Campanha snap={snap} /> : null}
            </div>
          ) : null}
        </>
      )}
    </div>
  );
}
