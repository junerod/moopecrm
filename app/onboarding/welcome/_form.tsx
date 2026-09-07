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
  ROTULOS_SUBTYPE,
  SUBTYPES_LOCACAO,
  textoDoRamo,
  type IdDoRamo,
  type SubtypeLocacao,
} from "@/lib/onboarding/ramo-do-negocio";
import { Car, Handshake, PuzzlePiece, ScalesSimple, Storefront, Wrench } from "@/lib/ui/icons";
import { cn } from "@/lib/utils";

const FUSO_PADRAO = "America/Sao_Paulo";

const ICONE_DO_RAMO = {
  locacao: Car,
  advocacia: ScalesSimple,
  comercial: Storefront,
  servicos: Wrench,
  personalizado: PuzzlePiece,
} as const;

export function WelcomeForm({ defaultOrgName }: { defaultOrgName: string }) {
  const [displayName, setDisplayName] = useState(defaultOrgName);
  const [ramo, setRamo] = useState<IdDoRamo | null>(null);
  const [subtype, setSubtype] = useState<SubtypeLocacao | null>(null);
  const [detalhe, setDetalhe] = useState("");
  const [accepted, setAccepted] = useState(false);
  const [pending, startTransition] = useTransition();

  const oQueFaz = ramo ? textoDoRamo(ramo, detalhe, subtype ?? undefined) ?? "" : "";
  const locacaoSemSubtype = ramo === "locacao" && !subtype;

  return (
    <form
      action={(formData) => {
        if (!accepted) {
          toast.error("Aceite os termos para continuar.");
          return;
        }
        if (!ramo) {
          toast.error("Escolha o tipo do seu negócio.");
          return;
        }
        if (locacaoSemSubtype) {
          toast.error("Diga o que vocês alugam principalmente.");
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
        </div>

        <fieldset className="space-y-2">
          <legend className="text-sm font-medium text-zinc-100">Qual é o seu tipo de negócio?</legend>
          <div className="grid gap-2 sm:grid-cols-2">
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
                    name="ready_model_id"
                    value={r.id}
                    checked={marcada}
                    onChange={() => {
                      setRamo(r.id);
                      if (r.id !== "locacao") setSubtype(null);
                    }}
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
        </fieldset>

        {ramo === "locacao" ? (
          <fieldset className="space-y-2">
            <legend className="text-sm font-medium text-zinc-100">
              O que sua empresa aluga principalmente?
            </legend>
            <div className="grid gap-2 sm:grid-cols-2">
              {SUBTYPES_LOCACAO.map((s) => {
                const marcada = subtype === s;
                return (
                  <label
                    key={s}
                    className={cn(
                      "flex cursor-pointer items-center gap-2 rounded-xl border p-3 text-sm",
                      marcada
                        ? "border-accent bg-accent/10 ring-1 ring-accent/40"
                        : "border-white/10 hover:border-accent/40",
                    )}
                  >
                    <input
                      type="radio"
                      name="ready_model_subtype"
                      value={s}
                      checked={marcada}
                      onChange={() => setSubtype(s)}
                      className="sr-only"
                    />
                    <Handshake
                      size={18}
                      className={marcada ? "text-accent" : "text-zinc-500"}
                      aria-hidden
                    />
                    {ROTULOS_SUBTYPE[s]}
                  </label>
                );
              })}
            </div>
          </fieldset>
        ) : null}

        {ramo === "personalizado" ? (
          <Input
            id="o_que_faz_detalhe"
            value={detalhe}
            onChange={(e) => setDetalhe(e.target.value)}
            maxLength={280}
            placeholder="Ex.: clínica, curso, imobiliária"
            className="border-white/10 bg-zinc-950/60"
          />
        ) : null}

        <input type="hidden" name="o_que_faz" value={oQueFaz} />
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
            <Button
              type="submit"
              disabled={pending || !accepted || !ramo || locacaoSemSubtype}
              className="w-full sm:w-auto"
            >
              {pending ? "Salvando..." : "Continuar"}
            </Button>
          }
        />
      </Cartao>
    </form>
  );
}
