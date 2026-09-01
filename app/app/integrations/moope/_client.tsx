"use client";

import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { copyToClipboard } from "@/lib/clipboard";

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
    <div className="space-y-4">
      {segredos?.inbound || segredos?.outbound ? (
        <Card className="border-amber-500/40">
          <CardHeader>
            <CardTitle>Mostre isto uma vez</CardTitle>
            <CardDescription>
              A chave vai no Authorization do outro sistema. O segredo assina o
              webhook que o CRM manda. Depois some da tela.
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
            O outro produto declara se é locadora ou jurídico. A URL pública
            deste CRM é o domínio desta instalação.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {conexao?.public_url ? (
            <p className="text-sm">
              <span className="font-medium">URL deste CRM:</span>{" "}
              <code className="rounded bg-muted px-1 py-0.5 text-xs">{conexao.public_url}</code>
            </p>
          ) : null}
          {conexao ? (
            <p className="text-sm text-muted-foreground">
              Prefixo da chave: <code>{conexao.inbound_key_prefix}</code>
            </p>
          ) : null}

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

          <div className="space-y-2">
            <Label htmlFor="webhook">Webhook do parceiro (eventos que o CRM manda)</Label>
            <Input
              id="webhook"
              placeholder="https://frota.exemplo/api/crm/events"
              value={webhook}
              onChange={(e) => setWebhook(e.target.value)}
            />
          </div>

          {kind === "locadora" ? (
            <div className="space-y-2">
              <Label htmlFor="api-url">URL da API da locadora</Label>
              <Input
                id="api-url"
                placeholder="https://frota.exemplo"
                value={apiUrl}
                onChange={(e) => setApiUrl(e.target.value)}
              />
              <p className="text-xs text-muted-foreground">
                De onde o atendimento lê cadastro e o link do boleto. Se ficar
                vazio, usa o domínio do webhook. Sem isto o agente não consulta
                a locadora.
              </p>
            </div>
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

          <div className="flex flex-wrap gap-2">
            {conexao ? (
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
        </CardContent>
      </Card>
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
