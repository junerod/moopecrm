"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";

import { acceptWelcome } from "@/app/actions/onboarding/acceptWelcome";
import { Cartao } from "@/app/onboarding/_components/Cartao";
import { AcoesDoPasso } from "@/app/onboarding/_components/VoltarDoPasso";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  RAMOS_DO_NEGOCIO,
  textoDoRamo,
  type IdDoRamo,
} from "@/lib/onboarding/ramo-do-negocio";
import { Car, PuzzlePiece, ScalesSimple } from "@/lib/ui/icons";
import { cn } from "@/lib/utils";

const FUSO_PADRAO = "America/Sao_Paulo";

const ICONE_DO_RAMO = {
  locadora: Car,
  advocacia: ScalesSimple,
  outros: PuzzlePiece,
} as const;

export function WelcomeForm({ defaultOrgName }: { defaultOrgName: string }) {
  const [displayName, setDisplayName] = useState(defaultOrgName);
  const [ramo, setRamo] = useState<IdDoRamo | null>(null);
  const [detalhe, setDetalhe] = useState("");
  const [accepted, setAccepted] = useState(false);
  const [pending, startTransition] = useTransition();

  const oQueFaz = ramo ? textoDoRamo(ramo, detalhe) ?? "" : "";

  return (
    <form
      action={(formData) => {
        if (!accepted) {
          toast.error("Aceite os termos para continuar.");
          return;
        }
        startTransition(async () => {
          const res = await acceptWelcome(formData);
          if (res && !res.ok) {
            toast.error(`Falha: ${res.error}`);
          }
        });
      }}
    >
      <Cartao>
        <div className="space-y-2">
          <Label htmlFor="display_name">Como se chama o seu negócio?</Label>
          <Input
            id="display_name"
            name="display_name"
            value={displayName}
            onChange={(e) => setDisplayName(e.target.value)}
            minLength={2}
            maxLength={120}
            required
            className="border-white/10 bg-zinc-950/60"
          />
          <p className="text-xs text-zinc-500">
            É o nome que aparece para o seu time e nos relatórios.
          </p>
        </div>

        {/*
          A pergunta que faltava no produto inteiro. Sem ela, o funcionário nasce
          se apresentando como atendente de uma "loja online" — era o que os três
          modelos de prompt diziam — e o quadro de clientes nasce com as colunas
          de e-commerce que o gatilho semeia. Os dois defeitos têm a mesma origem:
          uma instalação que nunca pergunta em que ramo entrou.

          As três portas mandam a MESMA prosa que o funil já reconhece. "Outros"
          abre o campo livre — clínica, loja, imobiliária, o que já existia.
        */}
        <fieldset className="space-y-2">
          <legend className="text-sm font-medium text-zinc-100">O que vocês fazem?</legend>
          <div className="grid gap-2 sm:grid-cols-3">
            {RAMOS_DO_NEGOCIO.map((r) => {
              const Icone = ICONE_DO_RAMO[r.id];
              const marcada = ramo === r.id;
              return (
                <label
                  key={r.id}
                  className={cn(
                    "flex cursor-pointer flex-col gap-2 rounded-xl border p-3 transition-colors",
                    marcada
                      ? "border-accent bg-accent/10 ring-1 ring-accent/40"
                      : "border-white/10 hover:border-accent/40 hover:bg-white/5",
                  )}
                >
                  <input
                    type="radio"
                    name="ramo_do_negocio"
                    value={r.id}
                    checked={marcada}
                    onChange={() => setRamo(r.id)}
                    className="sr-only"
                  />
                  <Icone
                    size={22}
                    weight={marcada ? "fill" : "regular"}
                    className={marcada ? "text-accent" : "text-zinc-400"}
                    aria-hidden
                  />
                  <span className="text-sm font-medium text-zinc-100">{r.rotulo}</span>
                  <span className="text-xs leading-snug text-zinc-500">{r.desc}</span>
                </label>
              );
            })}
          </div>
          {ramo === "outros" ? (
            <Input
              id="o_que_faz_detalhe"
              value={detalhe}
              onChange={(e) => setDetalhe(e.target.value)}
              maxLength={280}
              placeholder="Ex.: clínica odontológica, ou venda de roupa fitness pelo WhatsApp"
              className="border-white/10 bg-zinc-950/60"
            />
          ) : null}
          <input type="hidden" id="o_que_faz" name="o_que_faz" value={oQueFaz} />
          <p className="text-xs text-zinc-500">
            É com isso que montamos o quadro de clientes do seu jeito — locadora
            ganha Locatários e Cobrança; escritório ganha captação e processos.
          </p>
        </fieldset>

        {/*
          O fuso decide o horário em que o agente pode falar. Quase todo mundo
          que instala atende no horário de Brasília — mostrar a lista de
          identificadores só atrapalhava. O valor segue indo no formulário, e
          dá para trocar depois em Configurações.
        */}
        <input type="hidden" name="timezone" value={FUSO_PADRAO} />

        <label className="flex items-start gap-2 text-sm text-zinc-300">
          <input
            type="checkbox"
            checked={accepted}
            onChange={(e) => setAccepted(e.target.checked)}
            className="mt-1 accent-accent"
            required
          />
          <span>
            Li e aceito os{" "}
            <a className="text-accent underline" href="/legal/terms" target="_blank" rel="noreferrer">
              Termos de Uso
            </a>{" "}
            e a{" "}
            <a className="text-accent underline" href="/legal/privacy" target="_blank" rel="noreferrer">
              Política de Privacidade
            </a>
            .
          </span>
        </label>

        <AcoesDoPasso
          segmento="welcome"
          avancar={
            <Button type="submit" disabled={pending || !accepted} className="w-full sm:w-auto">
              {pending ? "Salvando..." : "Continuar"}
            </Button>
          }
        />
      </Cartao>
    </form>
  );
}
