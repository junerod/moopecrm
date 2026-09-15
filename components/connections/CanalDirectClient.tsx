"use client";
import { useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { toast } from "sonner";

import {
  useConnectDirectChannel,
  useDirectChannel,
  useSyncDirectChannel,
} from "@/hooks/channels/useDirectChannel";
import { ProximoPasso } from "@/components/ds/ProximoPasso";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

const ERRO_DA_VOLTA: Record<string, string> = {
  cancelado: "Você cancelou na Meta. Nada foi ligado.",
  app_nao_configurado: "Esta instalação ainda não é um app da Meta (falta o id do app no servidor).",
  segredo_indisponivel: "Não foi possível assinar o retorno. Fale com quem administra o servidor.",
  state_invalido: "O retorno da Meta expirou. Clique de novo em Continuar com Instagram.",
  sessao: "Entre de novo e tente outra vez.",
  codigo_ausente: "A Meta voltou sem o código. Tente de novo.",
  conta_invalida: "Esse @ não parece um Instagram. Use só o nome, tipo moopetec.",
  conta_diferente:
    "A Meta autorizou outra conta. Confira se escolheu o mesmo @ na tela dela.",
  instagram_sem_pagina:
    "Essa conta profissional precisa estar ligada a uma Página no Meta Business Suite.",
  troca_falhou: "A Meta recusou a troca. Tente de novo em alguns minutos.",
  gravar: "A autorização passou, mas não deu para guardar. Tente de novo.",
};

function AjudaOperador() {
  return (
    <Card className="max-w-xl space-y-2 p-4" data-testid="instagram-ajuda">
      <h3 className="text-sm font-semibold">Como liga</h3>
      <p className="text-sm text-muted-foreground">
        Você só precisa do <strong>@</strong> da empresa. Clique no botão: a
        Meta pede senha e Authenticator. O CRM acha a conta e traz as
        mensagens da caixa para a Inbox. Não lê post nem anúncio. Enquanto
        o app da Meta estiver em desenvolvimento, só entra Direct de quem
        também é testador.
      </p>
    </Card>
  );
}

function AjudaInstalador() {
  return (
    <Card className="max-w-2xl space-y-3 p-4" data-testid="instagram-ajuda">
      <p className="text-sm text-muted-foreground">
        Quem administra o servidor ainda precisa criar o app na Meta e
        colocar o id e o secret. Enquanto isso, o WhatsApp que já está no ar
        continua atendendo.
      </p>
    </Card>
  );
}

export function CanalDirectClient() {
  const { data, isPending } = useDirectChannel();
  const conectar = useConnectDirectChannel();
  const sincronizar = useSyncDirectChannel();
  const params = useSearchParams();
  const [form, setForm] = useState({ account_id: "", token: "" });
  const estado = data?.data;

  useEffect(() => {
    if (params.get("ok") === "1") {
      toast.success("Instagram ligado. Direct de testador entra na Inbox.");
      return;
    }
    const codigo = params.get("erro");
    if (codigo) toast.error(ERRO_DA_VOLTA[codigo] ?? "Não deu para autorizar.");
  }, [params]);

  async function enviarAtalho(e: React.FormEvent) {
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

  const podeApp = Boolean(estado?.podeConectarComoApp);
  const mostrarAtalhoTecnico = !podeApp && (estado?.podeReceber || estado?.connected);

  return (
    <div className="space-y-4" data-testid="canal-direct">
      <div>
        <h2 className="text-base font-semibold">Instagram</h2>
        <p className="mt-1 max-w-xl text-sm text-muted-foreground">
          O @ em que o cliente fala com a empresa. Senha e Authenticator
          ficam na Meta — o CRM não pede.
        </p>
      </div>

      {estado?.connected ? (
        <Card className="space-y-3 p-4" data-testid="direct-conectado">
          <div className="flex flex-wrap items-center gap-2">
            <span className="font-medium">{estado.displayName}</span>
            <Badge>{estado.status ?? "—"}</Badge>
          </div>
          <p className="max-w-xl text-sm text-muted-foreground">
            Se mandou Direct e a Inbox ficou vazia: enquanto o app da Meta
            está em desenvolvimento, quem envia também precisa ser testador
            do Instagram. Depois, mande de novo ou busque aqui.
          </p>
          <Button
            type="button"
            variant="outline"
            data-testid="instagram-buscar"
            disabled={sincronizar.isPending}
            onClick={async () => {
              const r = await sincronizar.mutateAsync();
              const n = r.data.imported;
              toast.success(
                n > 0
                  ? `${n} mensagem${n === 1 ? "" : "ns"} do Instagram na Inbox.`
                  : "Nenhuma conversa nova. A Meta só entrega Direct de testador enquanto o app não está publicado.",
              );
            }}
          >
            {sincronizar.isPending ? "Buscando…" : "Buscar mensagens"}
          </Button>
        </Card>
      ) : null}

      {podeApp && !estado?.connected ? (
        <form
          action="/api/v1/channels/direct/oauth"
          method="get"
          className="grid max-w-md gap-3"
          data-testid="instagram-conectar-arroba"
        >
          <div className="grid gap-1.5">
            <Label htmlFor="instagram-conta">Seu Instagram</Label>
            <Input
              id="instagram-conta"
              name="conta"
              placeholder="@moopetec"
              autoComplete="off"
              required
            />
          </div>
          <Button type="submit" data-testid="instagram-continuar">
            Continuar com Instagram
          </Button>
        </form>
      ) : null}

      {podeApp && estado?.connected ? (
        <Button asChild variant="outline" data-testid="instagram-continuar">
          <a href="/api/v1/channels/direct/oauth">Trocar de conta</a>
        </Button>
      ) : null}

      {!estado?.podeReceber && !estado?.connected && !podeApp ? (
        <ProximoPasso
          testId="direct-proximo-passo"
          titulo="Esta instalação ainda não é um app da Meta"
          texto="Quem administra o servidor precisa criar o app e colocar o id e o secret. O WhatsApp que já está no ar continua atendendo."
          acao="Ver conversas"
          href="/app/inbox"
        />
      ) : null}

      {mostrarAtalhoTecnico ? (
        <form onSubmit={enviarAtalho} className="grid max-w-xl gap-3" data-testid="direct-conectar">
          <div className="grid gap-1.5">
            <Label htmlFor="direct-account-id">Id da conta profissional do Instagram</Label>
            <Input
              id="direct-account-id"
              value={form.account_id}
              onChange={(e) => setForm((f) => ({ ...f, account_id: e.target.value }))}
              required
              autoComplete="off"
            />
          </div>
          <div className="grid gap-1.5">
            <Label htmlFor="direct-token">Token do app</Label>
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
      ) : null}

      {podeApp ? <AjudaOperador /> : <AjudaInstalador />}
    </div>
  );
}
