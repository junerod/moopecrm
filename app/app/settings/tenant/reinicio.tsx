"use client";

import { useState } from "react";
import { toast } from "sonner";

import { RecomecarFila } from "@/components/inbox/RecomecarFila";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ApiError } from "@/lib/api/types";
import { apiClient } from "@/lib/api/client";
import { CONFIRMACAO_DE_ESVAZIAR_FUNIL } from "@/lib/leads/esvaziar-funil";

/**
 * Zona do admin da empresa. Atendente não chega nesta página.
 * A fila do WhatsApp tem as duas saídas: zerar (histórico fica) e limpar.
 * Zerar o funil apaga os cards.
 */
export function ReinicioDaOperacao() {
  const [zerando, setZerando] = useState(false);
  const [confirmacao, setConfirmacao] = useState("");

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
        <h2 className="text-lg font-semibold tracking-tight">Fila do WhatsApp</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Só o administrador da empresa. As duas opções pedem confirmação de novo. Zerar a fila
          mantém o histórico. Limpar a caixa apaga as conversas.
        </p>
      </div>

      <RecomecarFila />

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
