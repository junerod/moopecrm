"use client";

import { useState } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import {
  MENSAGEM_FOLLOWUP_24H,
  MINUTOS_FOLLOWUP_24H,
} from "@/lib/negocio/followup-24h";

export function ProntasTab({
  jaAtivo,
  canWrite,
}: {
  jaAtivo: boolean;
  canWrite: boolean;
}) {
  const [ativo, setAtivo] = useState(jaAtivo);
  const [enviando, setEnviando] = useState(false);

  async function ativar() {
    setEnviando(true);
    try {
      const res = await fetch("/api/v1/ai/followup-flows/pronto-24h", { method: "POST" });
      const json = (await res.json()) as { error?: { message?: string } };
      if (!res.ok) {
        toast.error(json.error?.message ?? "Não consegui ligar o lembrete.");
        return;
      }
      setAtivo(true);
      toast.success("Lembrete de 24 horas ligado.");
    } catch {
      toast.error("Não consegui falar com o servidor.");
    } finally {
      setEnviando(false);
    }
  }

  return (
    <div className="grid gap-3 md:grid-cols-2">
      <Card className="space-y-3 p-4" data-testid="pronto-followup-24h">
        <h2 className="text-sm font-semibold">Lembrar cliente se ele não responder</h2>
        <p className="text-sm text-muted-foreground">
          Se o cliente ficar em silêncio, o sistema manda um recado. Se ele
          responder, o lembrete para. Funciona mesmo com a IA desligada.
        </p>
        <dl className="text-sm">
          <div>
            <dt className="text-muted-foreground">Esperar</dt>
            <dd>{MINUTOS_FOLLOWUP_24H / 60} horas</dd>
          </div>
          <div>
            <dt className="text-muted-foreground">Mensagem</dt>
            <dd>{MENSAGEM_FOLLOWUP_24H}</dd>
          </div>
        </dl>
        {ativo ? (
          <p data-testid="pronto-followup-24h-ativo" className="text-sm font-medium">
            Ligado
          </p>
        ) : canWrite ? (
          <Button
            type="button"
            data-testid="pronto-followup-24h-ativar"
            disabled={enviando}
            onClick={() => void ativar()}
          >
            {enviando ? "Ativando…" : "Ativar"}
          </Button>
        ) : null}
      </Card>
    </div>
  );
}
