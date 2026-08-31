"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { toast } from "sonner";

import { aplicarPerfilAction } from "@/app/actions/settings/aplicarPerfil";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { PACOTES } from "@/lib/onboarding/pacotes-de-funil";
import type { IdDePerfil } from "@/lib/onboarding/aplicar-perfil";

const EXTRA: Partial<Record<IdDePerfil, string>> = {
  locadora: "Dois quadros: Locatários (contrato) e Cobrança (atraso).",
  advocacia: "Dois quadros: Novos clientes e Processos.",
  saas: "Quadro da venda do sistema — demo, proposta, cliente ativo.",
};

export function PerfilDoNegocioForm({ atual }: { atual: IdDePerfil | null }) {
  const router = useRouter();
  const [escolhido, setEscolhido] = useState<IdDePerfil | null>(atual);
  const [isPending, startTransition] = useTransition();

  function aplicar() {
    if (!escolhido) return;
    startTransition(async () => {
      const r = await aplicarPerfilAction({ perfil: escolhido });
      if (!r.ok) {
        toast.error(r.error);
        return;
      }
      toast.success(
        r.criouQuadroNovo
          ? "Perfil ligado. O quadro antigo ficou de lado — os cards dele não foram apagados."
          : "Perfil ligado. O quadro padrão já é este.",
      );
      router.refresh();
    });
  }

  return (
    <div className="max-w-2xl space-y-4">
      <p className="text-sm text-muted-foreground">
        Trocar não apaga funil com card. O perfil novo vira o quadro padrão;
        o anterior continua na lista de funis.
      </p>
      <div className="grid gap-3">
        {PACOTES.map((p) => {
          const marcado = escolhido === p.id;
          return (
            <Card
              key={p.id}
              className={
                marcado
                  ? "border-primary p-4"
                  : "cursor-pointer p-4 hover:border-foreground/20"
              }
            >
              <label className="flex cursor-pointer items-start gap-3">
                <input
                  type="radio"
                  name="perfil"
                  value={p.id}
                  checked={marcado}
                  onChange={() => setEscolhido(p.id)}
                  className="mt-1"
                />
                <span className="min-w-0">
                  <span className="flex items-center gap-2">
                    <span className="font-medium">{p.comoSeApresenta}</span>
                    {atual === p.id ? (
                      <span className="text-xs font-normal text-muted-foreground">em uso</span>
                    ) : null}
                  </span>
                  <span className="mt-1 block text-sm text-muted-foreground">
                    Quadro «{p.proposta.nome}»: {p.proposta.etapas.map((e) => e.nome).join(" → ")}
                    {EXTRA[p.id] ? ` ${EXTRA[p.id]}` : ""}
                  </span>
                </span>
              </label>
            </Card>
          );
        })}
      </div>
      <Button
        type="button"
        disabled={!escolhido || isPending}
        onClick={aplicar}
      >
        {isPending ? "Aplicando…" : escolhido === atual ? "Aplicar de novo" : "Usar este perfil"}
      </Button>
    </div>
  );
}
