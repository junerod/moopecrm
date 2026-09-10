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
import { ROTULO_DO_MODO_IA } from "@/lib/negocio/rotulos";
import type { AiMode } from "@/lib/schemas/settings";

const FUNCOES = [
  { id: "atendimento", label: "Atendimento", prompt: "Atenda com educação. Use só o conhecimento da empresa. Não invente preço nem prazo." },
  { id: "vendas", label: "Vendas", prompt: "Qualifique interesse e ajude a avançar a conversa. Não invente condição comercial." },
  { id: "suporte", label: "Suporte", prompt: "Ajude a resolver a dúvida com o que a empresa cadastrou. Se faltar dado, peça confirmação humana." },
  { id: "personalizado", label: "Personalizado", prompt: "" },
] as const;

export function AssistenteSimplesForm({
  channelSessionId,
  aiMode,
}: {
  channelSessionId: string | null;
  aiMode: AiMode;
}) {
  const router = useRouter();
  const [passo, setPasso] = useState(1);
  const [nome, setNome] = useState("Assistente Comercial");
  const [funcao, setFuncao] = useState<(typeof FUNCOES)[number]["id"]>("vendas");
  const [prompt, setPrompt] = useState<string>(FUNCOES[1].prompt);
  const [pending, start] = useTransition();

  const escolhida = FUNCOES.find((f) => f.id === funcao)!;

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
        description: `Função: ${escolhida.label}. Conhecimento: empresa.`,
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
      toast.success("Assistente salvo como rascunho. Ative quando quiser.");
      router.push(`/app/ai/agents/${res.data!.agent_id}`);
    });
  }

  return (
    <Card className="mx-auto max-w-xl space-y-4 p-4" data-testid="wizard-assistente">
      <p className="text-xs text-muted-foreground">Passo {passo} de 6</p>

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
          <legend className="text-sm font-medium">Função</legend>
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
        <p className="text-sm">
          Este assistente usa o <strong>conhecimento da empresa</strong> — o mesmo
          cadastro de Conhecimento. Dados vivos (contrato, boleto, estoque)
          continuam no CRM, não neste texto.
        </p>
      ) : null}

      {passo === 4 ? (
        <p className="text-sm">
          O que ele pode fazer no atendimento continua limitado pelas regras da
          organização. Este assistente nasce sem ações extras. Você pode
          autorizar depois no editor avançado.
        </p>
      ) : null}

      {passo === 5 ? (
        <div className="space-y-2 text-sm">
          <p>
            Modo atual da organização:{" "}
            <strong>{ROTULO_DO_MODO_IA[aiMode].titulo}</strong>
          </p>
          <p className="text-muted-foreground">{ROTULO_DO_MODO_IA[aiMode].corpo}</p>
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
        </div>
      ) : null}

      {passo === 6 ? (
        <div className="space-y-2 text-sm" data-testid="wizard-assistente-revisao">
          <p>
            <strong>Nome:</strong> {nome}
          </p>
          <p>
            <strong>Função:</strong> {escolhida.label}
          </p>
          <p>
            <strong>Conhecimento:</strong> Empresa
          </p>
          <p>
            <strong>Modo:</strong> {ROTULO_DO_MODO_IA[aiMode].titulo}
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
        {passo < 6 ? (
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
