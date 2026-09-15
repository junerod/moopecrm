"use client";
import { useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { toast } from "sonner";

import { useConnectDirectChannel, useDirectChannel } from "@/hooks/channels/useDirectChannel";
import { ProximoPasso } from "@/components/ds/ProximoPasso";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { copyToClipboard } from "@/lib/clipboard";

const ERRO_DA_VOLTA: Record<string, string> = {
  cancelado: "Você cancelou na Meta. Nada foi ligado.",
  app_nao_configurado: "Esta instalação ainda não é um app da Meta (falta o id do app no servidor).",
  segredo_indisponivel: "Não foi possível assinar o retorno. Fale com quem administra o servidor.",
  state_invalido: "O retorno da Meta expirou. Clique de novo em Continuar com Instagram.",
  sessao: "Entre de novo e tente outra vez.",
  codigo_ausente: "A Meta voltou sem o código. Tente de novo.",
  instagram_sem_pagina:
    "Essa conta profissional precisa estar ligada a uma Página no Meta Business Suite.",
  troca_falhou: "A Meta recusou a troca. Confira se o app tem Instagram Messaging.",
  gravar: "A autorização passou, mas não deu para guardar. Tente de novo.",
};

function AjudaInstagram() {
  return (
    <Card className="max-w-2xl space-y-3 p-4" data-testid="instagram-ajuda">
      <div>
        <h3 className="text-sm font-semibold">O que isto liga — e o que não liga</h3>
        <p className="mt-1 text-sm text-muted-foreground">
          O CRM vira um <strong>app autorizado</strong> da conta profissional
          — o mesmo lugar de Contas › Conexões de apps no celular. Liga a
          caixa de mensagens na Inbox. Não lê post, story nem resultado de
          anúncio.
        </p>
      </div>
      <div>
        <h3 className="text-sm font-semibold">Como ligar o @moopetec (ou o @ da empresa)</h3>
        <ol className="mt-1 list-decimal space-y-1.5 pl-5 text-sm text-muted-foreground">
          <li>
            A conta já precisa ser <strong>profissional</strong> e estar na
            Central de contas. Authenticator, se pedir, é no celular.
          </li>
          <li>
            No Meta Business Suite, ligue esse Instagram a uma{" "}
            <strong>Página do Facebook</strong> da empresa.
          </li>
          <li>
            Quem administra o servidor cria o app em developers.facebook.com
            (Instagram Messaging + Login) e põe{" "}
            <code className="text-xs">META_APP_ID</code> e{" "}
            <code className="text-xs">META_APP_SECRET</code>. Sem isto o
            botão <strong>Continuar com Instagram</strong> não aparece.
          </li>
          <li>
            Clique no botão. A Meta pede o Authenticator. Ao aceitar, o CRM
            entra em Conexões de apps.
          </li>
          <li>
            Para a mensagem chegar, o mesmo app precisa do webhook (
            <code className="text-xs">META_WEBHOOK_VERIFY_TOKEN</code>
            ). Sem isso a conta autoriza e a Inbox ainda não recebe.
          </li>
        </ol>
      </div>
    </Card>
  );
}

export function CanalDirectClient() {
  const { data, isPending } = useDirectChannel();
  const conectar = useConnectDirectChannel();
  const params = useSearchParams();
  const [form, setForm] = useState({ account_id: "", token: "" });
  const estado = data?.data;

  useEffect(() => {
    if (params.get("ok") === "1") {
      toast.success("Instagram autorizado. O CRM agora é um app desta conta.");
      return;
    }
    const codigo = params.get("erro");
    if (codigo) toast.error(ERRO_DA_VOLTA[codigo] ?? "Não deu para autorizar.");
  }, [params]);

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
        A conta em que o negócio anuncia. Você autoriza o CRM como um app —
        senha e Authenticator ficam na Meta.
      </p>
    </div>
  );

  const botaoApp = estado?.podeConectarComoApp ? (
    <Button asChild data-testid="instagram-continuar">
      <a href="/api/v1/channels/direct/oauth">Continuar com Instagram</a>
    </Button>
  ) : null;

  const formulario =
    estado?.podeReceber || estado?.connected ? (
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
          <Label htmlFor="direct-token">Token do app (atalho, se não for pelo botão acima)</Label>
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
    ) : null;

  return (
    <div className="space-y-4" data-testid="canal-direct">
      {cabecalho}

      {estado?.connected ? (
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

      {botaoApp}

      {!estado?.podeReceber && !estado?.connected ? (
        <ProximoPasso
          testId="direct-proximo-passo"
          titulo={
            estado?.podeConectarComoApp
              ? "Pode autorizar o app; a mensagem ainda não chega"
              : "Esta instalação ainda não é um app da Meta"
          }
          texto={
            estado?.podeConectarComoApp
              ? "Continuar com Instagram abre a Meta. Para a conversa cair na Inbox, falta o webhook no servidor."
              : "Quem administra o servidor precisa criar o app e colocar o id e o secret. Enquanto isso, o WhatsApp que já está no ar continua atendendo."
          }
          acao="Ver conversas"
          href="/app/inbox"
        />
      ) : null}

      {estado?.webhook ? (
        <Card className="flex flex-col gap-3 p-4">
          <div>
            <h3 className="font-medium">Cole isto no webhook do app da Meta</h3>
            <p className="mt-1 text-sm text-muted-foreground">
              Sem este passo o Instagram autoriza e a Inbox não recebe.
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

      {formulario}
      <AjudaInstagram />
    </div>
  );
}
