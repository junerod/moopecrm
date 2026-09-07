"use client";

import { useCallback, useEffect, useState } from "react";

import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { apiClient } from "@/lib/api/client";

export interface SugestaoDoAssistente {
  id: string;
  inbound_message_id: string;
  summary: string;
  intent: string;
  intent_label: string;
  suggested_reply: string;
  suggested_next_action: string | null;
  confidence_band: "alta" | "media" | "baixa";
  status: "ready" | "discarded" | "used";
}

export interface PedidoDeAcaoUi {
  id: string;
  requested_action: string;
  payload: Record<string, unknown>;
  policy_result: string;
  status: string;
}

interface Props {
  conversationId: string | null;
  onUsarResposta?: (texto: string) => void;
}

const CONFIANCA: Record<SugestaoDoAssistente["confidence_band"], string> = {
  alta: "Alta",
  media: "Média",
  baixa: "Baixa",
};

export function AssistenteIa({ conversationId, onUsarResposta }: Props) {
  const [sugestao, setSugestao] = useState<SugestaoDoAssistente | null>(null);
  const [pedidos, setPedidos] = useState<PedidoDeAcaoUi[]>([]);
  const [carregando, setCarregando] = useState(false);
  const [gerando, setGerando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  const carregar = useCallback(async (id: string) => {
    setCarregando(true);
    setErro(null);
    try {
      const [s, a] = await Promise.all([
        apiClient.get<{ data: { suggestion: SugestaoDoAssistente | null } }>(
          `/api/v1/conversations/${id}/copilot`,
        ),
        apiClient.get<{ data: { requests: PedidoDeAcaoUi[] } }>(
          `/api/v1/conversations/${id}/ai-actions`,
        ),
      ]);
      setSugestao(s.data.suggestion);
      setPedidos(a.data.requests ?? []);
    } catch (err) {
      setErro(err instanceof Error ? err.message : "Não consegui ler o assistente.");
    } finally {
      setCarregando(false);
    }
  }, []);

  useEffect(() => {
    if (!conversationId) return;
    void carregar(conversationId);
    const t = setInterval(() => void carregar(conversationId), 8000);
    return () => clearInterval(t);
  }, [conversationId, carregar]);

  if (!conversationId) return null;

  async function gerar(force: boolean) {
    setGerando(true);
    setErro(null);
    try {
      const r = await apiClient.post<{ data: { suggestion: SugestaoDoAssistente } }>(
        `/api/v1/conversations/${conversationId}/copilot`,
        { force },
        { timeoutMs: 60_000 },
      );
      setSugestao(r.data.suggestion);
    } catch (err) {
      setErro(err instanceof Error ? err.message : "Não consegui gerar sugestão.");
    } finally {
      setGerando(false);
    }
  }

  async function marcar(op: "use" | "discard") {
    if (!sugestao) return;
    try {
      const r = await apiClient.patch<{ data: { suggestion: SugestaoDoAssistente } }>(
        `/api/v1/conversations/${conversationId}/copilot`,
        { op, suggestion_id: sugestao.id },
      );
      setSugestao(r.data.suggestion);
    } catch (err) {
      setErro(err instanceof Error ? err.message : "Não consegui atualizar a sugestão.");
    }
  }

  function usar() {
    if (!sugestao?.suggested_reply) return;
    onUsarResposta?.(sugestao.suggested_reply);
    void marcar("use");
  }

  async function confirmar(pedidoId: string) {
    try {
      await apiClient.post(`/api/v1/ai-actions/${pedidoId}/confirm`, {});
      setPedidos((p) => p.filter((x) => x.id !== pedidoId));
    } catch (err) {
      setErro(err instanceof Error ? err.message : "Não consegui confirmar a ação.");
    }
  }

  const visivel = sugestao && sugestao.status !== "discarded";

  return (
    <section data-testid="assistente-ia">
      <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
        Assistente IA
      </h3>
      <Card className="mt-2 space-y-3 p-3 text-sm">
        {carregando && !sugestao ? (
          <p className="text-xs text-muted-foreground">Carregando…</p>
        ) : null}
        {erro ? <p className="text-xs text-error-fg">{erro}</p> : null}

        {visivel ? (
          <div className="space-y-2">
            <div>
              <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
                Resumo
              </p>
              <p data-testid="assistente-resumo">{sugestao.summary}</p>
            </div>
            <div>
              <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
                Intenção
              </p>
              <p data-testid="assistente-intencao">
                {sugestao.intent_label}
                <span className="ml-2 text-xs text-muted-foreground">
                  confiança {CONFIANCA[sugestao.confidence_band]}
                </span>
              </p>
            </div>
            {sugestao.suggested_reply ? (
              <div>
                <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
                  Resposta sugerida
                </p>
                <p data-testid="assistente-resposta" className="whitespace-pre-wrap">
                  {sugestao.suggested_reply}
                </p>
              </div>
            ) : null}
            {sugestao.suggested_next_action ? (
              <p className="text-xs text-muted-foreground">{sugestao.suggested_next_action}</p>
            ) : null}
            <div className="flex flex-wrap gap-2 pt-1">
              <Button
                type="button"
                size="sm"
                data-testid="assistente-usar"
                disabled={!sugestao.suggested_reply || sugestao.status === "used"}
                onClick={usar}
              >
                Usar resposta
              </Button>
              <Button
                type="button"
                size="sm"
                variant="outline"
                data-testid="assistente-gerar-outra"
                disabled={gerando}
                onClick={() => void gerar(true)}
              >
                {gerando ? "Gerando…" : "Gerar outra"}
              </Button>
              <Button
                type="button"
                size="sm"
                variant="ghost"
                data-testid="assistente-descartar"
                onClick={() => void marcar("discard")}
              >
                Descartar
              </Button>
            </div>
          </div>
        ) : (
          <div className="space-y-2">
            <p className="text-xs text-muted-foreground">
              Nenhuma sugestão para esta conversa.
            </p>
            <Button
              type="button"
              size="sm"
              data-testid="assistente-gerar"
              disabled={gerando}
              onClick={() => void gerar(false)}
            >
              {gerando ? "Gerando…" : "Gerar sugestão"}
            </Button>
          </div>
        )}

        {pedidos.map((p) => (
          <div
            key={p.id}
            data-testid="assistente-pedido"
            className="rounded-md border border-amber-500/40 p-2 text-xs"
          >
            <p>
              A IA recomenda: <strong>{rotuloDaAcao(p.requested_action)}</strong>
            </p>
            <Button
              type="button"
              size="sm"
              className="mt-2"
              data-testid="assistente-confirmar"
              onClick={() => void confirmar(p.id)}
            >
              Confirmar
            </Button>
          </div>
        ))}
      </Card>
    </section>
  );
}

function rotuloDaAcao(action: string): string {
  if (action === "move_lead_stage") return "mover o lead de estágio?";
  return action;
}
