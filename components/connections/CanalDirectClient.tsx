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
 * Porta do Instagram na mesma Inbox.
 *
 * Sem o app da instalação pronto para receber, não há botão de conectar —
 * ligar agora seria prometer mensagem que não chega. O passo a passo fica
 * visível do mesmo jeito: é a ajuda de como chegar lá.
 */
function AjudaInstagram() {
  return (
    <Card className="max-w-2xl space-y-3 p-4" data-testid="instagram-ajuda">
      <div>
        <h3 className="text-sm font-semibold">O que isto liga — e o que não liga</h3>
        <p className="mt-1 text-sm text-muted-foreground">
          Liga a <strong>caixa de mensagens</strong> do Instagram (a conversa
          com o cliente) na mesma Inbox do WhatsApp. Não lê post, story nem
          resultado de anúncio. Quem faz propaganda no @ continua vendo
          campanha no Gerenciador de Anúncios da Meta; essa análise ainda
          não é esta tela.
        </p>
      </div>
      <div>
        <h3 className="text-sm font-semibold">Como ligar a conta profissional</h3>
        <ol className="mt-1 list-decimal space-y-1.5 pl-5 text-sm text-muted-foreground">
          <li>
            Entre no Instagram / Meta no celular. Se pedir Authenticator, o
            código é lá — o CRM nunca pede senha nem esse número.
          </li>
          <li>
            A conta tem de ser <strong>profissional</strong> (Criador ou
            Empresa). Pessoal não tem caixa para o CRM receber.
          </li>
          <li>
            No <strong>Meta Business Suite</strong>, ligue esse Instagram a
            uma Página do Facebook da empresa.
          </li>
          <li>
            Anote o <strong>ID da conta profissional</strong> — um número
            longo, não o @. Em Business Suite: Configurações → Contas do
            Instagram. Ou, na Página: Instagram → ID da conta.
          </li>
          <li>
            No app da Meta (developers.facebook.com), ative{" "}
            <strong>Instagram Messaging</strong> e o webhook. Cole a URL que
            esta tela mostrar quando o app da instalação já receber.
          </li>
          <li>
            Quem administra o servidor liga{" "}
            <code className="text-xs">META_WEBHOOK_VERIFY_TOKEN</code> e{" "}
            <code className="text-xs">META_APP_SECRET</code>. Sem isto o
            botão de conectar não aparece — não prometemos mensagem que não
            chega.
          </li>
          <li>
            Volte aqui, cole o ID e o token do app (ou use o token da API
            oficial, se ela já estiver ligada) e <strong>Conectar Instagram</strong>.
          </li>
        </ol>
      </div>
    </Card>
  );
}

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

  const cabecalho = (
    <div>
      <h2 className="text-base font-semibold">Instagram</h2>
      <p className="mt-1 max-w-xl text-sm text-muted-foreground">
        A conta em que o negócio anuncia. A conversa do cliente entra nesta
        Inbox, do lado do WhatsApp.
      </p>
    </div>
  );

  if (!estado?.podeReceber && !estado?.connected) {
    return (
      <div className="space-y-4" data-testid="canal-direct">
        {cabecalho}
        <ProximoPasso
          testId="direct-proximo-passo"
          titulo="Esta instalação ainda não recebe o Instagram"
          texto="O administrador precisa ligar o app da Meta no servidor. Enquanto isso, o atendimento continua no WhatsApp que já está no ar."
          acao="Ver conversas"
          href="/app/inbox"
        />
        <AjudaInstagram />
      </div>
    );
  }

  return (
    <div className="space-y-4" data-testid="canal-direct">
      {cabecalho}

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
            <h3 className="font-medium">Cole isto no app da Meta</h3>
            <p className="mt-1 text-sm text-muted-foreground">
              Mesma URL do WhatsApp oficial, se ele já estiver no ar. Sem
              este passo o Instagram envia e não recebe.
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
          <Label htmlFor="direct-account-id">Id da conta profissional do Instagram</Label>
          <Input
            id="direct-account-id"
            value={form.account_id}
            onChange={(e) => setForm((f) => ({ ...f, account_id: e.target.value }))}
            required
            autoComplete="off"
            placeholder="Número longo — não é o @"
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
          {conectar.isPending ? "Conectando…" : "Conectar Instagram"}
        </Button>
      </form>

      <AjudaInstagram />
    </div>
  );
}
