"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";

import { escolherFollowup, pularFollowup } from "@/app/actions/onboarding/escolherFollowup";
import { AcoesDoPasso } from "@/app/onboarding/_components/VoltarDoPasso";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export function FollowupForm() {
  const [ativo, setAtivo] = useState<"sim" | "nao">("nao");
  const [pending, startTransition] = useTransition();

  return (
    <form
      className="space-y-6"
      action={(formData) => {
        startTransition(async () => {
          const res = await escolherFollowup(formData);
          if (res && !res.ok) toast.error(res.error);
        });
      }}
    >
      <fieldset className="space-y-2 rounded-2xl border border-white/10 bg-zinc-900/70 p-6">
        <legend className="text-sm font-medium">
          Quer lembrar automaticamente clientes que pararam de responder?
        </legend>
        {(
          [
            { id: "sim", titulo: "Sim", desc: "Um lembrete após 24 horas sem resposta." },
            { id: "nao", titulo: "Não", desc: "Ninguém recebe mensagem automática por silêncio." },
          ] as const
        ).map((o) => (
          <label
            key={o.id}
            className={cn(
              "flex cursor-pointer items-start gap-3 rounded-xl border p-3",
              ativo === o.id
                ? "border-accent bg-accent/10 ring-1 ring-accent/40"
                : "border-white/10 hover:border-accent/40",
            )}
          >
            <input
              type="radio"
              name="ativo"
              value={o.id}
              checked={ativo === o.id}
              onChange={() => setAtivo(o.id)}
              className="mt-1"
            />
            <span>
              <span className="block text-sm font-medium">{o.titulo}</span>
              <span className="block text-xs text-muted-foreground">{o.desc}</span>
            </span>
          </label>
        ))}
      </fieldset>
      <AcoesDoPasso
        segmento="follow-up"
        pular={
          <Button
            type="button"
            variant="ghost"
            disabled={pending}
            onClick={() => startTransition(() => void pularFollowup())}
          >
            Pular
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
