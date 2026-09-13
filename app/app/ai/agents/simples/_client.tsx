"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { toast } from "sonner";

import { createMcpAgentAction } from "@/app/app/ai/agents/[id]/_actions";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import type { ColecaoDeConhecimento } from "@/lib/ai/knowledge/colecoes";
import { ROTULO_DO_MODO_IA } from "@/lib/negocio/rotulos";
import type { AiMode } from "@/lib/schemas/settings";

const FUNCOES = [
  { id: "atendimento", label: "Atendimento", prompt: "Atenda com educação. Use só o conhecimento da empresa. Não invente preço nem prazo." },
  { id: "vendas", label: "Comercial", prompt: "Qualifique interesse e ajude a avançar a conversa. Não invente condição comercial." },
  { id: "financeiro", label: "Financeiro", prompt: "Oriente sobre cobrança. Valor e vencimento só vêm de dado oficial. Sem dado, peça uma pessoa." },
  { id: "suporte", label: "Suporte", prompt: "Ajude a resolver a dúvida com o que a empresa cadastrou. Se faltar dado, peça confirmação humana." },
  { id: "relacionamento", label: "Relacionamento", prompt: "Faça follow-up e reativação com educação. Não invente oferta nem dispare campanha sozinho." },
  { id: "personalizado", label: "Personalizado", prompt: "" },
] as const;

const AUTONOMIAS = [
  { id: "copilot", label: "Somente ajudar minha equipe", modo: "copilot" as const },
  { id: "controlled", label: "Responder com aprovação", modo: "controlled" as const },
  { id: "autonomous", label: "Responder automaticamente", modo: "autonomous" as const },
] as const;

export function AssistenteSimplesForm({
  channelSessionId,
  aiMode,
  colecoes,
}: {
  channelSessionId: string | null;
  aiMode: AiMode;
  colecoes: ColecaoDeConhecimento[];
}) {
  const router = useRouter();
  const [passo, setPasso] = useState(1);
  const [nome, setNome] = useState("Assistente Comercial");
  const [funcao, setFuncao] = useState<(typeof FUNCOES)[number]["id"]>("vendas");
  const [prompt, setPrompt] = useState<string>(FUNCOES[1].prompt);
  const [colecoesEscolhidas, setColecoesEscolhidas] = useState<string[]>([]);
  const [autonomia, setAutonomia] = useState<(typeof AUTONOMIAS)[number]["id"]>("copilot");
  const [pending, start] = useTransition();

  const escolhida = FUNCOES.find((f) => f.id === funcao)!;
  const autonomiaEscolhida = AUTONOMIAS.find((a) => a.id === autonomia)!;

  function salvar() {
    if (!channelSessionId) {
      toast.error("Conecte o WhatsApp antes de criar um assistente que atende.");
      return;
    }
    const system = (funcao === "personalizado" ? prompt : escolhida.prompt).trim();
    if (system.length < 10) {
      toast.error("Descreva o que o assistente deve fazer.");
      return;
    }
    start(async () => {
      const res = await createMcpAgentAction({
        name: nome.trim(),
        description: `Função: ${escolhida.label}. Autonomia desejada: ${autonomiaEscolhida.label}. Conhecimento: empresa.`,
        priority: 0,
        version: {
          system_prompt: system,
          provider: "anthropic",
          model: "claude-sonnet-4-6",
          credential_id: null,
          channel_session_id: channelSessionId,
          tool_ids: [],
        },
      });
      if (!res.ok) {
        toast.error(res.message ?? "Não consegui criar o assistente.");
        return;
      }
      if (colecoesEscolhidas.length > 0 && res.data?.agent_id) {
        await fetch(`/api/v1/ai/agents/${res.data.agent_id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ config: { knowledge_collection_ids: colecoesEscolhidas } }),
        });
      }
      toast.success("Assistente salvo como rascunho. Ative quando quiser.");
      router.push(`/app/ai/agents/${res.data!.agent_id}`);
    });
  }

  return (
    <Card className="mx-auto max-w-xl space-y-4 p-4" data-testid="wizard-assistente">
      <p className="text-xs text-muted-foreground">Passo {passo} de 5</p>

      {passo === 1 ? (
        <div className="space-y-2">
          <Label htmlFor="assistente-nome">Nome</Label>
          <Input
            id="assistente-nome"
            data-testid="assistente-nome"
            value={nome}
            onChange={(e) => setNome(e.target.value)}
          />
        </div>
      ) : null}

      {passo === 2 ? (
        <fieldset className="space-y-2">
          <legend className="text-sm font-medium">O que ele fará?</legend>
          {FUNCOES.map((f) => (
            <label key={f.id} className="flex items-center gap-2 text-sm">
              <input
                type="radio"
                name="funcao"
                checked={funcao === f.id}
                onChange={() => {
                  setFuncao(f.id);
                  if (f.id !== "personalizado") setPrompt(f.prompt);
                }}
              />
              {f.label}
            </label>
          ))}
        </fieldset>
      ) : null}

      {passo === 3 ? (
        <fieldset className="space-y-2">
          <legend className="text-sm font-medium">Conhecimento</legend>
          <p className="text-sm text-muted-foreground">
            Escolha as coleções. Nenhuma marcada = usa o conhecimento da empresa inteiro.
          </p>
          {colecoes.length === 0 ? (
            <p className="text-sm">Ainda não há coleções. Você pode criar depois em Conhecimento.</p>
          ) : (
            colecoes.map((c) => (
              <label key={c.id} className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={colecoesEscolhidas.includes(c.id)}
                  onChange={(e) => {
                    setColecoesEscolhidas((atual) =>
                      e.target.checked ? [...atual, c.id] : atual.filter((id) => id !== c.id),
                    );
                  }}
                />
                {c.name}
              </label>
            ))
          )}
        </fieldset>
      ) : null}

      {passo === 4 ? (
        <fieldset className="space-y-2">
          <legend className="text-sm font-medium">Autonomia</legend>
          {AUTONOMIAS.map((a) => (
            <label key={a.id} className="flex items-center gap-2 text-sm">
              <input
                type="radio"
                name="autonomia"
                checked={autonomia === a.id}
                onChange={() => setAutonomia(a.id)}
              />
              {a.label}
            </label>
          ))}
          <p className="text-sm text-muted-foreground">
            A organização hoje está em <strong>{ROTULO_DO_MODO_IA[aiMode].titulo}</strong>. Esse
            modo vale para todos os assistentes — a escolha acima fica registrada neste
            assistente, e o detalhe se edita depois.
          </p>
          {funcao === "personalizado" ? (
            <div className="space-y-2">
              <Label htmlFor="assistente-prompt">O que ele deve fazer</Label>
              <Textarea
                id="assistente-prompt"
                rows={5}
                value={prompt}
                onChange={(e) => setPrompt(e.target.value)}
              />
            </div>
          ) : null}
        </fieldset>
      ) : null}

      {passo === 5 ? (
        <div className="space-y-2 text-sm" data-testid="wizard-assistente-revisao">
          <p>
            <strong>Nome:</strong> {nome}
          </p>
          <p>
            <strong>Função:</strong> {escolhida.label}
          </p>
          <p>
            <strong>Conhecimento:</strong>{" "}
            {colecoesEscolhidas.length === 0
              ? "Empresa"
              : colecoes
                  .filter((c) => colecoesEscolhidas.includes(c.id))
                  .map((c) => c.name)
                  .join(", ")}
          </p>
          <p>
            <strong>Autonomia:</strong> {autonomiaEscolhida.label}
          </p>
          <p className="text-muted-foreground">
            Salvar cria um rascunho. Ele não envia mensagem até você ativar.
          </p>
          {!channelSessionId ? (
            <p className="text-amber-800">Conecte o WhatsApp para conseguir salvar.</p>
          ) : null}
        </div>
      ) : null}

      <div className="flex flex-wrap gap-2">
        {passo > 1 ? (
          <Button type="button" variant="outline" onClick={() => setPasso((p) => p - 1)}>
            Voltar
          </Button>
        ) : null}
        {passo < 5 ? (
          <Button type="button" onClick={() => setPasso((p) => p + 1)}>
            Continuar
          </Button>
        ) : (
          <Button
            type="button"
            data-testid="wizard-assistente-salvar"
            disabled={pending || !channelSessionId}
            onClick={salvar}
          >
            {pending ? "Salvando…" : "Salvar rascunho"}
          </Button>
        )}
      </div>
    </Card>
  );
}
