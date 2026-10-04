"use client";

import { useState } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ApiError } from "@/lib/api/types";
import { apiClient } from "@/lib/api/client";
import { CONFIRMACAO_DE_ESVAZIAR_FUNIL } from "@/lib/leads/esvaziar-funil";

/**
 * Zona do admin da empresa. Atendente não chega nesta página.
 * Encerrar a fila guarda o histórico. Zerar o funil apaga os cards.
 */
export function ReinicioDaOperacao() {
  const [encerrando, setEncerrando] = useState(false);
  const [zerando, setZerando] = useState(false);
  const [confirmacao, setConfirmacao] = useState("");

  async function encerrarFila() {
    if (
      !window.confirm(
        "Zerar a fila? As conversas em aberto saem da fila. O histórico fica. Quando o cliente escrever de novo, a conversa volta para a fila.",
      )
    ) {
      return;
    }
    setEncerrando(true);
    try {
      const res = await apiClient.post<{ data: { encerradas: number } }>(
        "/api/v1/conversations/bulk-close",
        {},
        { timeoutMs: 120_000 },
      );
      toast.success(`${res.data.encerradas} conversas encerradas.`);
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "Não consegui encerrar a fila.");
    } finally {
      setEncerrando(false);
    }
  }

  async function zerarFunil() {
    if (confirmacao.trim() !== CONFIRMACAO_DE_ESVAZIAR_FUNIL) {
      toast.error("Digite ZERAR para confirmar.");
      return;
    }
    setZerando(true);
    try {
      const res = await apiClient.post<{ data: { apagados: number } }>(
        "/api/v1/leads/reset-board",
        { confirm: CONFIRMACAO_DE_ESVAZIAR_FUNIL },
        { timeoutMs: 120_000 },
      );
      setConfirmacao("");
      toast.success(`${res.data.apagados} cards saíram do funil. Os contatos continuam.`);
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "Não consegui esvaziar o funil.");
    } finally {
      setZerando(false);
    }
  }

  return (
    <Card className="max-w-2xl space-y-6 border-error/40 p-6">
      <div>
        <h2 className="text-lg font-semibold tracking-tight">Recomeçar a operação</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Só o administrador da empresa. Atendente e supervisor não veem isto e a API recusa.
        </p>
      </div>

      <div className="space-y-2">
        <h3 className="text-sm font-medium">Zerar a fila</h3>
        <p className="text-sm text-muted-foreground">
          Tira da fila todas as conversas em aberto. O histórico permanece em Fechadas. A próxima
          mensagem do cliente devolve a conversa para a fila, sem dono.
        </p>
        <Button
          type="button"
          variant="outline"
          disabled={encerrando}
          data-testid="encerrar-fila"
          onClick={() => void encerrarFila()}
        >
          {encerrando ? "Zerando…" : "Zerar a fila"}
        </Button>
      </div>

      <div className="space-y-2 border-t border-border pt-4">
        <h3 className="text-sm font-medium">Zerar o funil</h3>
        <p className="text-sm text-muted-foreground">
          Apaga os cards de todos os funis desta empresa. Não apaga contatos nem conversas. Não tem
          volta.
        </p>
        <Label htmlFor="confirmar-zerar">Digite ZERAR para confirmar</Label>
        <Input
          id="confirmar-zerar"
          data-testid="confirmar-zerar"
          value={confirmacao}
          autoComplete="off"
          onChange={(e) => setConfirmacao(e.target.value)}
        />
        <Button
          type="button"
          variant="destructive"
          disabled={zerando || confirmacao.trim() !== CONFIRMACAO_DE_ESVAZIAR_FUNIL}
          data-testid="zerar-funil"
          onClick={() => void zerarFunil()}
        >
          {zerando ? "Apagando…" : "Zerar o funil"}
        </Button>
      </div>
    </Card>
  );
}
