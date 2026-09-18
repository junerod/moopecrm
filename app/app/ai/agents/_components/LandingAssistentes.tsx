"use client";

import Link from "next/link";
import { useEffect, useMemo, useState, useTransition } from "react";
import { toast } from "sonner";

import { AppIcon } from "@/components/ds/AppIcon";
import { ProximoPasso } from "@/components/ds/ProximoPasso";
import { TestDriveDoPack } from "@/components/negocio/TestDriveDoPack";
import { Button } from "@/components/ui/button";
import { perguntaDeTeste } from "@/lib/business-packs/apresentacao";
import { resolverPack } from "@/lib/business-packs/catalogo";
import { Key, Robot, Warning } from "@/lib/ui/icons";
import { cn } from "@/lib/utils";

import { pauseAgentAction } from "../_actions";

export type CardAssistente = {
  id: string;
  name: string;
  description: string;
  ativo: boolean;
  specialtyKey: string | null;
  principal: boolean;
  jaExistia: boolean;
};

type ResultadoTeste = {
  specialty_name: string;
  knowledge_hint: string;
  tool_que_seria_chamada: string | null;
  resposta: string;
  gestao_necessaria: boolean;
};

/** Ativos primeiro — quem opera quer ver o que está no ar, não caçar no meio. */
export function ordenarAssistentes(cards: CardAssistente[]): CardAssistente[] {
  return [...cards].sort((a, b) => {
    if (a.ativo !== b.ativo) return a.ativo ? -1 : 1;
    return 0;
  });
}

export function LandingAssistentes({
  packAtivo,
  packLabel,
  packId,
  cards,
  canWrite,
  semCredencialIa = false,
}: {
  packAtivo: boolean;
  packLabel: string | null;
  packId?: string | null;
  cards: CardAssistente[];
  canWrite: boolean;
  /** Nenhuma chave em Credenciais — o assistente não pensa sem isso. */
  semCredencialIa?: boolean;
}) {
  const [lista, setLista] = useState(cards);
  const [aberto, setAberto] = useState<string | null>(null);
  const [teste, setTeste] = useState<ResultadoTeste | null>(null);
  const [testando, setTestando] = useState(false);
  const [pendente, setPendente] = useState<string | null>(null);
  const [, startTransition] = useTransition();

  useEffect(() => {
    setLista(cards);
  }, [cards]);

  const ordenados = useMemo(() => ordenarAssistentes(lista), [lista]);
  const inativos = ordenados.filter((c) => !c.ativo);
  const primeiroInativo = inativos[0];

  async function desativar(card: CardAssistente) {
    setPendente(card.id);
    const res = await pauseAgentAction(card.id);
    setPendente(null);
    if (!res.ok) {
      toast.error(res.message ?? "Não consegui desativar.");
      return;
    }
    toast.success(`«${card.name}» desativado.`);
    startTransition(() => {
      setLista((prev) =>
        prev.map((c) => (c.id === card.id ? { ...c, ativo: false } : c)),
      );
    });
  }

  async function testar(card: CardAssistente) {
    const definition = packId ? resolverPack(packId) : null;
    const mensagem = card.specialtyKey
      ? perguntaDeTeste(definition, card.specialtyKey)
      : "Oi, preciso de ajuda.";
    setAberto(card.id);
    setTestando(true);
    setTeste(null);
    try {
      const res = await fetch("/api/v1/business-packs/test-drive", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ mensagem }),
      });
      const json = (await res.json()) as { data?: ResultadoTeste; error?: { message?: string } };
      if (!res.ok || !json.data) {
        toast.error(json.error?.message ?? "Não consegui testar agora.");
        return;
      }
      setTeste(json.data);
    } finally {
      setTestando(false);
    }
  }

  return (
    <div className="space-y-6" data-testid="landing-assistentes">
      <div className="overflow-hidden rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)]">
        <div className="relative px-5 py-5 sm:px-6">
          <div
            aria-hidden
            className="pointer-events-none absolute inset-0"
            style={{
              background:
                "radial-gradient(ellipse 60% 90% at 0% 0%, color-mix(in oklab, var(--color-ai-fg) 14%, transparent), transparent 55%)",
            }}
          />
          <div className="relative flex flex-wrap items-start justify-between gap-4">
            <div className="flex min-w-0 items-start gap-3">
              <AppIcon icon={Robot} tone="violet" size="lg" />
              <div className="min-w-0">
                <h1 className="text-2xl font-semibold tracking-tight">Assistentes</h1>
                <p className="mt-1 max-w-xl text-sm leading-relaxed text-muted-foreground">
                  Quem fala com o cliente: o jeito de responder, o que sabe e se
                  está ligado. O menu 1, 2, 3 do WhatsApp fica em{" "}
                  <Link href="/app/ai/followups" className="font-medium text-foreground underline underline-offset-2">
                    Bots
                  </Link>
                  .
                </p>
                {packAtivo && packLabel ? (
                  <p
                    className="mt-3 inline-flex rounded-full bg-[var(--color-ai-bg)] px-2.5 py-1 text-xs font-medium text-[var(--color-ai-fg)]"
                    data-testid="pack-locadora-banner"
                  >
                    Pack ativo: {packLabel}
                    {cards.filter((c) => c.specialtyKey).length
                      ? ` · ${cards.filter((c) => c.specialtyKey).length} prontos`
                      : ""}
                  </p>
                ) : null}
              </div>
            </div>
            <div className="flex flex-wrap gap-2">
              {canWrite ? (
                <Button asChild>
                  <Link href="/app/ai/agents/simples" data-testid="criar-assistente">
                    + Criar assistente
                  </Link>
                </Button>
              ) : null}
              <Button asChild variant="outline">
                <Link href="/app/modelos-prontos" data-testid="ir-modelos-prontos">
                  Modelos prontos
                </Link>
              </Button>
            </div>
          </div>
        </div>
      </div>

      {semCredencialIa ? (
        <div
          role="alert"
          data-testid="aviso-sem-credencial-ia"
          className="flex flex-col gap-3 rounded-2xl border border-amber-500/40 bg-gradient-to-br from-amber-500/15 via-amber-500/5 to-transparent p-4 sm:flex-row sm:items-center sm:justify-between sm:gap-4"
        >
          <div className="flex min-w-0 items-start gap-3">
            <span className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-amber-500/20 text-amber-800 dark:text-amber-300">
              <Warning size={22} weight="duotone" aria-hidden />
            </span>
            <div className="min-w-0">
              <p className="text-sm font-semibold text-amber-950 dark:text-amber-100">
                Falta a chave da inteligência artificial
              </p>
              <p className="mt-1 text-sm leading-relaxed text-amber-900/80 dark:text-amber-100/75">
                Sem uma chave (OpenAI, Anthropic ou Google), o assistente não
                consegue pensar nem responder no WhatsApp. Cadastre em um
                minuto — é só colar a API key.
              </p>
            </div>
          </div>
          <Button asChild className="shrink-0 bg-amber-700 text-white hover:bg-amber-800 dark:bg-amber-600 dark:hover:bg-amber-500">
            <Link href="/app/ai/credentials" data-testid="ir-credenciais-ia">
              <Key size={16} aria-hidden className="mr-1.5" />
              Cadastrar chave de IA
            </Link>
          </Button>
        </div>
      ) : null}

      {cards.length === 0 && canWrite ? (
        <ProximoPasso
          titulo="Nenhum assistente ainda"
          texto="Crie um assistente para atender conversas com o que a empresa já sabe."
          acao="Criar assistente"
          href="/app/ai/agents/simples"
        />
      ) : null}
      {primeiroInativo ? (
        <ProximoPasso
          titulo="Estes assistentes ainda não atendem clientes"
          texto={
            inativos.length === 1
              ? "Publique para ele começar a responder."
              : `${inativos.length} não estão atendendo. Publique o que quiser ligar.`
          }
          acao="Publicar"
          href={`/app/ai/agents/${primeiroInativo.id}`}
        />
      ) : null}

      <ul className="grid gap-3 md:grid-cols-2" data-testid="meus-assistentes">
        {ordenados.map((card) => {
          const papel = card.description;
          return (
            <li
              key={card.id}
              data-testid={`card-assistente-${card.specialtyKey ?? card.id}`}
              className={cn(
                "rounded-2xl border bg-[var(--color-surface)] p-4 transition-shadow hover:shadow-sm",
                card.ativo
                  ? "border-emerald-500/30 shadow-[inset_0_0_0_1px_color-mix(in_oklab,theme(colors.emerald.500)_12%,transparent)]"
                  : "border-[var(--color-border)]",
              )}
            >
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div className="min-w-0">
                  <p className="font-medium">{card.name}</p>
                  <p className="text-sm text-muted-foreground">{papel}</p>
                </div>
                <span
                  className={cn(
                    "rounded-full px-2.5 py-0.5 text-xs font-semibold uppercase tracking-wide",
                    card.ativo
                      ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300"
                      : "bg-muted text-muted-foreground",
                  )}
                  data-testid={`assistente-status-${card.id}`}
                >
                  {card.ativo ? "Ativo" : "Inativo"}
                </span>
              </div>
              {card.principal ? (
                <p className="mt-2 text-xs font-medium text-[var(--color-ai-fg)]" data-testid="assistente-principal">
                  Principal — recebe primeiro o atendimento
                </p>
              ) : null}
              {card.jaExistia ? (
                <p className="mt-2 text-xs text-muted-foreground">Já existia na empresa</p>
              ) : null}
              <div className="mt-3 flex flex-wrap gap-2">
                <Button asChild size="sm">
                  <Link href={`/app/ai/agents/${card.id}`}>Configurar</Link>
                </Button>
                {canWrite && card.ativo ? (
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    data-testid={`desativar-assistente-${card.id}`}
                    disabled={pendente === card.id}
                    onClick={() => void desativar(card)}
                  >
                    {pendente === card.id ? "Desativando…" : "Desativar"}
                  </Button>
                ) : null}
                {canWrite && !card.ativo ? (
                  <Button asChild size="sm" variant="secondary">
                    <Link
                      href={`/app/ai/agents/${card.id}`}
                      data-testid={`publicar-assistente-${card.id}`}
                    >
                      Publicar
                    </Link>
                  </Button>
                ) : null}
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  data-testid={`testar-assistente-${card.specialtyKey ?? card.id}`}
                  disabled={!packAtivo}
                  onClick={() => void testar(card)}
                >
                  Testar
                </Button>
              </div>
              {aberto === card.id ? (
                <div
                  className="mt-3 space-y-2 rounded-xl border border-[var(--color-border)] p-3 text-sm"
                  data-testid="teste-do-assistente"
                >
                  {testando ? <p>Testando…</p> : null}
                  {teste ? (
                    <>
                      <p>
                        <span className="text-muted-foreground">Resultado:</span> {teste.resposta}
                      </p>
                      <p>
                        <span className="text-muted-foreground">Fonte usada:</span>{" "}
                        {teste.knowledge_hint || "nenhum trecho ainda"}
                      </p>
                      <p>
                        <span className="text-muted-foreground">Dado operacional:</span>{" "}
                        {teste.gestao_necessaria
                          ? "não conectado"
                          : teste.tool_que_seria_chamada
                            ? "disponível se a gestão estiver ligada"
                            : "não necessário nesta pergunta"}
                      </p>
                    </>
                  ) : null}
                </div>
              ) : null}
            </li>
          );
        })}
      </ul>
      {packAtivo ? <TestDriveDoPack packId={packId ?? null} instalado={packAtivo} /> : null}
    </div>
  );
}
