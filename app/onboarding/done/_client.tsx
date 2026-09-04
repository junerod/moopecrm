"use client";

import { useTransition } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { finishOnboarding } from "@/app/actions/onboarding/finishOnboarding";
import type { ItemDoResumo } from "@/lib/onboarding/passos";
import type { PecaDoSistema } from "@/lib/onboarding/o-que-mais-existe";
import { CheckCircle, Warning } from "@/lib/ui/icons";

export function DoneClient({
  itens,
  pecas,
}: {
  itens: ItemDoResumo[];
  pecas: PecaDoSistema[];
}) {
  const [pending, startTransition] = useTransition();
  const pendentes = itens.filter((i) => !i.feito);

  return (
    <div className="space-y-6 rounded-2xl border border-white/10 bg-zinc-900/70 p-6 shadow-xl shadow-black/30">
      <div className="space-y-1 text-center">
        <h2 className="text-2xl font-semibold tracking-tight text-white">Tudo pronto!</h2>
        <p className="text-sm text-zinc-400">
          {pendentes.length === 0
            ? "Sua operação está montada. Daqui em diante é acompanhar o que chega."
            : "O essencial já está de pé. O que ficou para depois continua te esperando."}
        </p>
      </div>

      <ul className="mx-auto max-w-sm space-y-2.5 text-left text-sm">
        {itens.map((it) => (
          <li key={it.segmento} className="flex items-center gap-3">
            {it.feito ? (
              <CheckCircle
                size={18}
                weight="fill"
                className="shrink-0 text-emerald-400"
                aria-hidden
              />
            ) : it.pulado ? (
              <Warning size={18} weight="fill" className="shrink-0 text-amber-400" aria-hidden />
            ) : (
              <span
                aria-hidden
                className="inline-block h-4 w-4 shrink-0 rounded-full border border-zinc-600"
              />
            )}
            <span className={it.feito ? "text-zinc-100" : "text-zinc-500"}>
              {it.rotulo}
              {/*
                "Pulado" é escolha da pessoa; "ainda não" é o que ela não
                chegou a fazer. Antes tudo que não estivesse feito virava
                "(pulado)", inclusive passo que a instalação nunca ofereceu —
                o wizard cobrando o que ninguém pediu.
              */}
              {it.pulado ? " (você pulou)" : it.feito ? "" : " (ainda não)"}
            </span>
          </li>
        ))}
      </ul>

      {/*
        O wizard acabava aqui, com um botão que entregava a pessoa numa caixa de
        conversas vazia. Ela tinha acabado de montar um funcionário e não fazia
        ideia de que existe um lugar onde ele pede ajuda, outro que mostra quem
        esfriou, outro onde ele propõe as próprias melhorias. Descobrir isso
        ficava por conta da curiosidade — e quase ninguém volta para explorar
        menu.
      */}
      <section className="space-y-3 border-t border-white/10 pt-6">
        <div>
          <h3 className="text-sm font-medium text-white">O que mais tem aqui</h3>
          <p className="text-xs text-zinc-500">
            Você não precisa mexer em nada disso agora. É só para saber que existe.
          </p>
        </div>
        {/*
          Cada peça abre e mostra COMO funciona, em passos. Uma frase basta para
          dizer que a peça existe; não basta para o follow-up, que é a peça mais
          técnica do produto e a que mais assusta pelo nome — quem lê "volta a
          falar com quem sumiu" sem saber que o retorno PARA quando o cliente
          responde imagina um robô perseguindo cliente, e desliga justamente o
          que mais recupera venda.

          Fechado por padrão: quem acabou de montar o funcionário não precisa ler
          seis tutoriais agora. O que ele precisa é saber que a explicação existe
          e está a um clique.
        */}
        <ul className="grid gap-2 sm:grid-cols-2">
          {pecas.map((p) => (
            <li key={p.href} className="rounded-xl border border-white/10 bg-zinc-950/50 p-3">
              <a href={p.href} className="text-sm font-medium text-accent underline-offset-2 hover:underline">
                {p.comoChamar}
              </a>
              <span className="ml-1 text-xs text-zinc-500">({p.label})</span>
              <p className="mt-1 text-xs text-zinc-500">{p.porQue}</p>

              <details className="group mt-2">
                <summary className="cursor-pointer list-none text-xs text-zinc-500 underline underline-offset-2">
                  Como funciona
                </summary>
                <ol className="mt-2 space-y-1.5">
                  {p.comoFunciona.map((passo, i) => (
                    <li key={passo} className="flex gap-2 text-xs text-zinc-500">
                      <span
                        aria-hidden
                        className="mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded-full border border-white/15 text-[10px]"
                      >
                        {i + 1}
                      </span>
                      <span>{passo}</span>
                    </li>
                  ))}
                </ol>
              </details>
            </li>
          ))}
        </ul>
      </section>

      <div className="flex justify-center">
        <Button
          type="button"
          disabled={pending}
          onClick={() =>
            startTransition(async () => {
              const res = await finishOnboarding();
              if (res && !res.ok) toast.error(`Falha: ${res.error}`);
            })
          }
        >
          {pending ? "Finalizando..." : "Começar a usar"}
        </Button>
      </div>
    </div>
  );
}
