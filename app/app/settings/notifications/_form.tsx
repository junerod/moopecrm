"use client";

import { useEffect, useState } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { useAlertPrefs } from "@/hooks/comercial/useAlertPrefs";
import { ANTECEDENCIAS_MIN } from "@/lib/comercial/alerta-interno";

export function AlertasPessoaisForm() {
  const { data, isLoading, salvar } = useAlertPrefs();
  const [phone, setPhone] = useState("");
  const [ligado, setLigado] = useState(false);
  const [antecedencia, setAntecedencia] = useState<(typeof ANTECEDENCIAS_MIN)[number]>(30);

  useEffect(() => {
    if (!data) return;
    setPhone(data.alert_whatsapp_phone ?? "");
    setLigado(data.alert_proxima_acao);
    setAntecedencia(data.alert_antecedencia_min);
  }, [data]);

  return (
    <Card className="space-y-4 p-4" data-testid="alertas-pessoais">
      <header>
        <h2 className="text-base font-semibold">Alertas pessoais</h2>
        <p className="text-sm text-muted-foreground">
          WhatsApp particular do atendente — nunca o número do cliente. Envio interno
          MOOPE, sem conversa no CRM.
        </p>
      </header>
      <label className="block text-sm">
        <span className="text-muted-foreground">WhatsApp para lembretes</span>
        <input
          data-testid="alert-whatsapp-phone"
          value={phone}
          onChange={(e) => setPhone(e.target.value)}
          placeholder="+5511999999999"
          className="mt-1 w-full rounded-md border border-input bg-background px-2 py-1.5"
        />
      </label>
      <label className="flex items-center gap-2 text-sm">
        <input
          type="checkbox"
          data-testid="alert-proxima-acao"
          checked={ligado}
          onChange={(e) => setLigado(e.target.checked)}
        />
        Próximas ações e atrasadas
      </label>
      <label className="block text-sm">
        <span className="text-muted-foreground">Antecedência</span>
        <select
          data-testid="alert-antecedencia"
          className="mt-1 w-full rounded-md border border-input bg-background px-2 py-1.5"
          value={antecedencia}
          onChange={(e) =>
            setAntecedencia(Number(e.target.value) as (typeof ANTECEDENCIAS_MIN)[number])
          }
        >
          <option value={10}>10 min</option>
          <option value={30}>30 min</option>
          <option value={60}>1 hora</option>
        </select>
      </label>
      <Button
        disabled={isLoading || salvar.isPending}
        data-testid="salvar-alertas-pessoais"
        onClick={() => {
          salvar.mutate(
            {
              alert_whatsapp_phone: phone.trim() || null,
              alert_proxima_acao: ligado,
              alert_antecedencia_min: antecedencia,
            },
            {
              onSuccess: () => toast.success("Alertas pessoais salvos."),
              onError: () => toast.error("Não consegui salvar. Confira o número em E.164."),
            },
          );
        }}
      >
        {salvar.isPending ? "Salvando…" : "Salvar"}
      </Button>
    </Card>
  );
}
