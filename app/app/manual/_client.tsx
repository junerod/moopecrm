"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";

import { AppIcon } from "@/components/ds/AppIcon";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useMarcaDaInstalacao } from "@/lib/branding/contexto";
import { ESTILO_DO_TOM, type TomDs } from "@/lib/design-system/tones";
import { buscarCapitulos } from "@/lib/manual/buscar";
import { CAPITULOS, type Bloco, type Capitulo } from "@/lib/manual/conteudo";
import { capitulosPorGrupo, visualDoCapitulo } from "@/lib/manual/visual";
import { ArrowRight, BookOpen, MagnifyingGlass } from "@/lib/ui/icons";
import { cn } from "@/lib/utils";

const TONS_CARD: TomDs[] = ["blue", "teal", "violet", "amber", "green", "indigo", "cyan"];

function irParaPasso(id: string) {
  const el = document.getElementById(id);
  if (!el) return;
  el.scrollIntoView({ behavior: "smooth", block: "start" });
  window.history.replaceState(null, "", `#${id}`);
}

function IlustracaoCapa() {
  return (
    <svg
      viewBox="0 0 280 160"
      className="h-full w-full"
      aria-hidden
      role="img"
    >
      <defs>
        <linearGradient id="manual-capa" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="var(--moope-primary)" stopOpacity="0.22" />
          <stop offset="55%" stopColor="var(--moope-cyan)" stopOpacity="0.18" />
          <stop offset="100%" stopColor="var(--color-ai-fg)" stopOpacity="0.16" />
        </linearGradient>
      </defs>
      <rect width="280" height="160" rx="20" fill="url(#manual-capa)" />
      <rect x="22" y="28" width="72" height="104" rx="14" fill="var(--color-surface)" opacity="0.92" />
      <rect x="34" y="42" width="48" height="8" rx="4" fill="var(--moope-primary)" opacity="0.55" />
      <rect x="34" y="58" width="40" height="6" rx="3" fill="var(--color-text-muted)" opacity="0.35" />
      <rect x="34" y="72" width="44" height="6" rx="3" fill="var(--color-text-muted)" opacity="0.28" />
      <rect x="34" y="86" width="36" height="6" rx="3" fill="var(--color-text-muted)" opacity="0.22" />
      <circle cx="46" cy="114" r="8" fill="var(--moope-cyan)" opacity="0.7" />
      <circle cx="68" cy="114" r="8" fill="var(--color-ai-fg)" opacity="0.55" />
      <rect x="106" y="36" width="152" height="36" rx="12" fill="var(--color-surface)" opacity="0.9" />
      <rect x="118" y="48" width="88" height="8" rx="4" fill="var(--moope-primary)" opacity="0.45" />
      <rect x="106" y="84" width="70" height="48" rx="12" fill="var(--color-surface)" opacity="0.88" />
      <rect x="188" y="84" width="70" height="48" rx="12" fill="var(--color-surface)" opacity="0.88" />
      <circle cx="141" cy="108" r="10" fill="var(--color-success-fg)" opacity="0.45" />
      <circle cx="223" cy="108" r="10" fill="var(--color-warning-fg)" opacity="0.5" />
    </svg>
  );
}

function BlocoView({ bloco }: { bloco: Bloco }) {
  switch (bloco.tipo) {
    case "p":
      return <p className="text-[15px] leading-7 text-[var(--color-text)]">{bloco.texto}</p>;
    case "aviso":
      return (
        <p className="rounded-2xl border border-[var(--color-warning)]/35 bg-[var(--color-warning-bg)] px-4 py-3 text-[15px] leading-6 text-[var(--color-warning-fg)]">
          {bloco.texto}
        </p>
      );
    case "passos":
      return (
        <ol className="space-y-2.5">
          {bloco.itens.map((item, i) => (
            <li key={i} className="flex gap-3 text-[15px] leading-6 text-[var(--color-text)]">
              <span
                aria-hidden
                className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-xs font-semibold"
                style={{
                  background: ESTILO_DO_TOM.blue.bg,
                  color: ESTILO_DO_TOM.blue.fg,
                }}
              >
                {i + 1}
              </span>
              <span>{item}</span>
            </li>
          ))}
        </ol>
      );
    case "lista":
      return (
        <ul className="list-disc space-y-1.5 pl-5 text-[15px] leading-6 text-[var(--color-text)]">
          {bloco.itens.map((item, i) => (
            <li key={i}>{item}</li>
          ))}
        </ul>
      );
    case "tabela":
      return (
        <div className="overflow-x-auto rounded-2xl ring-1 ring-[var(--color-border)]">
          <table className="w-full min-w-[28rem] text-left text-sm">
            <thead className="bg-[var(--color-surface-elevated)] text-[var(--color-text-muted)]">
              <tr>
                <th className="px-4 py-2.5 font-medium">{bloco.cabecalho[0]}</th>
                <th className="px-4 py-2.5 font-medium">{bloco.cabecalho[1]}</th>
              </tr>
            </thead>
            <tbody>
              {bloco.linhas.map((linha, i) => (
                <tr key={i} className="border-t border-[var(--color-border)]">
                  <td className="px-4 py-2.5 align-top font-medium">{linha[0]}</td>
                  <td className="px-4 py-2.5 align-top text-[var(--color-text-muted)]">{linha[1]}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      );
    case "cards":
      return (
        <ul className="grid gap-3 sm:grid-cols-3">
          {bloco.itens.map((item, i) => {
            const tom = TONS_CARD[i % TONS_CARD.length]!;
            const cor = ESTILO_DO_TOM[tom];
            return (
              <li
                key={item.titulo}
                className="rounded-2xl p-4 ring-1 ring-[var(--color-border)]"
                style={{ background: cor.bg }}
              >
                <p className="text-sm font-semibold tracking-tight" style={{ color: cor.fg }}>
                  {item.titulo}
                </p>
                <p className="mt-1 text-sm leading-5 text-[var(--color-text)]">{item.texto}</p>
              </li>
            );
          })}
        </ul>
      );
    case "atalho":
      return (
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl bg-[var(--color-surface-elevated)] px-4 py-3 ring-1 ring-[var(--color-border)]">
          <p className="text-sm text-[var(--color-text)]">{bloco.titulo}</p>
          <Button asChild size="sm">
            <Link href={bloco.href}>
              {bloco.cta}
              <ArrowRight size={14} className="ml-1" aria-hidden />
            </Link>
          </Button>
        </div>
      );
  }
}

function CapituloView({ capitulo }: { capitulo: Capitulo }) {
  const visual = visualDoCapitulo(capitulo.id);
  const cor = ESTILO_DO_TOM[visual.tom];
  return (
    <article
      id={capitulo.id}
      data-testid={`capitulo-${capitulo.id}`}
      className="scroll-mt-8 overflow-hidden rounded-3xl bg-[var(--color-surface)] shadow-[var(--shadow-sm)] ring-1 ring-[var(--color-border)]"
    >
      <div className="h-1.5" style={{ background: cor.fg }} />
      <div className="px-5 py-6 sm:px-8">
        <div className="flex items-start gap-3">
          <AppIcon icon={visual.icone} tone={visual.tom} size="lg" />
          <div className="min-w-0">
            <p className="text-[11px] font-medium uppercase tracking-[0.16em]" style={{ color: cor.fg }}>
              {visual.grupo} · {capitulo.numero} de {CAPITULOS.length}
            </p>
            <h2 className="mt-1 text-xl font-semibold tracking-tight">{capitulo.titulo}</h2>
            <p className="mt-1 text-sm text-[var(--color-text-muted)]">{capitulo.resumo}</p>
          </div>
        </div>
        <div className="mt-5 space-y-4">
          {capitulo.blocos.map((bloco, i) => (
            <BlocoView key={i} bloco={bloco} />
          ))}
        </div>
      </div>
    </article>
  );
}

export function ManualDoOperador() {
  const marca = useMarcaDaInstalacao();
  const [q, setQ] = useState("");
  const [alvo, setAlvo] = useState<string | null>(null);
  const visiveis = useMemo(() => buscarCapitulos(CAPITULOS, q), [q]);
  const buscando = q.trim().length > 0;
  const grupos = useMemo(() => capitulosPorGrupo(), []);

  function ir(id: string) {
    setQ("");
    setAlvo(id);
  }

  useEffect(() => {
    const id = window.location.hash.replace(/^#/, "");
    if (!id) return;
    document.getElementById(id)?.scrollIntoView({ block: "start" });
  }, []);

  useEffect(() => {
    if (!alvo || buscando) return;
    irParaPasso(alvo);
    setAlvo(null);
  }, [alvo, buscando]);

  return (
    <div className="flex h-full min-h-0 bg-[var(--color-bg)]" data-testid="manual-do-operador">
      <aside className="hidden w-72 shrink-0 overflow-y-auto border-r border-[var(--color-border)] bg-[var(--color-surface)] p-4 lg:block">
        <p className="px-2 text-[11px] font-medium uppercase tracking-[0.16em] text-[var(--color-text-muted)]">
          O que você quer fazer
        </p>
        <nav aria-label="Partes do manual de usuário" className="mt-3 space-y-4">
          {grupos.map((g) => (
            <div key={g.grupo}>
              <p className="px-2 pb-1 text-[11px] font-semibold uppercase tracking-[0.14em] text-[var(--color-text-muted)]">
                {g.grupo}
              </p>
              <div className="space-y-0.5">
                {g.capitulos.map((c) => {
                  const visual = visualDoCapitulo(c.id);
                  return (
                    <a
                      key={c.id}
                      href={`#${c.id}`}
                      onClick={(e) => {
                        e.preventDefault();
                        ir(c.id);
                      }}
                      className="flex items-center gap-2 rounded-xl px-2 py-1.5 text-sm text-[var(--color-text)] hover:bg-[var(--color-surface-elevated)]"
                    >
                      <AppIcon icon={visual.icone} tone={visual.tom} size="sm" />
                      <span className="min-w-0 truncate">{c.titulo}</span>
                    </a>
                  );
                })}
              </div>
            </div>
          ))}
        </nav>
      </aside>

      <div className="min-w-0 flex-1 overflow-y-auto">
        <div className="mx-auto flex max-w-4xl flex-col gap-8 px-4 py-8 sm:px-8">
          <header className="overflow-hidden rounded-3xl bg-[var(--color-surface)] shadow-[var(--shadow-sm)] ring-1 ring-[var(--color-border)]">
            <div className="grid gap-0 lg:grid-cols-[1.2fr_0.8fr]">
              <div className="space-y-4 p-6 sm:p-8">
                <div className="flex items-start gap-3">
                  <AppIcon icon={BookOpen} tone="amber" size="lg" />
                  <div>
                    <p className="text-[11px] font-medium uppercase tracking-[0.16em] text-[var(--color-warning-fg)]">
                      Manual de usuário
                    </p>
                    <h1 className="mt-1 text-3xl font-semibold tracking-tight">
                      Como usar {marca.name}
                    </h1>
                    <p className="mt-2 max-w-xl text-sm leading-6 text-[var(--color-text-muted)]">
                      Escolha o modelo, termine a configuração e trabalhe no dia a dia.
                      Sem jargão. Com ícone, cor e o botão da tela certa.
                    </p>
                  </div>
                </div>
                <label className="relative block">
                  <span className="sr-only">Procurar no manual de usuário</span>
                  <MagnifyingGlass
                    size={16}
                    aria-hidden
                    className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-[var(--color-text-muted)]"
                  />
                  <Input
                    type="search"
                    value={q}
                    onChange={(e) => setQ(e.target.value)}
                    placeholder="WhatsApp, modelo, campanha, clínica…"
                    className="h-11 rounded-xl pl-9"
                    autoComplete="off"
                    data-testid="manual-busca"
                  />
                </label>
              </div>
              <div className="hidden min-h-[11rem] p-4 lg:block">
                <IlustracaoCapa />
              </div>
            </div>
          </header>

          {buscando ? (
            <p className="text-sm text-[var(--color-text-muted)]" role="status">
              {visiveis.length === 0
                ? `Nada com “${q.trim()}”. Tente WhatsApp, modelo, agente ou campanha.`
                : `${visiveis.length} ${visiveis.length === 1 ? "assunto" : "assuntos"} com “${q.trim()}”.`}
            </p>
          ) : (
            <section aria-label="Índice ilustrado" className="space-y-3">
              <h2 className="text-sm font-semibold tracking-tight">Comece por um assunto</h2>
              <ul className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
                {CAPITULOS.map((c) => {
                  const visual = visualDoCapitulo(c.id);
                  return (
                    <li key={c.id}>
                      <a
                        href={`#${c.id}`}
                        onClick={(e) => {
                          e.preventDefault();
                          ir(c.id);
                        }}
                        className={cn(
                          "flex h-full items-start gap-3 rounded-2xl bg-[var(--color-surface)] p-4",
                          "ring-1 ring-[var(--color-border)] transition-shadow hover:shadow-[var(--shadow-sm)]",
                        )}
                      >
                        <AppIcon icon={visual.icone} tone={visual.tom} size="lg" />
                        <span className="min-w-0">
                          <span className="block text-sm font-semibold tracking-tight">{c.titulo}</span>
                          <span className="mt-1 block text-xs leading-5 text-[var(--color-text-muted)]">
                            {c.resumo}
                          </span>
                        </span>
                      </a>
                    </li>
                  );
                })}
              </ul>
            </section>
          )}

          <div className="space-y-6">
            {visiveis.map((c) => (
              <CapituloView key={c.id} capitulo={c} />
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
