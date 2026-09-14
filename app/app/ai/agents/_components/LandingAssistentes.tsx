"use client";

import Link from "next/link";
import { useState } from "react";
import { toast } from "sonner";

import { TestDriveDoPack } from "@/components/negocio/TestDriveDoPack";
import { Button } from "@/components/ui/button";
import { perguntaDeTeste } from "@/lib/business-packs/apresentacao";
import { resolverPack } from "@/lib/business-packs/catalogo";
import { cn } from "@/lib/utils";

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

export function LandingAssistentes({
  packAtivo,
  packLabel,
  packId,
  cards,
  canWrite,
}: {
  packAtivo: boolean;
  packLabel: string | null;
  packId?: string | null;
  cards: CardAssistente[];
  canWrite: boolean;
}) {
  const [aberto, setAberto] = useState<string | null>(null);
  const [teste, setTeste] = useState<ResultadoTeste | null>(null);
  const [testando, setTestando] = useState(false);

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
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <h1 className="text-2xl font-semibold tracking-tight">Assistentes</h1>
          <p className="text-sm text-muted-foreground">
            Configure quem atende, vende e ajuda sua equipe.
          </p>
          {packAtivo && packLabel ? (
            <p className="mt-2 text-sm font-medium" data-testid="pack-locadora-banner">
              Pack ativo: {packLabel}
            </p>
          ) : null}
          {packAtivo ? (
            <p className="text-sm text-muted-foreground">
              Seu pack {packLabel} possui {cards.filter((c) => c.specialtyKey).length} assistentes
              prontos.
            </p>
          ) : null}
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

      <ul className="grid gap-3 md:grid-cols-2" data-testid="meus-assistentes">
        {cards.map((card) => {
          const papel = card.description;
          return (
            <li
              key={card.id}
              data-testid={`card-assistente-${card.specialtyKey ?? card.id}`}
              className="rounded-[16px] border border-[var(--color-border)] bg-[var(--color-surface)] p-4"
            >
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div className="min-w-0">
                  <p className="font-medium">{card.name}</p>
                  <p className="text-sm text-muted-foreground">{papel}</p>
                </div>
                <span
                  className={cn(
                    "rounded-full px-2 py-0.5 text-xs font-medium uppercase tracking-wide",
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
                <p className="mt-2 text-xs font-medium" data-testid="assistente-principal">
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
