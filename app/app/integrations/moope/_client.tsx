"use client";

import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { copyToClipboard } from "@/lib/clipboard";
import { ABA_COMO_USAR } from "@/lib/moope/guia-integracao";
import { enderecoDeLeitura } from "@/lib/moope/origem-da-leitura";

import { GuiaIntegracaoMoope } from "./guia";

type Kind = "locadora" | "juridico";

interface Conexao {
  id: string;
  kind: Kind;
  partner_webhook_url: string | null;
  partner_api_url: string | null;
  inbound_key_prefix: string;
  status: "active" | "disabled";
  public_url: string;
  inbound_key?: string;
  outbound_secret?: string;
  agente?: { id?: string; status?: string; origem?: string; motivo?: string };
  _warning?: string;
}

function unwrap<T>(json: unknown): T {
  const r = json as { data?: T; error?: { message?: string } };
  if (r.error?.message) throw new Error(r.error.message);
  return r.data as T;
}

export function MoopeConnectionClient() {
  const qc = useQueryClient();
  const [kindEdit, setKind] = useState<Kind | null>(null);
  const [webhookEdit, setWebhook] = useState<string | null>(null);
  const [apiUrlEdit, setApiUrl] = useState<string | null>(null);
  const [segredos, setSegredos] = useState<{ inbound?: string; outbound?: string } | null>(null);
  const [pendente, setPendente] = useState(false);
  const [aba, setAba] = useState("conexao");

  const consulta = useQuery({
    queryKey: ["moope-connection"],
    queryFn: async () => {
      const res = await fetch("/api/v1/integrations/moope");
      const json = await res.json();
      return unwrap<Conexao | null>(json);
    },
  });
  const conexao = consulta.data ?? null;
  const kind = kindEdit ?? conexao?.kind ?? "locadora";
  const webhook = webhookEdit ?? conexao?.partner_webhook_url ?? "";
  const apiUrl = apiUrlEdit ?? conexao?.partner_api_url ?? "";

  const criar = async () => {
    setPendente(true);
    try {
      const res = await fetch("/api/v1/integrations/moope", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          kind,
          partner_webhook_url: webhook.trim() || undefined,
          partner_api_url: apiUrl.trim() || undefined,
        }),
      });
      const json = await res.json();
      const data = unwrap<Conexao>(json);
      qc.setQueryData(["moope-connection"], data);
      setKind(null);
      setWebhook(null);
      setApiUrl(null);
      setSegredos({ inbound: data.inbound_key, outbound: data.outbound_secret });
      toast.success("Conexão criada. Salve a chave e o segredo agora.");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Não criou a conexão.");
    } finally {
      setPendente(false);
    }
  };

  const salvar = async (extra: Record<string, unknown> = {}) => {
    setPendente(true);
    try {
      const res = await fetch("/api/v1/integrations/moope", {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          kind,
          partner_webhook_url: webhook.trim() || "",
          partner_api_url: apiUrl.trim() || "",
          ...extra,
        }),
      });
      const json = await res.json();
      const data = unwrap<Conexao>(json);
      qc.setQueryData(["moope-connection"], data);
      setKind(null);
      setWebhook(null);
      setApiUrl(null);
      if (data.inbound_key || data.outbound_secret) {
        setSegredos({
          inbound: data.inbound_key ?? segredos?.inbound,
          outbound: data.outbound_secret ?? segredos?.outbound,
        });
        toast.success("Segredo novo gerado. Salve agora — não aparece de novo.");
      } else {
        toast.success("Conexão atualizada.");
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Não salvou.");
    } finally {
      setPendente(false);
    }
  };

  if (consulta.isLoading) {
    return <p className="text-sm text-muted-foreground">Carregando…</p>;
  }

  return (
    <Tabs value={aba} onValueChange={setAba} className="space-y-4">
      <TabsList>
        <TabsTrigger value="conexao">Conexão</TabsTrigger>
        <TabsTrigger value={ABA_COMO_USAR} data-testid="aba-como-usar">
          Como ligar e perguntar
        </TabsTrigger>
      </TabsList>
      <TabsContent value="conexao" className="space-y-4">
      {segredos?.inbound || segredos?.outbound ? (
        <Card className="border-amber-500/40">
          <CardHeader>
            <CardTitle>Mostre isto uma vez</CardTitle>
            <CardDescription>
              A chave de entrada é o token. Cole no Facejus (Integrações) ou na
              locadora. Com ela o outro sistema lê o escritório inteiro. Quem
              vê a tela é permissão de lá, não um usuário daqui. O segredo de
              saída só serve para conferir o que o CRM manda de volta. Depois
              some da tela.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3 text-sm">
            {segredos.inbound ? (
              <Segredo rotulo="Chave de entrada" valor={segredos.inbound} />
            ) : null}
            {segredos.outbound ? (
              <Segredo rotulo="Segredo de saída (HMAC)" valor={segredos.outbound} />
            ) : null}
          </CardContent>
        </Card>
      ) : null}

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            {conexao ? "Conectado" : "Ainda sem conexão"}
            {conexao ? <Badge variant="secondary">{conexao.status}</Badge> : null}
          </CardTitle>
          <CardDescription>
            Locadora não cola endereço aqui. Na gestão, aba Atendimento, o
            Ligar agora manda o endereço, a chave e o segredo. Se a empresa já
            existe, use o e-mail de quem já é membro. O passo a passo dos dois
            casos está na outra aba.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {kind === "locadora" ? <ConferenciaDaFrota conexao={conexao} /> : null}

          <div className="space-y-2">
            <Label htmlFor="kind">Tipo do parceiro</Label>
            <select
              id="kind"
              className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 text-sm"
              value={kind}
              onChange={(e) => setKind(e.target.value as Kind)}
            >
              <option value="locadora">Locadora (frota)</option>
              <option value="juridico">Jurídico (Facejus)</option>
            </select>
          </div>

          {kind === "juridico" ? (
            <CampoWebhook webhook={webhook} onChange={setWebhook} />
          ) : null}

          {conexao?.agente && kind === "locadora" ? (
            <p className="text-sm text-muted-foreground">
              Agente Atendimento locadora:{" "}
              <span className="font-medium text-foreground">
                {conexao.agente.status === "published"
                  ? "publicado"
                  : conexao.agente.status === "draft"
                    ? "rascunho"
                    : "ainda não criado"}
              </span>
              {conexao.agente.motivo === "no_channel" || conexao.agente.motivo === "sem_chave"
                ? " — falta canal ou chave de IA; o inbox humano segue igual."
                : null}
              {conexao.agente.motivo === "canal_ocupado"
                ? " — outro agente já atende neste número; este ficou rascunho."
                : null}
            </p>
          ) : null}

          <p className="text-xs text-muted-foreground">
            A chave mop_ só aparece ao criar ou ao girar, e some em seguida.
            Na frota ela nem passa por esta tela: o Ligar agora grava os dois lados.
          </p>
          <div className="flex flex-wrap gap-2">
            <Button type="button" variant="secondary" onClick={() => setAba(ABA_COMO_USAR)}>
              Ver exemplos de pergunta
            </Button>
            {kind === "locadora" && !conexao ? null : conexao ? (
              <>
                <Button disabled={pendente} onClick={() => void salvar()}>
                  Salvar
                </Button>
                <Button
                  variant="outline"
                  disabled={pendente}
                  onClick={() => void salvar({ rotate_inbound: true })}
                >
                  Nova chave de entrada
                </Button>
                <Button
                  variant="outline"
                  disabled={pendente}
                  onClick={() => void salvar({ rotate_outbound: true })}
                >
                  Novo segredo de saída
                </Button>
                <Button
                  variant="ghost"
                  disabled={pendente}
                  onClick={() =>
                    void salvar({
                      status: conexao.status === "active" ? "disabled" : "active",
                    })
                  }
                >
                  {conexao.status === "active" ? "Desligar" : "Ligar"}
                </Button>
              </>
            ) : (
              <Button disabled={pendente} onClick={() => void criar()}>
                Criar conexão
              </Button>
            )}
          </div>
          {kind === "locadora" ? (
            <details className="rounded-md border border-border px-3 py-2 text-sm">
              <summary className="cursor-pointer text-muted-foreground">
                Ajuste manual — só se o suporte pedir
              </summary>
              <div className="mt-3 space-y-3">
                <CampoWebhook webhook={webhook} onChange={setWebhook} />
                <div className="space-y-2">
                  <Label htmlFor="api-url">URL da API da locadora</Label>
                  <Input
                    id="api-url"
                    placeholder="https://frotas.moope.com.br"
                    value={apiUrl}
                    onChange={(e) => setApiUrl(e.target.value)}
                  />
                </div>
                <Button disabled={pendente} variant="outline" onClick={() => void (conexao ? salvar() : criar())}>
                  {conexao ? "Salvar endereço" : "Criar conexão"}
                </Button>
              </div>
            </details>
          ) : null}
        </CardContent>
      </Card>
      </TabsContent>
      <TabsContent value={ABA_COMO_USAR}>
        <GuiaIntegracaoMoope />
      </TabsContent>
    </Tabs>
  );
}

function ConferenciaDaFrota({ conexao }: { conexao: Conexao | null }) {
  if (!conexao) {
    return (
      <div className="space-y-2 rounded-lg border border-amber-500/40 bg-amber-500/10 p-3 text-sm" data-testid="frota-sem-ligacao">
        <p className="font-medium text-amber-950 dark:text-amber-100">Ainda não chegou da locadora</p>
        <p className="leading-relaxed text-amber-950/80 dark:text-amber-100/80">
          Não cole webhook nem endereço aqui. Na locadora, abra Empresa → Integração CRM,
          aba Atendimento, e clique em Ligar agora. O endereço da sua frota, a chave e o
          segredo entram sozinhos nos dois lados.
        </p>
        <p className="text-xs leading-relaxed text-amber-950/80 dark:text-amber-100/80">
          O e-mail pedido lá é o desta sessão — o mesmo do canto superior direito, com o
          nome da empresa embaixo. Não é o login da locadora.
        </p>
      </div>
    );
  }
  const leitura = enderecoDeLeitura(conexao);
  return (
    <div className="space-y-2 rounded-lg border border-emerald-500/40 bg-emerald-500/10 p-3 text-sm" data-testid="frota-origem">
      <p className="font-medium">O atendimento lê a frota neste endereço</p>
      {leitura.base ? (
        <code className="block break-all rounded bg-background px-2 py-1 text-xs">{leitura.base}</code>
      ) : (
        <p>A locadora ligou sem endereço. Volte na aba Atendimento e clique Ligar agora de novo.</p>
      )}
      <p className="text-xs leading-relaxed text-muted-foreground">
        {leitura.veioDe === "api"
          ? "Este endereço veio do Ligar agora. Cadastro, oferta e boleto saem daqui. O webhook não se preenche nesta tela."
          : leitura.veioDe === "webhook"
            ? "A locadora não mandou a URL da API. O CRM está usando o domínio do aviso de volta. Confira se é a frota certa."
            : "Sem este endereço o bot não consulta carro, boleto nem cadastro."}
      </p>
    </div>
  );
}

function CampoWebhook({ webhook, onChange }: { webhook: string; onChange: (v: string) => void }) {
  return (
    <div className="space-y-2">
      <Label htmlFor="webhook">Webhook do parceiro (avisos que o CRM manda de volta)</Label>
      <Input
        id="webhook"
        placeholder="https://frotas.moope.com.br/api/crm/events"
        value={webhook}
        onChange={(e) => onChange(e.target.value)}
      />
      <p className="text-xs text-muted-foreground">
        Não é daqui que sai o preço do carro. É só o aviso de conversa aberta e card movido.
        Vazio, esses avisos não saem e a consulta continua.
      </p>
    </div>
  );
}

function Segredo({ rotulo, valor }: { rotulo: string; valor: string }) {
  return (
    <div className="space-y-1">
      <p className="font-medium">{rotulo}</p>
      <div className="flex gap-2">
        <code className="flex-1 break-all rounded bg-muted px-2 py-1 text-xs">{valor}</code>
        <Button
          type="button"
          size="sm"
          variant="outline"
          onClick={() => {
            void copyToClipboard(valor);
            toast.success("Copiado.");
          }}
        >
          Copiar
        </Button>
      </div>
    </div>
  );
}
