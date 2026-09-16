"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { toast } from "sonner";

import { AppIcon } from "@/components/ds/AppIcon";
import { StatusBadge } from "@/components/ds/StatusBadge";
import { ChecklistPosAtivacao } from "@/components/negocio/ChecklistPosAtivacao";
import { FluxosProntosDoPack, type FluxoProntoNaTela } from "@/components/negocio/FluxosProntosDoPack";
import { instalarPack, mudarEstadoDoPack } from "@/components/negocio/acoes-do-pack";
import { Button } from "@/components/ui/button";
import type { ChecklistDoPack } from "@/lib/business-packs/checklist";
import { testidDesativarPack } from "@/lib/business-packs/testids";
import { visualDoPack } from "@/lib/business-packs/visual";

type CardOperacao = {
  titulo: string;
  linhas: string[];
  href: string;
  cta: string;
  testid: string;
};

export function MeuModeloClient(props: {
  packId: string;
  packLabel: string;
  checklist: ChecklistDoPack;
  podeInstalar: boolean;
  podeEscrever: boolean;
  fluxos: FluxoProntoNaTela[];
  cards: CardOperacao[];
}) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [confirmaDesligar, setConfirmaDesligar] = useState(false);
  const v = visualDoPack(props.packId);

  function reaplicar() {
    start(async () => {
      const ok = await instalarPack(props.packId);
      if (!ok) {
        toast.error("Não consegui reaplicar o modelo.");
        return;
      }
      toast.success("Operação preparada.");
      router.refresh();
    });
  }

  function desligar() {
    start(async () => {
      const ok = await mudarEstadoDoPack("deactivate");
      if (!ok) {
        toast.error("Não consegui desativar o pack.");
        return;
      }
      toast.success("Pack desativado. Os assistentes do modelo estão desligados.");
      setConfirmaDesligar(false);
      router.push("/app/modelos-prontos");
      router.refresh();
    });
  }

  return (
    <div className="space-y-8">
      <header
        data-testid="pack-pronto"
        className="flex flex-wrap items-start justify-between gap-4 rounded-2xl bg-[var(--color-surface)] px-5 py-5 shadow-[var(--shadow-sm)] ring-1 ring-[var(--color-border)]"
      >
        <div>
          <p className="text-[11px] font-medium uppercase tracking-[0.16em] text-[var(--color-text-muted)]">
            Seu modelo
          </p>
          <h2 className="mt-1 flex flex-wrap items-center gap-2 text-2xl font-semibold tracking-tight">
            <AppIcon icon={v.icone} tone={v.tom} size="lg" />
            {props.packLabel}
            <StatusBadge tone="green">ATIVO</StatusBadge>
          </h2>
          <p className="mt-2 text-sm text-[var(--color-text-muted)]">
            Sua operação está preparada. Complete os passos abaixo.
          </p>
        </div>
      </header>

      <ChecklistPosAtivacao checklist={props.checklist} />

      {props.fluxos.length > 0 ? (
        <FluxosProntosDoPack fluxos={props.fluxos} canWrite={props.podeEscrever} />
      ) : null}

      <section>
        <h3 className="text-sm font-semibold">Resumo da operação</h3>
        <ul className="mt-3 grid gap-3 sm:grid-cols-2">
          {props.cards.map((c) => (
            <li
              key={c.titulo}
              data-testid={c.testid}
              className="flex flex-col justify-between rounded-2xl bg-[var(--color-surface)] p-4 ring-1 ring-[var(--color-border)]"
            >
              <div>
                <p className="text-[11px] font-medium uppercase tracking-[0.16em] text-[var(--color-text-muted)]">
                  {c.titulo}
                </p>
                {c.linhas.map((l) => (
                  <p key={l} className="mt-1 text-sm text-[var(--color-text)]">
                    {l}
                  </p>
                ))}
              </div>
              <div className="mt-3">
                <Button asChild size="sm">
                  <Link href={c.href}>{c.cta}</Link>
                </Button>
              </div>
            </li>
          ))}
        </ul>
      </section>

      <p className="text-sm">
        <Link href="/app/modelos-prontos" className="text-[var(--color-text-muted)] underline-offset-4 hover:underline">
          Trocar modelo
        </Link>
      </p>

      {props.podeInstalar ? (
        <footer className="space-y-3 border-t border-[var(--color-border)] pt-4">
          <p className="text-[11px] font-medium uppercase tracking-[0.16em] text-[var(--color-text-muted)]">
            Mais opções
          </p>
          <div className="flex flex-wrap items-center gap-3">
            <Button variant="outline" size="sm" disabled={pending} onClick={reaplicar}>
              {pending ? "Reaplicando..." : "Reaplicar sem duplicar"}
            </Button>
            {confirmaDesligar ? (
              <div className="w-full rounded-xl p-4 ring-1 ring-[var(--color-border)]">
                <p className="text-sm">Desliga os assistentes do modelo. Nada é apagado.</p>
                <div className="mt-2 flex gap-2">
                  <Button
                    variant="destructive"
                    size="sm"
                    data-testid="confirmar-desativar-pack"
                    disabled={pending}
                    onClick={desligar}
                  >
                    Desligar assistentes
                  </Button>
                  <Button variant="ghost" size="sm" onClick={() => setConfirmaDesligar(false)}>
                    Cancelar
                  </Button>
                </div>
              </div>
            ) : (
              <button
                type="button"
                data-testid={testidDesativarPack(props.packId)}
                className="text-xs text-[var(--color-text-muted)] underline-offset-4 hover:underline"
                onClick={() => setConfirmaDesligar(true)}
              >
                Desativar pack
              </button>
            )}
          </div>
        </footer>
      ) : null}
    </div>
  );
}
