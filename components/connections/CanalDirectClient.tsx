"use client";
import { useState } from "react";
import { toast } from "sonner";

import { useConnectDirectChannel, useDirectChannel } from "@/hooks/channels/useDirectChannel";
import { ProximoPasso } from "@/components/ds/ProximoPasso";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { copyToClipboard } from "@/lib/clipboard";

/**
 * Porta do Direct na mesma Inbox.
 *
 * Sem o app da instalação pronto para receber, não há botão de conectar —
 * ligar agora seria prometer mensagem que não chega. Com o app no ar, a
 * conta profissional entra aqui e a DM cai do lado do WhatsApp.
 */
export function CanalDirectClient() {
  const { data, isPending } = useDirectChannel();
  const conectar = useConnectDirectChannel();
  const [form, setForm] = useState({ account_id: "", token: "" });
  const estado = data?.data;

  async function enviar(e: React.FormEvent) {
    e.preventDefault();
    const r = await conectar.mutateAsync({
      account_id: form.account_id,
      token: form.token.trim() || undefined,
    });
    toast.success(`Conectado: ${r.data.displayName}`);
    setForm((f) => ({ ...f, token: "" }));
  }

  if (isPending) {
    return <p className="text-sm text-muted-foreground">Carregando…</p>;
  }

  if (!estado?.podeReceber && !estado?.connected) {
    return (
      <div className="space-y-4" data-testid="canal-direct">
        <div>
          <h2 className="text-base font-semibold">Direct</h2>
          <p className="mt-1 max-w-xl text-sm text-muted-foreground">
            A mesma Inbox, outro canal. Ainda não conecta: o app desta
            instalação não está pronto para receber. Ligar agora seria
            prometer mensagem que não chega.
          </p>
        </div>
        <ProximoPasso
          testId="direct-proximo-passo"
          titulo="WhatsApp já atende nesta Inbox"
          texto="O Direct usa o mesmo lugar. Enquanto o app da instalação não recebe, o atendimento continua no número que já está no ar."
          acao="Ver conversas"
          href="/app/inbox"
        />
      </div>
    );
  }

  return (
    <div className="space-y-4" data-testid="canal-direct">
      <div>
        <h2 className="text-base font-semibold">Direct</h2>
        <p className="mt-1 max-w-xl text-sm text-muted-foreground">
          A conversa do cliente entra aqui do lado do WhatsApp — sem fila
          separada e sem app paralelo.
        </p>
      </div>

      {estado.connected ? (
        <Card className="p-4" data-testid="direct-conectado">
          <div className="flex flex-wrap items-center gap-2">
            <span className="font-medium">{estado.displayName}</span>
            <Badge>{estado.status ?? "—"}</Badge>
            <Badge variant={estado.hasToken ? "outline" : "destructive"}>
              {estado.hasToken ? "credencial guardada" : "sem credencial"}
            </Badge>
          </div>
          <p className="mt-1 font-mono text-xs text-muted-foreground">{estado.accountId}</p>
        </Card>
      ) : null}

      {estado.webhook ? (
        <Card className="flex flex-col gap-3 p-4">
          <div>
            <h3 className="font-medium">Cole isto no app da instalação</h3>
            <p className="mt-1 text-sm text-muted-foreground">
              Mesma URL do canal oficial, se ele já estiver no ar. Sem este
              passo o Direct envia e não recebe.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <code className="flex-1 overflow-x-auto rounded bg-muted px-2 py-1.5 text-xs">
              {estado.webhook.callbackUrl}
            </code>
            <Button
              size="sm"
              variant="outline"
              onClick={async () => {
                await copyToClipboard(estado.webhook!.callbackUrl);
                toast.success("Copiado.");
              }}
            >
              Copiar
            </Button>
          </div>
        </Card>
      ) : null}

      <form onSubmit={enviar} className="grid max-w-xl gap-3" data-testid="direct-conectar">
        <div className="grid gap-1.5">
          <Label htmlFor="direct-account-id">Id da conta profissional</Label>
          <Input
            id="direct-account-id"
            value={form.account_id}
            onChange={(e) => setForm((f) => ({ ...f, account_id: e.target.value }))}
            required
            autoComplete="off"
          />
        </div>
        <div className="grid gap-1.5">
          <Label htmlFor="direct-token">Token do app (se a API oficial ainda não estiver conectada)</Label>
          <Input
            id="direct-token"
            type="password"
            value={form.token}
            onChange={(e) => setForm((f) => ({ ...f, token: e.target.value }))}
            autoComplete="off"
          />
        </div>
        <Button type="submit" disabled={conectar.isPending}>
          {conectar.isPending ? "Conectando…" : "Conectar Direct"}
        </Button>
      </form>
    </div>
  );
}
