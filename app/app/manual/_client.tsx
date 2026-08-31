"use client";

import { useEffect, useMemo, useState } from "react";

import { useMarcaDaInstalacao } from "@/lib/branding/contexto";
import { buscarCapitulos } from "@/lib/manual/buscar";
import { CAPITULOS, type Bloco, type Capitulo } from "@/lib/manual/conteudo";
import { BookOpen, MagnifyingGlass } from "@/lib/ui/icons";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

function irParaPasso(id: string) {
  const el = document.getElementById(id);
  if (!el) return;
  el.scrollIntoView({ behavior: "smooth", block: "start" });
  window.history.replaceState(null, "", `#${id}`);
}

function BlocoView({ bloco }: { bloco: Bloco }) {
  switch (bloco.tipo) {
    case "p":
      return <p className="text-[15px] leading-7 text-text">{bloco.texto}</p>;
    case "aviso":
      return (
        <p className="rounded-md border border-warning/40 bg-warning-bg px-4 py-3 text-[15px] leading-6 text-warning-fg">
          {bloco.texto}
        </p>
      );
    case "passos":
      return (
        <ol className="space-y-2.5">
          {bloco.itens.map((item, i) => (
            <li key={i} className="flex gap-3 text-[15px] leading-6 text-text">
              <span
                aria-hidden
                className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-accent-soft text-xs font-semibold text-accent"
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
        <ul className="list-disc space-y-1.5 pl-5 text-[15px] leading-6 text-text">
          {bloco.itens.map((item, i) => (
            <li key={i}>{item}</li>
          ))}
        </ul>
      );
    case "tabela":
      return (
        <div className="overflow-x-auto rounded-md border border-border">
          <table className="w-full min-w-[28rem] text-left text-sm">
            <thead className="bg-surface-elevated text-text-muted">
              <tr>
                <th className="px-3 py-2 font-medium">{bloco.cabecalho[0]}</th>
                <th className="px-3 py-2 font-medium">{bloco.cabecalho[1]}</th>
              </tr>
            </thead>
            <tbody>
              {bloco.linhas.map((linha, i) => (
                <tr key={i} className="border-t border-border">
                  <td className="px-3 py-2 align-top font-medium">{linha[0]}</td>
                  <td className="px-3 py-2 align-top text-text-muted">{linha[1]}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      );
  }
}

function CapituloView({ capitulo }: { capitulo: Capitulo }) {
  return (
    <article
      id={capitulo.id}
      className="scroll-mt-8 rounded-lg border border-border bg-surface px-5 py-6 sm:px-8"
    >
      <p className="text-xs font-medium uppercase tracking-wider text-accent">
        Como usar · {capitulo.numero} de {CAPITULOS.length}
      </p>
      <h2 className="mt-1 text-xl font-semibold tracking-tight">{capitulo.titulo}</h2>
      <p className="mt-1 text-sm text-text-muted">{capitulo.resumo}</p>
      <div className="mt-5 space-y-4">
        {capitulo.blocos.map((bloco, i) => (
          <BlocoView key={i} bloco={bloco} />
        ))}
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
    <div className="flex h-full min-h-0 bg-bg">
      <aside className="hidden w-64 shrink-0 overflow-y-auto border-r border-border bg-surface p-4 lg:block">
        <p className="px-2 text-xs font-medium uppercase tracking-wider text-text-muted">
          O que você quer fazer
        </p>
        <nav aria-label="Partes do manual de usuário" className="mt-3 space-y-0.5">
          {CAPITULOS.map((c) => (
            <a
              key={c.id}
              href={`#${c.id}`}
              onClick={(e) => {
                e.preventDefault();
                setQ("");
                setAlvo(c.id);
              }}
              className="flex items-baseline gap-2 rounded-md px-2 py-1.5 text-sm text-text hover:bg-accent-soft"
            >
              <span className="w-4 shrink-0 font-mono text-xs text-text-muted">{c.numero}</span>
              <span>{c.titulo}</span>
            </a>
          ))}
        </nav>
      </aside>

      <div className="min-w-0 flex-1 overflow-y-auto">
        <div className="mx-auto flex max-w-3xl flex-col gap-8 px-4 py-8 sm:px-8">
          <header className="space-y-4">
            <div className="flex items-start gap-3">
              <span className="mt-0.5 flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-accent-soft text-accent">
                <BookOpen size={22} weight="duotone" aria-hidden />
              </span>
              <div>
                <p className="text-xs font-medium uppercase tracking-wider text-accent">
                  Manual de usuário
                </p>
                <h1 className="mt-1 text-2xl font-semibold tracking-tight">
                  Como usar {marca.name}
                </h1>
                <p className="mt-1 max-w-xl text-sm text-text-muted">
                  Passo a passo do dia a dia. Sem jargão. Escolha um assunto ou
                  procure o que você quer fazer.
                </p>
              </div>
            </div>

            <nav aria-label="Passos do manual" className="flex flex-wrap gap-2">
              {CAPITULOS.map((c) => (
                <Button key={c.id} asChild variant="outline" size="sm">
                  <a
                    href={`#${c.id}`}
                    onClick={(e) => {
                      e.preventDefault();
                      setQ("");
                      setAlvo(c.id);
                    }}
                  >
                    {c.numero}. {c.titulo}
                  </a>
                </Button>
              ))}
            </nav>

            <label className="relative block">
              <span className="sr-only">Procurar no manual de usuário</span>
              <MagnifyingGlass
                size={16}
                aria-hidden
                className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-text-muted"
              />
              <Input
                type="search"
                value={q}
                onChange={(e) => setQ(e.target.value)}
                placeholder="Ex.: WhatsApp, mensagem, agente, fluxo…"
                className="pl-9"
                autoComplete="off"
              />
            </label>
          </header>

          {buscando ? (
            <p className="text-sm text-text-muted" role="status">
              {visiveis.length === 0
                ? `Nada com “${q.trim()}”. Tente WhatsApp, mensagem, agente ou fluxo.`
                : `${visiveis.length} ${visiveis.length === 1 ? "assunto" : "assuntos"} com “${q.trim()}”.`}
            </p>
          ) : null}

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
