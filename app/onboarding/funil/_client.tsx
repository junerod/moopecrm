"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";

import { aplicarQuadro, pularQuadro, type QuadroAtual } from "@/app/actions/onboarding/montarQuadro";
import { AcoesDoPasso } from "@/app/onboarding/_components/VoltarDoPasso";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { MAX_ETAPAS, MIN_ETAPAS, type PropostaDeFunil } from "@/lib/onboarding/proposta-de-funil";

export function QuadroClient({
  atual,
  propostaInicial,
  rotulo,
  editavel,
}: {
  atual: QuadroAtual | null;
  propostaInicial: PropostaDeFunil;
  rotulo: string;
  editavel: boolean;
}) {
  const [quadro, setQuadro] = useState<PropostaDeFunil>(propostaInicial);
  const [pending, startTransition] = useTransition();
  const semNome = quadro.etapas.some((e) => !e.nome.trim());

  function renomear(i: number, nome: string) {
    setQuadro((q) => ({ ...q, etapas: q.etapas.map((e, j) => (j === i ? { ...e, nome } : e)) }));
  }

  return (
    <div className="space-y-6">
      <p className="rounded-md border border-white/10 bg-zinc-900/50 p-3 text-sm text-zinc-300">
        Sugerimos esta organização para <strong>{rotulo}</strong>. Você pode mudar os
        nomes depois, em Configurações › Funis.
      </p>

      <div className="space-y-3 rounded-2xl border border-white/10 bg-zinc-900/70 p-6 shadow-xl shadow-black/30">
        <div className="space-y-2">
          <label className="text-sm font-medium" htmlFor="nome_do_quadro">
            Nome do quadro
          </label>
          <Input
            id="nome_do_quadro"
            value={quadro.nome}
            onChange={(e) => setQuadro((q) => ({ ...q, nome: e.target.value }))}
            maxLength={80}
            disabled={!editavel}
          />
        </div>

        <ol className="space-y-2">
          {quadro.etapas.map((etapa, i) => (
            <li key={i} className="flex items-center gap-2 rounded-md border border-white/10 p-3">
              <span aria-hidden className="w-5 shrink-0 text-center text-xs text-muted-foreground">
                {i + 1}
              </span>
              {editavel ? (
                <Input
                  aria-label={`Nome da etapa ${i + 1}`}
                  value={etapa.nome}
                  onChange={(e) => renomear(i, e.target.value)}
                  maxLength={60}
                />
              ) : (
                <span className="text-sm">{etapa.nome}</span>
              )}
            </li>
          ))}
        </ol>
        {editavel ? (
          <p className="text-xs text-muted-foreground">
            Mude só os nomes. Precisa de pelo menos {MIN_ETAPAS} etapas e no máximo {MAX_ETAPAS}.
          </p>
        ) : null}
      </div>

      {atual && atual.colunas.length > 0 ? (
        <p className="text-xs text-muted-foreground">
          Hoje o quadro se chama «{atual.nome}»: {atual.colunas.join(" → ")}.
        </p>
      ) : null}

      <AcoesDoPasso
        segmento="funil"
        pular={
          <Button
            type="button"
            variant="ghost"
            disabled={pending}
            onClick={() => startTransition(async () => void (await pularQuadro()))}
          >
            Pular por enquanto
          </Button>
        }
        avancar={
          <Button
            type="button"
            disabled={pending || semNome}
            onClick={() =>
              startTransition(async () => {
                const fd = new FormData();
                fd.set("quadro", JSON.stringify(quadro));
                fd.set("origem", "ready_model");
                const res = await aplicarQuadro(fd);
                if (res && !res.ok) toast.error(res.erro);
              })
            }
          >
            {pending ? "Salvando..." : "Usar esta organização"}
          </Button>
        }
      />
    </div>
  );
}
