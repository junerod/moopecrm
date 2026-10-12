"use client";

import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

type Config = {
  phone: string;
  enabled: boolean;
  secret_configured: boolean;
  assessor_ok?: boolean;
  assessor_error?: string | null;
};

function unwrap<T>(json: unknown): T {
  const r = json as { data?: T; error?: { message?: string } };
  if (r.error?.message) throw new Error(r.error.message);
  return r.data as T;
}

export function AssessorAlertClient() {
  const qc = useQueryClient();
  const q = useQuery({
    queryKey: ["assessor-config"],
    queryFn: async () => {
      const res = await fetch("/api/v1/integrations/assessor");
      return unwrap<Config>(await res.json());
    },
  });
  const [phone, setPhone] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const shown = phone ?? q.data?.phone ?? "";

  async function salvar(enabled: boolean) {
    setSaving(true);
    try {
      const res = await fetch("/api/v1/integrations/assessor", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ phone: shown, enabled }),
      });
      const data = unwrap<Config>(await res.json());
      if (!res.ok) throw new Error("Não salvei.");
      if (data.assessor_error === "secret_missing") {
        toast.message("Número salvo no CRM. O aviso no WhatsApp ainda precisa do segredo do Assessor no servidor.");
      } else if (data.assessor_error === "no_conversation") {
        toast.message("Número liberado. Peça para essa pessoa mandar um oi no Meu Assessor — senão o aviso não chega.");
      } else if (data.assessor_ok === false) {
        toast.error("Salvei aqui, mas o Assessor não confirmou a liberação.");
      } else {
        toast.success(enabled ? "Número liberado no Meu Assessor." : "Avisos desligados.");
      }
      setPhone(null);
      await qc.invalidateQueries({ queryKey: ["assessor-config"] });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Falhou.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>WhatsApp do Meu Assessor</CardTitle>
        <CardDescription>
          Quando um cliente novo manda a primeira mensagem, o Assessor avisa esse número no WhatsApp.
          A pessoa precisa já ter conversado com o Meu Assessor pelo menos uma vez.
          No próprio Zap ela pode mandar “ligar alerta lead” ou “desligar alerta lead”. Desligar para só o aviso.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="assessor-phone">Número (com DDD)</Label>
          <Input
            id="assessor-phone"
            inputMode="tel"
            placeholder="61 99999-0000"
            value={shown}
            onChange={(e) => setPhone(e.target.value)}
          />
        </div>
        <p className="text-sm text-muted-foreground">
          {q.data?.enabled ? "Avisos ligados." : "Avisos desligados."}
          {q.data && !q.data.secret_configured
            ? " O servidor do CRM ainda não tem o segredo do Assessor."
            : ""}
        </p>
        <div className="flex flex-wrap gap-2">
          <Button type="button" disabled={saving || shown.replace(/\D/g, "").length < 10} onClick={() => salvar(true)}>
            Liberar e avisar
          </Button>
          <Button type="button" variant="outline" disabled={saving} onClick={() => salvar(false)}>
            Desligar
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
