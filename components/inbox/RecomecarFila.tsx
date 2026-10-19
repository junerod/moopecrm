"use client";

import { useState } from "react";
import { toast } from "sonner";

import { LimparCaixaButton } from "@/components/inbox/LimparCaixaButton";
import { Button } from "@/components/ui/button";
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { ApiError } from "@/lib/api/types";
import { apiClient } from "@/lib/api/client";

/**
 * As duas saídas da fila do WhatsApp.
 * Zerar tira da fila e guarda o histórico. Limpar apaga as conversas.
 * As duas pedem confirmação de novo antes de agir.
 */
export function RecomecarFila() {
  const [encerrando, setEncerrando] = useState(false);
  const [passoFila, setPassoFila] = useState<0 | 1 | 2>(0);

  function fecharFila() {
    if (encerrando) return;
    setPassoFila(0);
  }

  async function encerrarFila() {
    setEncerrando(true);
    try {
      const res = await apiClient.post<{ data: { encerradas: number } }>(
        "/api/v1/conversations/bulk-close",
        {},
        { timeoutMs: 120_000 },
      );
      setPassoFila(0);
      toast.success(`${res.data.encerradas} conversas saíram da fila. O histórico ficou em Fechadas.`);
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "Não consegui zerar a fila.");
    } finally {
      setEncerrando(false);
    }
  }

  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <h3 className="text-sm font-medium">Zerar a fila — mantém o histórico</h3>
        <p className="text-sm text-muted-foreground">
          Tira da fila as conversas em aberto. Nada é apagado: o histórico permanece em Fechadas.
          A próxima mensagem do cliente devolve a conversa para a fila, sem dono.
        </p>
        <Button
          type="button"
          variant="outline"
          disabled={encerrando}
          data-testid="encerrar-fila"
          onClick={() => setPassoFila(1)}
        >
          {encerrando ? "Zerando…" : "Zerar a fila"}
        </Button>
      </div>

      <div className="space-y-2 border-t border-border pt-4">
        <h3 className="text-sm font-medium">Limpar a caixa — apaga as conversas</h3>
        <p className="text-sm text-muted-foreground">
          Apaga a fila, as suas, as da IA e as fechadas, com as mensagens. Para recomeçar com um
          número novo, ou quando a caixa encheu de lixo. Contatos e cards do funil ficam. Não tem
          volta.
        </p>
        <LimparCaixaButton />
      </div>

      <AlertDialog open={passoFila > 0} onOpenChange={(aberto) => { if (!aberto) fecharFila(); }}>
        <AlertDialogContent>
          {passoFila === 1 ? (
            <>
              <AlertDialogHeader>
                <AlertDialogTitle>Zerar a fila?</AlertDialogTitle>
                <AlertDialogDescription>
                  As conversas em aberto saem da fila. O histórico fica em Fechadas. Quando o
                  cliente escrever de novo, a conversa volta para a fila, sem dono.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <Button type="button" variant="outline" onClick={fecharFila}>
                  Cancelar
                </Button>
                <Button type="button" data-testid="encerrar-fila-continuar" onClick={() => setPassoFila(2)}>
                  Continuar
                </Button>
              </AlertDialogFooter>
            </>
          ) : (
            <>
              <AlertDialogHeader>
                <AlertDialogTitle>Confirme de novo</AlertDialogTitle>
                <AlertDialogDescription>
                  As conversas em aberto saem da fila agora. O histórico permanece.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <Button type="button" variant="outline" onClick={fecharFila} disabled={encerrando}>
                  Cancelar
                </Button>
                <Button
                  type="button"
                  data-testid="encerrar-fila-confirmar"
                  disabled={encerrando}
                  onClick={() => void encerrarFila()}
                >
                  {encerrando ? "Zerando…" : "Zerar a fila"}
                </Button>
              </AlertDialogFooter>
            </>
          )}
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
