"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { toast } from "sonner";

import { AppIcon } from "@/components/ds/AppIcon";
import { StatusBadge } from "@/components/ds/StatusBadge";
import { instalarPack } from "@/components/negocio/acoes-do-pack";
import { Button } from "@/components/ui/button";
import { testidAtivarModelo } from "@/lib/business-packs/apresentacao";
import { testidReativarPack } from "@/lib/business-packs/testids";
import type { BusinessPackGravado } from "@/lib/business-packs/tipos";
import { visualDoPack } from "@/lib/business-packs/visual";

type ItemDaLoja = {
  id: string;
  label: string;
  description: string;
  resumo: { assistentes: number; etapas: number; automacoes: number };
};

export function ModelosProntosClient(props: {
  loja: ItemDaLoja[];
  instalado: BusinessPackGravado | null;
  packAtivo: boolean;
  podeInstalar: boolean;
  checklistProgresso: { label: string; concluidos: number; total: number; pronto: boolean } | null;
}) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [confirmaTroca, setConfirmaTroca] = useState<string | null>(null);

  function ativar(alvo: string, confirmado = false) {
    if (!confirmado && props.instalado && props.instalado.id !== alvo) {
      setConfirmaTroca(alvo);
      return;
    }
    start(async () => {
      const ok = await instalarPack(alvo);
      if (!ok) {
        toast.error("Não consegui preparar a operação.");
        return;
      }
      toast.success("Operação preparada. Complete os passos no seu modelo.");
      router.push("/app/meu-modelo");
      router.refresh();
    });
  }

  const packAtivoNaEmpresa = Boolean(props.instalado && props.packAtivo);
  const ativoId = props.instalado?.id;
  const ativoLabel = props.loja.find((p) => p.id === ativoId)?.label ?? props.checklistProgresso?.label;

  return (
    <div className="space-y-8">
      {packAtivoNaEmpresa && ativoLabel ? (
        <section
          data-testid="pack-pronto"
          className="flex flex-wrap items-center justify-between gap-4 rounded-2xl bg-[var(--color-surface)] px-5 py-4 shadow-[var(--shadow-sm)] ring-1 ring-[var(--color-border)]"
        >
          <div>
            <p className="text-[11px] font-medium uppercase tracking-[0.16em] text-[var(--color-text-muted)]">
              Modelo em uso
            </p>
            <h2 className="mt-1 text-lg font-semibold tracking-tight">{ativoLabel}</h2>
            {props.checklistProgresso ? (
              <>
                <p className="mt-1 text-sm text-[var(--color-text-muted)]" data-testid="checklist-progresso">
                  {props.checklistProgresso.concluidos} de {props.checklistProgresso.total} passos concluídos
                </p>
                {props.checklistProgresso.pronto ? (
                  <p className="text-sm font-medium text-emerald-700 dark:text-emerald-400" data-testid="checklist-pronto">
                    Pronto para trabalhar
                  </p>
                ) : null}
              </>
            ) : null}
          </div>
          <div className="flex flex-wrap gap-2">
            <Button asChild data-testid="loja-continuar-configuracao">
              <Link href="/app/meu-modelo">Continuar configuração</Link>
            </Button>
            <Button asChild variant="outline">
              <Link href="/app/ai/agents">Ver assistentes</Link>
            </Button>
          </div>
        </section>
      ) : null}

      <section className="space-y-4" data-testid="catalogo-de-modelos">
        <div>
          <h2 className="text-xl font-semibold tracking-tight">Escolha um modelo</h2>
          <p className="mt-1 text-sm text-[var(--color-text-muted)]">
            Um clique instala a operação. Você só coloca o material da empresa.
          </p>
        </div>
        <ul className="grid gap-3 sm:grid-cols-2">
          {props.loja.map((item) => {
            const ehInstalado = props.instalado?.id === item.id;
            const ativo = ehInstalado && props.packAtivo;
            const inativo = ehInstalado && !props.packAtivo;
            const v = visualDoPack(item.id, item.description);
            return (
              <li key={item.id} data-testid={`catalogo-pack-${item.id}`}>
                <article className="flex h-full flex-col rounded-2xl bg-[var(--color-surface)] p-5 shadow-[var(--shadow-sm)] ring-1 ring-[var(--color-border)]">
                  <div className="flex items-start gap-3">
                    <AppIcon icon={v.icone} tone={v.tom} size="lg" />
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="font-semibold tracking-tight">{item.label}</p>
                        {ativo ? (
                          <StatusBadge tone="green" data-testid="pack-loja-ativo">
                            ATIVO
                          </StatusBadge>
                        ) : inativo ? (
                          <StatusBadge tone="amber" data-testid="pack-loja-inativo">
                            Desligado
                          </StatusBadge>
                        ) : null}
                      </div>
                      <p className="mt-1 text-sm leading-5 text-[var(--color-text-muted)]">{v.frase}</p>
                    </div>
                  </div>
                  <div className="mt-4 flex flex-wrap gap-2">
                    {ativo ? (
                      <Button asChild size="sm">
                        <Link href="/app/meu-modelo">Abrir configuração</Link>
                      </Button>
                    ) : props.podeInstalar ? (
                      inativo ? (
                        <Button
                          size="sm"
                          data-testid={testidReativarPack(item.id)}
                          disabled={pending}
                          onClick={() => ativar(item.id)}
                        >
                          {pending ? "Ativando..." : "Ativar de novo"}
                        </Button>
                      ) : (
                        <Button
                          size="sm"
                          data-testid={testidAtivarModelo(item.id)}
                          disabled={pending}
                          onClick={() => ativar(item.id)}
                        >
                          {pending ? "Preparando..." : "Ativar"}
                        </Button>
                      )
                    ) : (
                      <p className="text-sm text-[var(--color-text-muted)]">Peça a quem administra para ativar.</p>
                    )}
                    <Button asChild size="sm" variant="outline">
                      <Link href={`/app/modelos-prontos/${item.id}`}>Ver modelo</Link>
                    </Button>
                  </div>
                </article>
              </li>
            );
          })}
        </ul>
        {confirmaTroca ? (
          <div className="rounded-2xl bg-[var(--color-surface)] p-5 ring-1 ring-[var(--color-accent)]">
            <p className="text-sm leading-6">
              Isso instala o modelo <strong>{props.loja.find((p) => p.id === confirmaTroca)?.label}</strong>.
              O conjunto anterior não é apagado.
            </p>
            <div className="mt-3 flex flex-wrap gap-2">
              <Button
                disabled={pending}
                  onClick={() => {
                  const alvo = confirmaTroca;
                  setConfirmaTroca(null);
                  if (alvo) ativar(alvo, true);
                }}
              >
                Confirmar e ativar
              </Button>
              <Button variant="ghost" onClick={() => setConfirmaTroca(null)}>
                Cancelar
              </Button>
            </div>
          </div>
        ) : null}
      </section>
    </div>
  );
}
