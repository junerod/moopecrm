"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";

import { escolherRoteamento, pularRoteamento } from "@/app/actions/onboarding/escolherRoteamento";
import { AcoesDoPasso } from "@/app/onboarding/_components/VoltarDoPasso";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

const OPCOES = [
  {
    id: "manual",
    titulo: "Manual",
    desc: "Os novos atendimentos ficam na fila. Alguém do time assume quando puder.",
  },
  {
    id: "round_robin",
    titulo: "Automaticamente entre os atendentes",
    desc: "O sistema distribui na vez de cada pessoa do time.",
  },
] as const;

export function QuemAtendeForm() {
  const [mode, setMode] = useState<(typeof OPCOES)[number]["id"]>("manual");
  const [pending, startTransition] = useTransition();

  return (
    <form
      className="space-y-6"
      action={(formData) => {
        startTransition(async () => {
          const res = await escolherRoteamento(formData);
          if (res && !res.ok) toast.error(res.error);
        });
      }}
    >
      <fieldset className="space-y-2 rounded-2xl border border-white/10 bg-zinc-900/70 p-6">
        <legend className="text-sm font-medium">Como os novos atendimentos devem ser distribuídos?</legend>
        <div className="grid gap-2">
          {OPCOES.map((o) => (
            <label
              key={o.id}
              className={cn(
                "flex cursor-pointer items-start gap-3 rounded-xl border p-3",
                mode === o.id
                  ? "border-accent bg-accent/10 ring-1 ring-accent/40"
                  : "border-white/10 hover:border-accent/40",
              )}
            >
              <input
                type="radio"
                name="mode"
                value={o.id}
                checked={mode === o.id}
                onChange={() => setMode(o.id)}
                className="mt-1"
              />
              <span>
                <span className="block text-sm font-medium">{o.titulo}</span>
                <span className="block text-xs text-muted-foreground">{o.desc}</span>
              </span>
            </label>
          ))}
        </div>
        <p className="text-xs text-muted-foreground">
          Dá para convidar o time no último passo e mudar isto depois em Configurações ›
          Atendimento.
        </p>
      </fieldset>
      <AcoesDoPasso
        segmento="quem-atende"
        pular={
          <Button
            type="button"
            variant="ghost"
            disabled={pending}
            onClick={() => startTransition(() => void pularRoteamento())}
          >
            Decidir depois
          </Button>
        }
        avancar={
          <Button type="submit" disabled={pending} className="w-full sm:w-auto">
            {pending ? "Salvando..." : "Continuar"}
          </Button>
        }
      />
    </form>
  );
}
