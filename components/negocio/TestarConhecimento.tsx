"use client";

import { useState } from "react";

import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";

interface Trecho {
  texto: string;
  fonte: string | null;
}

export function TestarConhecimento() {
  const [pergunta, setPergunta] = useState("");
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
    <Card className="space-y-3 p-4" data-testid="testar-conhecimento">
      <div>
        <h2 className="text-sm font-semibold">Testar conhecimento</h2>
        <p className="text-xs text-muted-foreground">
          Pergunte algo sobre sua empresa. A resposta usa o mesmo acervo do atendimento.
        </p>
      </div>
      <Textarea
        data-testid="testar-conhecimento-pergunta"
        rows={3}
        placeholder="Pergunte algo sobre sua empresa..."
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
        <ul data-testid="testar-conhecimento-resposta" className="space-y-2 text-sm">
          {trechos.map((t, i) => (
            <li key={i} className="rounded-md border border-border p-3">
              <p className="whitespace-pre-wrap">{t.texto}</p>
              {t.fonte ? (
                <p className="mt-2 text-xs text-muted-foreground">Fonte: {t.fonte}</p>
              ) : null}
            </li>
          ))}
        </ul>
      ) : null}
    </Card>
  );
}
