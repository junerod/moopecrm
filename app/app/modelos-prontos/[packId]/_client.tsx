"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { toast } from "sonner";

import { AppIcon } from "@/components/ds/AppIcon";
import { instalarPack } from "@/components/negocio/acoes-do-pack";
import { Button } from "@/components/ui/button";
import { testidAtivarModelo } from "@/lib/business-packs/apresentacao";
import { visualDoPack } from "@/lib/business-packs/visual";

type Assistente = { key: string; name: string; oQueFaz: string; principal: boolean };
type Automacao = { key: string; name: string; precisaGestao: boolean };
type Fluxo = { key: string; name: string; description: string };

export function DetalheDoModeloClient(props: {
  packId: string;
  label: string;
  description: string;
  funilNome: string;
  etapas: string[];
  assistentes: Assistente[];
  colecoes: Array<{ slug: string; name: string }>;
  automacoes: Automacao[];
  fluxos: Fluxo[];
  respostas: string[];
  campanhas: string[];
  podeInstalar: boolean;
  jaAtivo: boolean;
}) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [aberto, setAberto] = useState(true);
  const v = visualDoPack(props.packId, props.description);

  function ativar() {
    if (props.jaAtivo) {
      router.push("/app/meu-modelo");
      return;
    }
    start(async () => {
      const ok = await instalarPack(props.packId);
      if (!ok) {
        toast.error("Não consegui preparar a operação.");
        return;
      }
      toast.success("Operação preparada. Complete os passos no seu modelo.");
      router.push("/app/meu-modelo");
      router.refresh();
    });
  }

  return (
    <div className="space-y-6" data-testid="detalhe-do-modelo" id="o-que-instala">
      <header className="flex flex-wrap items-start justify-between gap-4">
        <div className="max-w-xl">
          <p className="text-[11px] font-medium uppercase tracking-[0.16em] text-[var(--color-text-muted)]">
            Antes de instalar
          </p>
          <h2 className="mt-1 flex items-center gap-2 text-2xl font-semibold tracking-tight">
            <AppIcon icon={v.icone} tone={v.tom} size="lg" />
            {props.label}
          </h2>
          <p className="mt-2 text-sm leading-6 text-[var(--color-text-muted)]">{v.frase}</p>
        </div>
        <div className="flex flex-wrap gap-2">
          {props.podeInstalar ? (
            <Button data-testid={testidAtivarModelo(props.packId)} disabled={pending} onClick={ativar}>
              {props.jaAtivo ? "Abrir configuração" : pending ? "Preparando..." : "Ativar modelo"}
            </Button>
          ) : (
            <p className="text-sm text-[var(--color-text-muted)]">Peça a quem administra para ativar.</p>
          )}
          <Button asChild variant="outline">
            <Link href="/app/modelos-prontos">Voltar aos modelos</Link>
          </Button>
        </div>
      </header>

      <section className="rounded-2xl bg-[var(--color-surface)] p-5 ring-1 ring-[var(--color-border)]">
        <h3 className="text-sm font-semibold">O que este modelo prepara</h3>
        <ul className="mt-3 grid gap-2 text-sm sm:grid-cols-2">
          <li>{props.assistentes.length} assistentes</li>
          <li>1 funil — {props.etapas.length} etapas</li>
          <li>{props.colecoes.length} pastas de conhecimento</li>
          <li>{props.automacoes.length} automações</li>
          <li>{props.fluxos.length} fluxos prontos</li>
          <li>{props.respostas.length} respostas rápidas</li>
          <li>{props.campanhas.length} campanhas</li>
        </ul>
        <p className="mt-3 text-sm text-[var(--color-text-muted)]">
          Funil comercial — {props.etapas.length} etapas. Automações nascem desligadas.
        </p>
      </section>

      <details
        open={aberto}
        onToggle={(e) => setAberto(e.currentTarget.open)}
        className="rounded-2xl bg-[var(--color-surface)] p-5 ring-1 ring-[var(--color-border)]"
      >
        <summary className="cursor-pointer text-sm font-semibold">Ver tudo que será instalado</summary>
        <div className="mt-4 space-y-5">
          <div data-testid="modelos-prontos-cards">
            <p className="text-sm font-medium">Os {props.assistentes.length} assistentes</p>
            <p className="mt-1 text-sm text-[var(--color-text-muted)]">
              Quem atende no WhatsApp. Cada um é uma pessoa da equipe — não é etapa do quadro.
            </p>
            <ul className="mt-2 grid gap-2 sm:grid-cols-2" data-testid="lista-assistentes-do-modelo">
              {props.assistentes.map((a) => (
                <li key={a.key} data-testid={`modelo-assistente-${a.key}`} className="rounded-xl px-3 py-2 ring-1 ring-[var(--color-border)]">
                  <p className="font-medium">{a.name}</p>
                  <p className="text-sm text-[var(--color-text-muted)]">{a.oQueFaz}</p>
                </li>
              ))}
            </ul>
          </div>
          <div data-testid="quadro-do-modelo">
            <p className="text-sm font-medium">Quadro (Kanban)</p>
            <p className="mt-1 text-sm text-[var(--color-text-muted)]">
              {props.funilNome}. Paciente ou lead anda da esquerda para a direita — isso não repete os assistentes.
            </p>
            <details className="mt-2">
              <summary className="cursor-pointer text-sm text-[var(--color-accent)]">Ver etapas</summary>
              <ol className="mt-2 flex flex-wrap gap-2 text-xs text-[var(--color-text-muted)]">
                {props.etapas.map((nome, i) => (
                  <li key={nome}>
                    {i + 1}. {nome}
                  </li>
                ))}
              </ol>
            </details>
          </div>
          <div>
            <p className="text-sm font-medium">Automações</p>
            <p className="mt-1 text-sm text-[var(--color-text-muted)]" data-testid="aviso-automacoes-desligadas">
              Prontas e desligadas. Nenhuma dispara sozinha ao ativar o modelo.
            </p>
            <ul className="mt-2 space-y-1 text-sm text-[var(--color-text-muted)]">
              {props.automacoes.map((a) => (
                <li key={a.key}>{a.name}</li>
              ))}
            </ul>
          </div>
          <div>
            <p className="text-sm font-medium">Fluxos prontos</p>
            <p className="mt-1 text-sm text-[var(--color-text-muted)]">
              O primeiro é o modelo de operação do seu negócio: espera, condição e dois recados.
              Os outros são atalhos. Ligam só quando você clicar.
            </p>
            <ul className="mt-2 space-y-2 text-sm" data-testid="lista-fluxos-do-modelo">
              {props.fluxos.map((f) => (
                <li key={f.key}>
                  <p className="font-medium">{f.name}</p>
                  <p className="text-[var(--color-text-muted)]">{f.description}</p>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </details>
    </div>
  );
}
