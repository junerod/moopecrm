"use client";

import { useState } from "react";
import { toast } from "sonner";

import { ProximoPasso } from "@/components/ds/ProximoPasso";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  MENSAGEM_FOLLOWUP_24H,
  MINUTOS_FOLLOWUP_24H,
} from "@/lib/negocio/followup-24h";

export function ProntasTab({
  jaAtivo,
  canWrite,
  mensagemInicial,
  horasInicial,
}: {
  jaAtivo: boolean;
  canWrite: boolean;
  mensagemInicial?: string;
  horasInicial?: number;
}) {
  const [ativo, setAtivo] = useState(jaAtivo);
  const [enviando, setEnviando] = useState(false);
  const [horas, setHoras] = useState(horasInicial ?? MINUTOS_FOLLOWUP_24H / 60);
  const [mensagem, setMensagem] = useState(mensagemInicial ?? MENSAGEM_FOLLOWUP_24H);

  async function gravar() {
    const texto = mensagem.trim();
    const espera = Number(horas);
    if (!texto) {
      toast.error("Escreva a mensagem do lembrete.");
      return;
    }
    if (!Number.isInteger(espera) || espera < 1 || espera > 168) {
      toast.error("Escolha entre 1 e 168 horas.");
      return;
    }
    setEnviando(true);
    try {
      const res = await fetch("/api/v1/ai/followup-flows/pronto-24h", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ mensagem: texto, horas: espera }),
      });
      const json = (await res.json()) as { error?: { message?: string } };
      if (!res.ok) {
        toast.error(json.error?.message ?? "Não consegui gravar o lembrete.");
        return;
      }
      setAtivo(true);
      toast.success(ativo ? "Lembrete atualizado." : "Lembrete ligado.");
    } catch {
      toast.error("Não consegui falar com o servidor.");
    } finally {
      setEnviando(false);
    }
  }

  return (
    <div className="grid gap-3 md:grid-cols-2">
      {!ativo && canWrite ? (
        <div className="md:col-span-2">
          <ProximoPasso
            titulo="Nenhuma automação ligada"
            texto="Se o cliente parar de responder, ninguém volta a falar. Ative o lembrete de 24h — a mensagem é sua."
            acao="Ativar lembrete"
            href="#pronto-followup-24h"
          />
        </div>
      ) : null}
      <Card id="pronto-followup-24h" className="space-y-3 p-4" data-testid="pronto-followup-24h">
        <h2 className="text-sm font-semibold">Lembrar cliente se ele não responder</h2>
        <p className="text-sm text-muted-foreground">
          Se o cliente ficar em silêncio, o sistema manda este recado. Se ele
          responder, o lembrete para. Funciona mesmo com a IA desligada.
        </p>
        <div className="space-y-1.5">
          <Label htmlFor="pronto-followup-24h-horas">Esperar (horas)</Label>
          <Input
            id="pronto-followup-24h-horas"
            data-testid="pronto-followup-24h-horas"
            type="number"
            min={1}
            max={168}
            step={1}
            value={horas}
            disabled={!canWrite}
            onChange={(e) => setHoras(Number(e.target.value))}
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="pronto-followup-24h-mensagem">Mensagem</Label>
          <Textarea
            id="pronto-followup-24h-mensagem"
            data-testid="pronto-followup-24h-mensagem"
            rows={4}
            maxLength={1000}
            value={mensagem}
            disabled={!canWrite}
            onChange={(e) => setMensagem(e.target.value)}
          />
        </div>
        {ativo ? (
          <p data-testid="pronto-followup-24h-ativo" className="text-sm font-medium">
            Ligado
          </p>
        ) : null}
        {canWrite ? (
          <Button
            type="button"
            data-testid={ativo ? "pronto-followup-24h-salvar" : "pronto-followup-24h-ativar"}
            disabled={enviando}
            onClick={() => void gravar()}
          >
            {enviando ? "Salvando…" : ativo ? "Salvar" : "Ativar"}
          </Button>
        ) : null}
      </Card>
    </div>
  );
}
