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
  mensagem2?: string;
  passos?: string[];
  como_usar?: string;
  destaque?: boolean;
  ativo: boolean;
};

export function FluxosProntosDoPack({
  fluxos,
  canWrite,
}: {
  fluxos: FluxoProntoNaTela[];
  canWrite: boolean;
}) {
  const modelo = fluxos.find((f) => f.destaque);
  const outros = fluxos.filter((f) => !f.destaque);
  return (
    <section id="fluxos-prontos" data-testid="fluxos-prontos-do-pack" className="space-y-3">
      <div>
        <h3 className="text-sm font-semibold">Fluxos prontos</h3>
        <p className="mt-1 text-sm text-[var(--color-text-muted)]">
          O primeiro card é o modelo de operação do seu negócio: espera,
          condição e dois recados. Os outros são atalhos. Nada dispara sozinho.
        </p>
      </div>
      {modelo ? <CardDoFluxo fluxo={modelo} canWrite={canWrite} /> : null}
      <ul className="grid gap-3 md:grid-cols-2">
        {outros.map((f) => (
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
  const [mensagem2, setMensagem2] = useState(fluxo.mensagem2 ?? "");
  const [ativo, setAtivo] = useState(fluxo.ativo);
  const [enviando, setEnviando] = useState(false);
  const temSegundo = Boolean(fluxo.mensagem2);

  async function gravar(ligar: boolean) {
    const texto = mensagem.trim();
    if (!texto) {
      toast.error("Escreva a mensagem deste fluxo.");
      return;
    }
    if (temSegundo && !mensagem2.trim()) {
      toast.error("Escreva também o segundo recado.");
      return;
    }
    setEnviando(true);
    try {
      const res = await fetch("/api/v1/ai/followup-flows/pronto-do-pack", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          key: fluxo.key,
          mensagem: texto,
          ...(temSegundo ? { mensagem_2: mensagem2.trim() } : {}),
          ativo: ligar,
        }),
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
      className={
        fluxo.destaque
          ? "flex flex-col rounded-2xl bg-[var(--color-surface)] p-5 ring-2 ring-[var(--color-border)]"
          : "flex h-full flex-col rounded-2xl bg-[var(--color-surface)] p-4 ring-1 ring-[var(--color-border)]"
      }
    >
      {fluxo.destaque ? (
        <p className="text-[11px] font-medium uppercase tracking-[0.16em] text-[var(--color-text-muted)]">
          Como faz e como usa
        </p>
      ) : null}
      <p className="text-sm font-semibold">{fluxo.name}</p>
      <p className="mt-1 text-sm text-[var(--color-text-muted)]">{fluxo.description}</p>
      <p className="mt-2 text-xs text-[var(--color-text-muted)]">{fluxo.quando}</p>
      {fluxo.passos?.length ? (
        <ol className="mt-3 list-decimal space-y-1 pl-5 text-sm text-[var(--color-text-muted)]">
          {fluxo.passos.map((passo) => (
            <li key={passo}>{passo}</li>
          ))}
        </ol>
      ) : null}
      {fluxo.como_usar ? (
        <p
          data-testid={`fluxo-pronto-${fluxo.key}-como-usar`}
          className="mt-3 rounded-xl bg-[var(--color-bg)] px-3 py-2 text-sm"
        >
          {fluxo.como_usar}
        </p>
      ) : null}
      <label className="mt-3 text-xs font-medium text-[var(--color-text-muted)]">
        {temSegundo ? "1º recado" : "Mensagem"}
      </label>
      <Textarea
        data-testid={`fluxo-pronto-${fluxo.key}-mensagem`}
        className="mt-1"
        rows={fluxo.destaque ? 3 : 4}
        maxLength={1000}
        value={mensagem}
        disabled={!canWrite}
        onChange={(e) => setMensagem(e.target.value)}
      />
      {temSegundo ? (
        <>
          <label className="mt-3 text-xs font-medium text-[var(--color-text-muted)]">2º recado</label>
          <Textarea
            data-testid={`fluxo-pronto-${fluxo.key}-mensagem-2`}
            className="mt-1"
            rows={3}
            maxLength={1000}
            value={mensagem2}
            disabled={!canWrite}
            onChange={(e) => setMensagem2(e.target.value)}
          />
        </>
      ) : null}
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
