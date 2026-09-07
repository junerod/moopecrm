"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";

import { escolherModoDaIa } from "@/app/actions/onboarding/escolherModoDaIa";
import { skipAi } from "@/app/actions/onboarding/createDefaultAgent";
import { AcoesDoPasso } from "@/app/onboarding/_components/VoltarDoPasso";
import { Button } from "@/components/ui/button";
import type { AiMode } from "@/lib/schemas/settings";
import { cn } from "@/lib/utils";

const MODOS: { id: AiMode; titulo: string; desc: string }[] = [
  {
    id: "off",
    titulo: "Sem IA",
    desc: "Use CRM, WhatsApp e automações normalmente.",
  },
  {
    id: "copilot",
    titulo: "Assistente IA",
    desc: "A IA resume conversas e sugere respostas para sua equipe.",
  },
  {
    id: "controlled",
    titulo: "IA controlada",
    desc: "A IA pode ajudar e executar apenas ações que você autorizar.",
  },
  {
    id: "autonomous",
    titulo: "Atendimento automático",
    desc: "A IA pode atender automaticamente dentro das regras configuradas.",
  },
];

export function SetupAiForm() {
  const [modo, setModo] = useState<AiMode>("off");
  const [pending, startTransition] = useTransition();

  return (
    <form
      className="space-y-6"
      action={(formData) => {
        startTransition(async () => {
          const res = await escolherModoDaIa(formData);
          if (res && !res.ok) toast.error(res.error);
        });
      }}
    >
      <fieldset className="space-y-2 rounded-2xl border border-white/10 bg-zinc-900/70 p-6">
        <legend className="text-sm font-medium">Como você quer usar Inteligência Artificial?</legend>
        <div className="grid gap-2">
          {MODOS.map((m) => (
            <label
              key={m.id}
              className={cn(
                "flex cursor-pointer items-start gap-3 rounded-xl border p-3",
                modo === m.id
                  ? "border-accent bg-accent/10 ring-1 ring-accent/40"
                  : "border-white/10 hover:border-accent/40",
              )}
            >
              <input
                type="radio"
                name="ai_mode"
                value={m.id}
                checked={modo === m.id}
                onChange={() => setModo(m.id)}
                className="mt-1"
              />
              <span>
                <span className="block text-sm font-medium">{m.titulo}</span>
                <span className="block text-xs text-muted-foreground">{m.desc}</span>
              </span>
            </label>
          ))}
        </div>
        <p className="text-xs text-muted-foreground">
          Nenhuma destas opções publica um agente sozinha. Atendimento automático
          só começa depois que você configurar o agente em IA › Agentes.
        </p>
      </fieldset>
      <AcoesDoPasso
        segmento="setup-ai"
        pular={
          <Button
            type="button"
            variant="ghost"
            disabled={pending}
            onClick={() => startTransition(() => void skipAi())}
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
