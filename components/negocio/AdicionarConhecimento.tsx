"use client";

import { useState } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

const SUGESTOES = [
  "Sobre a empresa",
  "Produtos e serviços",
  "Preços e condições",
  "Regiões atendidas",
  "Horários",
  "Formas de pagamento",
  "Perguntas frequentes",
  "Políticas",
  "Garantias e regras",
  "Documentos necessários",
];

function comoFaq(titulo: string, texto: string): string {
  return `## Pergunta: ${titulo.trim() || "O que a empresa precisa que o sistema saiba?"}\n## Resposta: ${texto.trim()}`;
}

export function AdicionarConhecimento({
  agentId,
  onCriada,
}: {
  agentId: string;
  onCriada: () => void;
}) {
  const [titulo, setTitulo] = useState("Sobre a empresa");
  const [texto, setTexto] = useState("");
  const [enviando, setEnviando] = useState(false);

  async function salvar(tipo: "faq" | "policy") {
    if (texto.trim().length === 0) {
      toast.error("Escreva o que a empresa precisa que o sistema saiba.");
      return;
    }
    setEnviando(true);
    try {
      const res = await fetch("/api/v1/ai/knowledge/sources", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          agent_id: agentId,
          source_type: tipo,
          name: titulo.trim() || "Cadastro da empresa",
          markdown_blob: comoFaq(titulo, texto),
        }),
      });
      const json = (await res.json()) as { error?: { message?: string } };
      if (res.status === 409 && tipo === "faq") {
        await salvar("policy");
        return;
      }
      if (!res.ok) {
        toast.error(json.error?.message ?? "Não consegui salvar.");
        return;
      }
      toast.success("Conhecimento salvo.");
      setTexto("");
      onCriada();
    } catch {
      toast.error("Não consegui falar com o servidor.");
    } finally {
      setEnviando(false);
    }
  }

  return (
    <Card className="space-y-3 p-4" data-testid="adicionar-conhecimento">
      <div>
        <h2 className="text-sm font-semibold">Adicionar conhecimento</h2>
        <p className="text-xs text-muted-foreground">
          Texto livre. O sistema guarda no acervo da empresa — o mesmo que o
          assistente consulta.
        </p>
      </div>
      <div className="flex flex-wrap gap-2">
        {SUGESTOES.map((s) => (
          <button
            key={s}
            type="button"
            className="rounded-full border border-border px-2.5 py-1 text-xs hover:bg-muted"
            onClick={() => setTitulo(s)}
          >
            {s}
          </button>
        ))}
      </div>
      <div className="space-y-2">
        <Label htmlFor="conhecimento-titulo">Assunto</Label>
        <Input
          id="conhecimento-titulo"
          data-testid="conhecimento-titulo"
          value={titulo}
          onChange={(e) => setTitulo(e.target.value)}
        />
      </div>
      <div className="space-y-2">
        <Label htmlFor="conhecimento-texto">O que o sistema precisa saber</Label>
        <Textarea
          id="conhecimento-texto"
          data-testid="conhecimento-texto"
          rows={6}
          placeholder="Ex.: Martelete Bosch 5kg. Locação mínima: 1 diária."
          value={texto}
          onChange={(e) => setTexto(e.target.value)}
        />
      </div>
      <Button
        type="button"
        size="sm"
        disabled={enviando}
        onClick={() => void salvar("faq")}
      >
        {enviando ? "Salvando…" : "Salvar conhecimento"}
      </Button>
    </Card>
  );
}
