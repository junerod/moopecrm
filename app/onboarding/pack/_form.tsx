"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";

import { instalarPackDoOnboarding, pularPack } from "@/app/actions/onboarding/instalarPack";
import { AcoesDoPasso } from "@/app/onboarding/_components/VoltarDoPasso";
import { Cartao } from "@/app/onboarding/_components/Cartao";
import { Button } from "@/components/ui/button";
import { Check } from "@/lib/ui/icons";

const ITENS = [
  "Funil comercial",
  "Atendimento",
  "Agentes prontos",
  "Automações",
  "Conhecimento",
  "Campanhas",
  "Integração MOOPE Gestão",
];

export function PackReviewForm({ label }: { label: string }) {
  const [pending, start] = useTransition();
  const [pulando, startPular] = useTransition();
  const [pronto, setPronto] = useState(false);

  return (
    <Cartao>
      {pronto ? (
        <div className="space-y-3" data-testid="pack-instalado">
          <h3 className="text-lg font-semibold text-white">Seu CRM para locadora está pronto</h3>
          <p className="text-sm text-zinc-400">
            Você já pode conectar o WhatsApp, ensinar os assistentes e começar a atender.
          </p>
        </div>
      ) : (
        <ul className="space-y-2">
          {ITENS.map((item) => (
            <li key={item} className="flex items-center gap-2 text-sm text-zinc-200">
              <Check size={16} className="text-accent" aria-hidden />
              {item}
            </li>
          ))}
        </ul>
      )}

      <AcoesDoPasso
        segmento="pack"
        pular={
          <Button
            type="button"
            variant="ghost"
            disabled={pending || pulando}
            onClick={() => {
              startPular(async () => {
                await pularPack();
              });
            }}
          >
            Agora não
          </Button>
        }
        avancar={
          <Button
            type="button"
            data-testid="preparar-locadora"
            disabled={pending || pulando}
            onClick={() => {
              start(async () => {
                const r = await instalarPackDoOnboarding();
                if (r && !r.ok) {
                  toast.error(r.erro);
                  return;
                }
                setPronto(true);
              });
            }}
          >
            {pending ? "Preparando..." : `Preparar minha ${label.toLowerCase()}`}
          </Button>
        }
      />
    </Cartao>
  );
}
