"use client";

import { useState } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";

export type FluxoProntoNaTela = {
  key: string;
  name: string;
  description: string;
  quando: string;
  mensagem: string;
  ativo: boolean;
};

export function FluxosProntosDoPack({
  fluxos,
  canWrite,
}: {
  fluxos: FluxoProntoNaTela[];
  canWrite: boolean;
}) {
  return (
    <section id="fluxos-prontos" data-testid="fluxos-prontos-do-pack" className="space-y-3">
      <div>
        <h3 className="text-sm font-semibold">Fluxos prontos</h3>
        <p className="mt-1 text-sm text-[var(--color-text-muted)]">
          Já vêm com condição, espera e texto. Revise a mensagem e ligue o que
          quiser. Nada dispara sozinho.
        </p>
      </div>
      <ul className="grid gap-3 md:grid-cols-2">
        {fluxos.map((f) => (
          <li key={f.key}>
            <CardDoFluxo fluxo={f} canWrite={canWrite} />
          </li>
        ))}
      </ul>
    </section>
  );
}

function CardDoFluxo({ fluxo, canWrite }: { fluxo: FluxoProntoNaTela; canWrite: boolean }) {
  const [mensagem, setMensagem] = useState(fluxo.mensagem);
  const [ativo, setAtivo] = useState(fluxo.ativo);
  const [enviando, setEnviando] = useState(false);

  async function gravar(ligar: boolean) {
    const texto = mensagem.trim();
    if (!texto) {
      toast.error("Escreva a mensagem deste fluxo.");
      return;
    }
    setEnviando(true);
    try {
      const res = await fetch("/api/v1/ai/followup-flows/pronto-do-pack", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ key: fluxo.key, mensagem: texto, ativo: ligar }),
      });
      const json = (await res.json()) as { error?: { message?: string } };
      if (!res.ok) {
        toast.error(json.error?.message ?? "Não consegui gravar o fluxo.");
        return;
      }
      setAtivo(ligar);
      toast.success(ligar ? (ativo ? "Texto salvo." : "Fluxo ligado.") : "Fluxo desligado.");
    } catch {
      toast.error("Não consegui falar com o servidor.");
    } finally {
      setEnviando(false);
    }
  }

  return (
    <article
      data-testid={`fluxo-pronto-${fluxo.key}`}
      className="flex h-full flex-col rounded-2xl bg-[var(--color-surface)] p-4 ring-1 ring-[var(--color-border)]"
    >
      <p className="text-sm font-semibold">{fluxo.name}</p>
      <p className="mt-1 text-sm text-[var(--color-text-muted)]">{fluxo.description}</p>
      <p className="mt-2 text-xs text-[var(--color-text-muted)]">{fluxo.quando}</p>
      <Textarea
        data-testid={`fluxo-pronto-${fluxo.key}-mensagem`}
        className="mt-3"
        rows={4}
        maxLength={1000}
        value={mensagem}
        disabled={!canWrite}
        onChange={(e) => setMensagem(e.target.value)}
      />
      {ativo ? (
        <p data-testid={`fluxo-pronto-${fluxo.key}-ativo`} className="mt-2 text-sm font-medium">
          Ligado
        </p>
      ) : (
        <p className="mt-2 text-sm text-[var(--color-text-muted)]">Desligado</p>
      )}
      {canWrite ? (
        <div className="mt-3 flex flex-wrap gap-2">
          <Button
            type="button"
            size="sm"
            data-testid={`fluxo-pronto-${fluxo.key}-${ativo ? "salvar" : "ligar"}`}
            disabled={enviando}
            onClick={() => void gravar(true)}
          >
            {enviando ? "Salvando…" : ativo ? "Salvar texto" : "Ligar"}
          </Button>
          {ativo ? (
            <Button
              type="button"
              size="sm"
              variant="outline"
              data-testid={`fluxo-pronto-${fluxo.key}-desligar`}
              disabled={enviando}
              onClick={() => void gravar(false)}
            >
              Desligar
            </Button>
          ) : null}
        </div>
      ) : null}
    </article>
  );
}
