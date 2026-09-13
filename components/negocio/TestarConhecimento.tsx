"use client";

import { useState } from "react";

import { FormSection } from "@/components/ds/FormSection";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";

interface Trecho {
  texto: string;
  fonte: string | null;
  pagina?: number;
}

export function TestarConhecimento({
  perguntaInicial,
}: {
  perguntaInicial?: string;
}) {
  const [pergunta, setPergunta] = useState(perguntaInicial ?? "");
  const [enviando, setEnviando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [encontrou, setEncontrou] = useState<boolean | null>(null);
  const [trechos, setTrechos] = useState<Trecho[]>([]);

  async function perguntar() {
    setErro(null);
    setEnviando(true);
    try {
      const res = await fetch("/api/v1/ai/knowledge/consultar", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ pergunta }),
      });
      const json = (await res.json()) as {
        data?: { encontrou: boolean; trechos: Trecho[] };
        error?: { message?: string };
      };
      if (!res.ok) {
        setErro(json.error?.message ?? "Não consegui consultar.");
        return;
      }
      setEncontrou(json.data?.encontrou ?? false);
      setTrechos(json.data?.trechos ?? []);
    } catch {
      setErro("Não consegui falar com o servidor.");
    } finally {
      setEnviando(false);
    }
  }

  return (
    <FormSection
      testid="testar-conhecimento"
      titulo="Testar"
      descricao="Pergunte algo sobre sua empresa. A resposta usa o mesmo acervo do atendimento — se não estiver aqui, o sistema não inventa."
    >
      <Textarea
        data-testid="testar-conhecimento-pergunta"
        rows={3}
        placeholder="Faça uma pergunta sobre sua empresa"
        value={pergunta}
        onChange={(e) => setPergunta(e.target.value)}
      />
      <Button
        type="button"
        size="sm"
        disabled={enviando || pergunta.trim().length < 3}
        onClick={() => void perguntar()}
      >
        {enviando ? "Consultando…" : "Perguntar"}
      </Button>
      {erro ? (
        <p role="alert" className="text-sm text-destructive">
          {erro}
        </p>
      ) : null}
      {encontrou === false ? (
        <p data-testid="testar-conhecimento-vazio" className="text-sm text-muted-foreground">
          Ainda não achei isso no cadastro da empresa.
        </p>
      ) : null}
      {trechos.length > 0 ? (
        <div className="space-y-3">
          <ul data-testid="testar-conhecimento-resposta" className="space-y-2 text-sm">
            {trechos.map((t, i) => (
              <li key={i} className="rounded-[12px] bg-[var(--color-bg)] p-3 ring-1 ring-[var(--color-border)]">
                <p className="whitespace-pre-wrap">{t.texto}</p>
              </li>
            ))}
          </ul>
          <div data-testid="testar-conhecimento-fontes">
            <p className="text-xs font-medium text-[var(--color-text-muted)]">Fontes utilizadas</p>
            <ul className="mt-1 space-y-1 text-xs text-[var(--color-text-muted)]">
              {trechos
                .filter((t) => t.fonte)
                .map((t, i) => (
                  <li key={`${t.fonte}-${i}`}>
                    {t.fonte}
                    {typeof t.pagina === "number" ? ` · página ${t.pagina}` : ""}
                  </li>
                ))}
            </ul>
          </div>
        </div>
      ) : null}
    </FormSection>
  );
}
