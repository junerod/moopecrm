"use client";
import { useEffect, useState } from "react";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { apiClient } from "@/lib/api/client";
import { copyToClipboard } from "@/lib/clipboard";

/**
 * Conectar um número por API de mensagens hospedada (SID + token + número).
 * O rótulo comercial vem do servidor.
 */

interface Estado {
  label: string;
  connected: boolean;
  phone_number: string | null;
  display_name: string | null;
  status: string | null;
  has_token: boolean;
  webhook_url: string | null;
}

interface Conectado {
  webhook_url: string;
  phone_number: string | null;
}

function ParaColar({ rotulo, valor }: { rotulo: string; valor: string }) {
  return (
    <div className="flex flex-col gap-1">
      <span className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
        {rotulo}
      </span>
      <div className="flex items-center gap-2">
        <code className="flex-1 overflow-x-auto rounded bg-muted px-2 py-1.5 text-xs">{valor}</code>
        <Button
          size="sm"
          variant="outline"
          onClick={async () => {
            await copyToClipboard(valor);
            toast.success("Copiado.");
          }}
        >
          Copiar
        </Button>
      </div>
    </div>
  );
}

export function CanalHospedadoClient() {
  const [estado, setEstado] = useState<Estado | null>(null);
  const [accountSid, setAccountSid] = useState("");
  const [authToken, setAuthToken] = useState("");
  const [fromNumber, setFromNumber] = useState("");
  const [salvando, setSalvando] = useState(false);
  const [recemConectado, setRecemConectado] = useState<Conectado | null>(null);

  const carregar = async () => {
    try {
      const r = await apiClient.get<{ data: Estado }>("/api/v1/channels/hosted");
      setEstado(r.data);
    } catch {
      setEstado(null);
    }
  };

  useEffect(() => {
    void carregar();
  }, []);

  const conectar = async () => {
    setSalvando(true);
    try {
      const r = await apiClient.post<{ data: Conectado }>("/api/v1/channels/hosted", {
        account_sid: accountSid,
        auth_token: authToken,
        from_number: fromNumber,
      });
      setRecemConectado(r.data);
      setAuthToken("");
      toast.success("Canal conectado.");
      await carregar();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Não foi possível conectar.");
    } finally {
      setSalvando(false);
    }
  };

  const rotulo = estado?.label ?? "API de mensagens";
  const conectado = estado?.connected ?? false;

  return (
    <div className="flex flex-col gap-4">
      <Card className="flex flex-col gap-4 p-4">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h3 className="text-sm font-semibold">Conectar por {rotulo}</h3>
            <p className="text-xs text-muted-foreground">
              Número oficial de WhatsApp pela API de mensagens. Fora da janela de 24h só sai
              modelo aprovado (o SID que a locadora já usa). Não use o mesmo chip do QR.
            </p>
          </div>
          {conectado ? (
            <Badge variant="secondary">Conectado</Badge>
          ) : (
            <Badge variant="outline">Não conectado</Badge>
          )}
        </div>

        {conectado && (
          <div className="rounded-md border border-border bg-muted/40 p-3 text-sm">
            <p className="font-medium">{estado?.display_name ?? "Número conectado"}</p>
            <p className="text-xs text-muted-foreground">
              {estado?.phone_number ?? "sem número"} · {estado?.status ?? "—"}
            </p>
          </div>
        )}

        <div className="flex flex-col gap-3">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="hospedado-sid">SID da conta</Label>
            <Input
              id="hospedado-sid"
              value={accountSid}
              onChange={(e) => setAccountSid(e.target.value)}
              placeholder="ACxxxxxxxx"
              autoComplete="off"
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="hospedado-token">Token</Label>
            <Input
              id="hospedado-token"
              type="password"
              value={authToken}
              onChange={(e) => setAuthToken(e.target.value)}
              placeholder={estado?.has_token ? "gravado — preencha para trocar" : "cole o token"}
              autoComplete="off"
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="hospedado-from">Número WhatsApp</Label>
            <Input
              id="hospedado-from"
              value={fromNumber}
              onChange={(e) => setFromNumber(e.target.value)}
              placeholder="+1…"
              autoComplete="off"
            />
            <p className="text-xs text-muted-foreground">
              O sender já aprovado no provedor — não o chip pareado por QR.
            </p>
          </div>
          <div>
            <Button
              onClick={conectar}
              disabled={salvando || !accountSid || !authToken || !fromNumber}
            >
              {salvando ? "Verificando…" : conectado ? "Reconectar" : "Conectar"}
            </Button>
          </div>
        </div>
      </Card>

      {recemConectado && (
        <Card className="flex flex-col gap-4 border-warning/40 bg-warning-bg p-4">
          <div>
            <h3 className="text-sm font-semibold">Falta ligar a volta</h3>
            <p className="text-xs text-muted-foreground">
              Cole esta URL no webhook de mensagens do provedor (A message comes in). Sem isso o
              CRM envia e não recebe.
            </p>
          </div>
          <ParaColar rotulo="URL do webhook" valor={recemConectado.webhook_url} />
        </Card>
      )}

      {conectado && !recemConectado && estado?.webhook_url && (
        <Card className="flex flex-col gap-3 p-4">
          <h3 className="text-sm font-semibold">Webhook</h3>
          <ParaColar rotulo="URL do webhook" valor={estado.webhook_url} />
        </Card>
      )}
    </div>
  );
}
