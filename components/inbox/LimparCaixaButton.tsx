"use client";

import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ApiError } from "@/lib/api/types";
import { apiClient } from "@/lib/api/client";
import { CONFIRMACAO_DE_LIMPAR_CAIXA } from "@/lib/inbox/limpar-caixa";

/**
 * Duas travas antes de apagar a caixa. A primeira explica. A segunda pede
 * a palavra LIMPAR. Sem as duas, a API nem é chamada.
 */
export function LimparCaixaButton({
  aparencia = "botao",
  onLimpou,
}: {
  aparencia?: "botao" | "lista";
  onLimpou?: () => void;
}) {
  const qc = useQueryClient();
  const [passo, setPasso] = useState<0 | 1 | 2>(0);
  const [texto, setTexto] = useState("");
  const [limpando, setLimpando] = useState(false);
  const confirmado = texto.trim() === CONFIRMACAO_DE_LIMPAR_CAIXA;

  function fechar() {
    if (limpando) return;
    setPasso(0);
    setTexto("");
  }

  async function limpar() {
    if (!confirmado) return;
    setLimpando(true);
    try {
      const res = await apiClient.post<{ data: { apagadas: number } }>(
        "/api/v1/conversations/purge-inbox",
        { confirm: CONFIRMACAO_DE_LIMPAR_CAIXA },
        { timeoutMs: 120_000 },
      );
      setPasso(0);
      setTexto("");
      const n = res.data.apagadas;
      toast.success(
        n === 0
          ? "A caixa já estava vazia."
          : `${n} conversas apagadas. A fila e a caixa estão vazias. Contatos e funil continuam.`,
      );
      await qc.invalidateQueries({ queryKey: ["conversations"] });
      await qc.invalidateQueries({ queryKey: ["conversation-counts"] });
      onLimpou?.();
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "Não consegui limpar a caixa de entrada.");
    } finally {
      setLimpando(false);
    }
  }

  return (
    <>
      {aparencia === "lista" ? (
        <button
          type="button"
          data-testid="limpar-caixa"
          className="mt-1 w-full rounded-lg px-3 py-1.5 text-left text-xs font-medium text-destructive ring-1 ring-[var(--color-border)] hover:bg-destructive/5"
          onClick={() => setPasso(1)}
        >
          Limpar caixa de entrada
        </button>
      ) : (
        <Button
          type="button"
          variant="destructive"
          data-testid="limpar-caixa"
          onClick={() => setPasso(1)}
        >
          Limpar caixa de entrada
        </Button>
      )}

      <AlertDialog open={passo > 0} onOpenChange={(aberto) => { if (!aberto) fechar(); }}>
        <AlertDialogContent>
          {passo === 1 ? (
            <>
              <AlertDialogHeader>
                <AlertDialogTitle>Limpar a caixa de entrada?</AlertDialogTitle>
                <AlertDialogDescription>
                  Isso zera a fila e apaga todas as conversas desta empresa — as suas, as da IA e
                  as fechadas — com as mensagens. Acompanhamentos automáticos em andamento param.
                  Contatos e cards do funil ficam. Não tem volta. Serve para recomeçar com um
                  número novo, ou quando a caixa encheu de lixo.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <Button type="button" variant="outline" onClick={fechar}>
                  Cancelar
                </Button>
                <Button type="button" data-testid="limpar-caixa-continuar" onClick={() => setPasso(2)}>
                  Continuar
                </Button>
              </AlertDialogFooter>
            </>
          ) : (
            <>
              <AlertDialogHeader>
                <AlertDialogTitle>Confirme de novo</AlertDialogTitle>
                <AlertDialogDescription>
                  Digite LIMPAR para apagar a fila e a caixa de entrada.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <div className="space-y-2">
                <Label htmlFor="confirmar-limpar">Digite LIMPAR</Label>
                <Input
                  id="confirmar-limpar"
                  data-testid="confirmar-limpar"
                  value={texto}
                  autoComplete="off"
                  onChange={(e) => setTexto(e.target.value)}
                />
              </div>
              <AlertDialogFooter>
                <Button type="button" variant="outline" onClick={fechar} disabled={limpando}>
                  Cancelar
                </Button>
                <Button
                  type="button"
                  variant="destructive"
                  data-testid="limpar-caixa-confirmar"
                  disabled={limpando || !confirmado}
                  onClick={() => void limpar()}
                >
                  {limpando ? "Limpando…" : "Limpar tudo"}
                </Button>
              </AlertDialogFooter>
            </>
          )}
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
