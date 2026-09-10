"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { apiClient } from "@/lib/api/client";
import type { AiActionPolicyConfig, AiMode } from "@/lib/schemas/settings";
import { AI_MODES } from "@/lib/schemas/settings";
import { ROTULO_DO_MODO_IA, rotuloDoModoIa } from "@/lib/negocio/rotulos";

export interface AiModeEstado {
  configured: AiMode;
  effective: AiMode;
  kill_global: boolean;
  reason: string;
  agent_published: boolean;
  action_policy: AiActionPolicyConfig;
}

export function AiModeForm({ initial }: { initial: { configured: AiMode } }) {
  const [modo, setModo] = useState<AiMode>(initial.configured);
  const [salvo, setSalvo] = useState<AiMode>(initial.configured);
  const [estado, setEstado] = useState<AiModeEstado | null>(null);
  const [isPending, startTransition] = useTransition();
  const tocou = useRef(false);

  useEffect(() => {
    let cancelado = false;
    void apiClient
      .get<{ data: AiModeEstado }>("/api/v1/settings/ai-mode")
      .then((r) => {
        // GET atrasado não pode apagar escolha/salvamento já feitos nesta tela.
        if (cancelado || tocou.current) return;
        setEstado(r.data);
        setModo(r.data.configured);
        setSalvo(r.data.configured);
      })
      .catch(() => {
        /* a tela ainda deixa escolher; o GET é o efetivo */
      });
    return () => {
      cancelado = true;
    };
  }, []);

  function salvar(e: React.FormEvent) {
    e.preventDefault();
    startTransition(async () => {
      try {
        const r = await apiClient.patch<{ data: AiModeEstado }>("/api/v1/settings/ai-mode", {
          ai_mode: modo,
        });
        tocou.current = true;
        setEstado(r.data);
        setModo(r.data.configured);
        setSalvo(r.data.configured);
        toast.success("Modo da IA salvo.");
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "Não consegui salvar o modo da IA.");
      }
    });
  }

  const efetivo = estado?.effective ?? modo;
  const motivo = estado?.reason ?? null;

  return (
    <form onSubmit={salvar} className="flex max-w-3xl flex-col gap-4" data-testid="form-ai-mode">
      <Card className="space-y-4 p-4">
        <div>
          <h2 className="text-sm font-semibold">Modo da IA</h2>
          <p className="text-xs text-muted-foreground">
            Quem manda na conversa continua sendo o comando do Inbox. Isto só
            define o que a IA pode fazer.
          </p>
        </div>

        <div className="space-y-2">
          {AI_MODES.map((m) => (
            <label
              key={m}
              data-testid={`opcao-ai-mode-${m}`}
              data-marcada={modo === m ? "sim" : "nao"}
              className={`flex cursor-pointer items-start gap-3 rounded-lg border p-3 transition-colors ${
                modo === m ? "border-primary bg-primary/5" : "border-border hover:bg-muted/40"
              }`}
            >
              <input
                type="radio"
                name="ai_mode"
                value={m}
                checked={modo === m}
                onChange={() => {
                  tocou.current = true;
                  setModo(m);
                }}
                disabled={isPending}
                className="mt-1 h-4 w-4 shrink-0 accent-primary"
                aria-label={ROTULO_DO_MODO_IA[m].titulo}
              />
              <span className="space-y-1">
                <span className="block text-sm font-medium">{ROTULO_DO_MODO_IA[m].titulo}</span>
                <span className="block text-xs text-muted-foreground">{ROTULO_DO_MODO_IA[m].corpo}</span>
              </span>
            </label>
          ))}
        </div>

        <div
          data-testid="ai-mode-efetivo"
          className="rounded-md border border-border bg-muted/30 p-3 text-xs"
        >
          <p>
            Configurado: <strong data-testid="ai-mode-configurado">{rotuloDoModoIa(modo)}</strong>
          </p>
          <p>
            Efetivo: <strong data-testid="ai-mode-valor-efetivo">{rotuloDoModoIa(efetivo)}</strong>
          </p>
          {motivo && efetivo === "off" && modo !== "off" ? (
            <p data-testid="ai-mode-motivo" className="mt-1 text-muted-foreground">
              Motivo: {motivo.replace("GLOBAL AI_EXECUTION=off — nenhuma IA conversacional executa.", "IA desativada globalmente.")}
            </p>
          ) : null}
          {estado ? (
            <p className="mt-1 text-muted-foreground">
              Kill global: {estado.kill_global ? "ativo" : "inativo"}.{" "}
              Agente publicado: {estado.agent_published ? "sim" : "não"}.
            </p>
          ) : null}
        </div>

        <Button type="submit" disabled={isPending || modo === salvo}>
          {isPending ? "Salvando…" : "Salvar modo da IA"}
        </Button>
      </Card>
    </form>
  );
}
