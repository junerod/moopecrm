"use client";

import Link from "next/link";
import { useState } from "react";
import { toast } from "sonner";

import { ProximaAcaoControles } from "@/components/comercial/ProximaAcaoControles";
import { Button } from "@/components/ui/button";
import { NewLeadDialog } from "@/components/kanban/NewLeadDialog";
import { apiClient } from "@/lib/api/client";
import { estadoDaProximaAcao, rotuloDoAtraso, rotuloDoQuando } from "@/lib/comercial/proxima-acao";
import type {
  CrmSummaryData,
  LeadFicha,
  PipelineUtilizavel,
} from "@/lib/inbox/crm-summary-tipos";
import { SEM_NOME } from "@/lib/contacts/rotulo-do-contato";
import {
  ROTULO_DA_TEMPERATURA,
  TEMPERATURAS_DO_LEAD,
  ehTemperaturaDoLead,
  type TemperaturaDoLead,
} from "@/lib/crm/papel-e-temperatura";
import { rotuloDaOrigem } from "@/lib/crm/origem-comercial";
import type { Stage } from "@/lib/kanban/types";
import { CLASSE_DOT_TEMPERATURA, CLASSE_TEXTO_TEMPERATURA } from "@/lib/crm/temperatura-visual";
import { cn } from "@/lib/utils";

interface Props {
  contactId: string;
  conversationId: string;
  contactName: string;
  summary: CrmSummaryData;
  onAtualizou: () => void;
}

function rotuloOrigem(source: string | null): string | null {
  if (!source) return null;
  const rotulo = rotuloDaOrigem(source);
  return rotulo === "—" ? source : rotulo;
}

function etapasComoStage(funil: PipelineUtilizavel | undefined): Stage[] {
  return (funil?.etapas ?? []).map((e, i) => ({
    id: e.id,
    organization_id: "",
    pipeline_id: e.pipeline_id,
    name: e.name,
    slug: e.name,
    position: i * 1000,
    color: null,
    is_won: e.is_won,
    is_lost: e.is_lost,
    is_archived: false,
    expected_duration_hours: null,
  }));
}

function LeadResumo({ lead, className }: { lead: LeadFicha; className?: string }) {
  return (
    <div className={cn("min-w-0", className)}>
      <div className="truncate font-medium">{lead.title}</div>
      <div className="text-muted-foreground">
        {lead.stage?.name ?? "Sem etapa"} · {lead.status}
      </div>
    </div>
  );
}

export function BlocoNegocio({
  contactId,
  conversationId,
  contactName,
  summary,
  onAtualizou,
}: Props) {
  const { negocio, pipelines_utilizaveis, proximo_passo_comercial } = summary;
  const umFunil = pipelines_utilizaveis.length <= 1;
  const leadUnico =
    negocio.resolucao === "unico" ? (negocio.leads_abertos[0] ?? null) : null;

  const [funilNovo, setFunilNovo] = useState(
    () => pipelines_utilizaveis.find((p) => p.is_default)?.id ?? pipelines_utilizaveis[0]?.id ?? "",
  );
  const [etapaNova, setEtapaNova] = useState("");
  const [criando, setCriando] = useState(false);
  const [movendo, setMovendo] = useState(false);
  const [outraOpen, setOutraOpen] = useState(false);

  const [salvandoPasso, setSalvandoPasso] = useState(false);
  const [concluindoPasso, setConcluindoPasso] = useState(false);
  const [salvandoTemp, setSalvandoTemp] = useState(false);
  const [editandoPasso, setEditandoPasso] = useState(false);
  const [editandoTemp, setEditandoTemp] = useState(false);

  const funilEscolhido = pipelines_utilizaveis.find((p) => p.id === funilNovo);
  const etapasNovas = funilEscolhido?.etapas ?? [];
  const etapaInicialId = etapaNova || etapasNovas[0]?.id || "";

  const stagesOutra = etapasComoStage(funilEscolhido ?? pipelines_utilizaveis[0]);

  async function adicionarAoFunil() {
    const pipeline = funilEscolhido ?? pipelines_utilizaveis[0];
    const stageId = etapaInicialId;
    if (!pipeline || !stageId) {
      toast.error("Nenhum funil configurado nesta organização.");
      return;
    }
    setCriando(true);
    try {
      const titulo =
        contactName && contactName !== SEM_NOME ? contactName : "Negócio pelo WhatsApp";
      await apiClient.post("/api/v1/leads", {
        pipeline_id: pipeline.id,
        stage_id: stageId,
        title: titulo.slice(0, 200),
        contact_id: contactId,
        source: "whatsapp",
        reuse_open_if_exists: true,
      });
      onAtualizou();
    } catch {
      toast.error("Não consegui adicionar ao funil. Tente de novo.");
    } finally {
      setCriando(false);
    }
  }

  async function gravarTemperatura(proxima: TemperaturaDoLead) {
    if (!leadUnico) return;
    const valor = leadUnico.temperatura === proxima ? null : proxima;
    setSalvandoTemp(true);
    try {
      await apiClient.patch(`/api/v1/leads/${leadUnico.id}`, { temperatura: valor });
      onAtualizou();
    } catch {
      toast.error("Não consegui gravar a temperatura. Tente de novo.");
    } finally {
      setSalvandoTemp(false);
    }
  }

  async function moverEtapa(stageId: string) {
    if (!leadUnico || stageId === leadUnico.stage?.id) return;
    setMovendo(true);
    try {
      await apiClient.post(`/api/v1/leads/${leadUnico.id}/move`, {
        stage_id: stageId,
        position_in_stage: 1_000_000,
        expected_updated_at: leadUnico.updated_at,
      });
      onAtualizou();
    } catch {
      toast.error("Não consegui mover a etapa. Recarregue e tente de novo.");
    } finally {
      setMovendo(false);
    }
  }

  async function salvarPasso(texto: string, quando: string | null) {
    if (texto.length < 3) return;
    setSalvandoPasso(true);
    try {
      if (proximo_passo_comercial?.demanda_id) {
        await apiClient.patch(`/api/v1/demandas/${proximo_passo_comercial.demanda_id}`, {
          proximo_passo: texto,
          proximo_passo_em: quando,
        });
      } else {
        await apiClient.post("/api/v1/demandas", {
          contact_id: contactId,
          conversation_id: conversationId,
          lead_id: leadUnico?.id ?? negocio.leads_abertos[0]?.id ?? null,
          proximo_passo: texto,
          proximo_passo_em: quando,
        });
      }
      setEditandoPasso(false);
      onAtualizou();
    } catch {
      toast.error("Não consegui salvar o próximo passo. Tente de novo.");
    } finally {
      setSalvandoPasso(false);
    }
  }

  async function concluirPasso() {
    if (!proximo_passo_comercial?.demanda_id) return;
    setConcluindoPasso(true);
    try {
      await apiClient.post(`/api/v1/demandas/${proximo_passo_comercial.demanda_id}/concluir`, {});
      toast.success("Próxima ação concluída.");
      onAtualizou();
    } catch {
      toast.error("Não consegui concluir. Tente de novo.");
    } finally {
      setConcluindoPasso(false);
    }
  }

  const etapasDoLead = leadUnico
    ? (pipelines_utilizaveis.find((p) => p.id === leadUnico.pipeline?.id)?.etapas ?? [])
    : [];

  return (
    <section data-testid="inbox-ficha-negocio">
      <h3 className="text-xs font-medium text-muted-foreground">Negócio</h3>
      <div className="mt-2 space-y-3 text-sm">
        {negocio.resolucao === "nenhum" ? (
          <div className="space-y-2">
            <p className="text-xs text-muted-foreground">Nenhuma oportunidade aberta.</p>
            {!umFunil ? (
              <label className="block min-w-0 text-xs">
                <span className="text-muted-foreground">Funil</span>
                <select
                  data-testid="inbox-funil-novo"
                  className="mt-0.5 w-full min-w-0 rounded-md border border-input bg-background px-2 py-1.5 text-xs"
                  value={funilNovo}
                  onChange={(e) => {
                    setFunilNovo(e.target.value);
                    setEtapaNova("");
                  }}
                >
                  {pipelines_utilizaveis.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name}
                    </option>
                  ))}
                </select>
              </label>
            ) : pipelines_utilizaveis[0] ? (
              <p className="text-xs" data-testid="inbox-negocio-funil">
                {pipelines_utilizaveis[0].name}
              </p>
            ) : null}
            {etapasNovas.length > 0 ? (
              <label className="block min-w-0 text-xs">
                <span className="text-muted-foreground">Etapa inicial</span>
                <select
                  data-testid="inbox-etapa-nova"
                  className="mt-0.5 w-full min-w-0 rounded-md border border-input bg-background px-2 py-1.5 text-xs"
                  value={etapaInicialId}
                  onChange={(e) => setEtapaNova(e.target.value)}
                >
                  {etapasNovas.map((e) => (
                    <option key={e.id} value={e.id}>
                      {e.name}
                    </option>
                  ))}
                </select>
              </label>
            ) : null}
            <Button
              size="sm"
              className="h-8 w-full text-xs"
              disabled={criando || pipelines_utilizaveis.length === 0}
              data-testid="inbox-adicionar-ao-funil"
              onClick={() => void adicionarAoFunil()}
            >
              {criando ? "Adicionando…" : "Adicionar ao funil"}
            </Button>
          </div>
        ) : null}

        {negocio.resolucao === "varios" ? (
          <div className="space-y-2" data-testid="inbox-negocios-varios">
            <p className="text-xs text-muted-foreground">
              Há mais de uma oportunidade aberta. Escolha qual abrir.
            </p>
            <ul className="space-y-1.5">
              {negocio.leads_abertos.map((l) => (
                <li key={l.id}>
                  <Link
                    href={`/app/leads/${l.id}`}
                    className="flex items-center justify-between gap-2 rounded-md border border-border p-2 text-xs hover:bg-muted/40"
                    data-testid="inbox-lead-aberto"
                  >
                    <LeadResumo lead={l} />
                    <span className="shrink-0 text-muted-foreground">Abrir</span>
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        ) : null}

        {leadUnico ? (
          <div className="space-y-2" data-testid="inbox-negocio-unico">
            <div>
              <div className="text-xs text-muted-foreground">Funil</div>
              <p className="min-w-0 truncate text-sm" data-testid="inbox-negocio-funil">
                {leadUnico.pipeline?.name ?? "Funil"}
              </p>
            </div>
            <label className="block min-w-0">
              <span className="sr-only">Etapa</span>
              <select
                data-testid="inbox-negocio-etapa"
                disabled={movendo || etapasDoLead.length === 0}
                className="w-full min-w-0 appearance-none border-0 bg-transparent py-0.5 text-base font-semibold focus:outline-none focus:ring-0"
                value={leadUnico.stage?.id ?? ""}
                onChange={(e) => void moverEtapa(e.target.value)}
              >
                {etapasDoLead.map((e) => (
                  <option key={e.id} value={e.id}>
                    {e.name}
                  </option>
                ))}
              </select>
            </label>
            <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-sm">
              <p data-testid="inbox-negocio-responsavel">
                {leadUnico.owner.display_name ??
                  (leadUnico.owner.agent_id
                    ? "Assistente"
                    : leadUnico.owner.user_id
                      ? "Atendente"
                      : "Sem responsável")}
              </p>
              {rotuloOrigem(leadUnico.source) ? (
                <span className="text-muted-foreground">· {rotuloOrigem(leadUnico.source)}</span>
              ) : null}
              <button
                type="button"
                className="inline-flex items-center gap-1.5 text-sm"
                onClick={() => setEditandoTemp((v) => !v)}
              >
                {ehTemperaturaDoLead(leadUnico.temperatura) ? (
                  <>
                    <span
                      className={cn(
                        "h-1.5 w-1.5 rounded-full",
                        CLASSE_DOT_TEMPERATURA[leadUnico.temperatura],
                      )}
                      aria-hidden
                    />
                    <span className={CLASSE_TEXTO_TEMPERATURA[leadUnico.temperatura]}>
                      {ROTULO_DA_TEMPERATURA[leadUnico.temperatura].replace("Lead ", "")}
                    </span>
                  </>
                ) : (
                  <span className="text-muted-foreground">Temperatura</span>
                )}
              </button>
            </div>
            <div
              className={cn(!editandoTemp && "sr-only")}
              data-testid="chips-temperatura"
            >
              <div className="flex flex-wrap gap-1">
                {TEMPERATURAS_DO_LEAD.map((t) => {
                  const ativo = leadUnico.temperatura === t;
                  return (
                    <Button
                      key={t}
                      type="button"
                      size="sm"
                      variant={ativo ? "default" : "ghost"}
                      className="h-7 px-2 text-xs"
                      disabled={salvandoTemp}
                      aria-pressed={ativo}
                      data-testid={`chip-temperatura-${t}`}
                      onClick={() => void gravarTemperatura(t)}
                    >
                      {ROTULO_DA_TEMPERATURA[t].replace("Lead ", "")}
                    </Button>
                  );
                })}
              </div>
            </div>
            <Button asChild size="sm" variant="ghost" className="h-8 w-full text-xs">
              <Link href={`/app/leads/${leadUnico.id}`} data-testid="inbox-abrir-no-quadro">
                Abrir no funil
              </Link>
            </Button>
          </div>
        ) : null}

        <div className="space-y-1.5 border-t border-border/70 pt-3" data-testid="inbox-proximo-passo">
          <div className="text-xs text-muted-foreground">Próxima ação</div>
          {!editandoPasso && proximo_passo_comercial?.proximo_passo ? (
            <div className="space-y-1">
              <p className="text-sm font-medium">{proximo_passo_comercial.proximo_passo}</p>
              {(() => {
                const estado = estadoDaProximaAcao({
                  texto: proximo_passo_comercial.proximo_passo,
                  em: proximo_passo_comercial.proximo_passo_em,
                });
                const atraso = rotuloDoAtraso(proximo_passo_comercial.proximo_passo_em);
                const quando = rotuloDoQuando(proximo_passo_comercial.proximo_passo_em);
                return (
                  <p
                    className={cn(
                      "text-xs",
                      estado === "atrasada" ? "text-destructive" : "text-muted-foreground",
                    )}
                    data-testid={estado === "atrasada" ? "inbox-acao-atrasada" : "inbox-acao-quando"}
                  >
                    {atraso ?? quando ?? "Sem hora marcada"}
                  </p>
                );
              })()}
              <div className="flex flex-wrap gap-1">
                <Button
                  type="button"
                  size="sm"
                  variant="ghost"
                  className="h-8 px-2 text-xs"
                  data-testid="inbox-editar-proximo-passo"
                  onClick={() => setEditandoPasso(true)}
                >
                  Editar
                </Button>
                <Button
                  type="button"
                  size="sm"
                  variant="ghost"
                  className="h-8 px-2 text-xs"
                  disabled={concluindoPasso}
                  data-testid="inbox-concluir-proximo-passo"
                  onClick={() => void concluirPasso()}
                >
                  {concluindoPasso ? "Concluindo…" : "Concluir"}
                </Button>
              </div>
            </div>
          ) : !editandoPasso ? (
            <div className="space-y-1">
              <p className="text-sm text-muted-foreground" data-testid="inbox-sem-proxima-acao">
                Sem próxima ação
              </p>
              <Button
                type="button"
                size="sm"
                variant="ghost"
                className="h-8 px-0 text-sm"
                data-testid="inbox-definir-proximo-passo"
                onClick={() => setEditandoPasso(true)}
              >
                Definir
              </Button>
            </div>
          ) : (
            <ProximaAcaoControles
              textoInicial={proximo_passo_comercial?.proximo_passo ?? ""}
              emInicial={proximo_passo_comercial?.proximo_passo_em ?? null}
              salvando={salvandoPasso}
              onSalvar={salvarPasso}
              onCancelar={() => setEditandoPasso(false)}
            />
          )}
        </div>

        <details className="text-xs">
          <summary className="cursor-pointer text-muted-foreground">Mais opções</summary>
          <div className="mt-2 space-y-2">
            <Button
              size="sm"
              variant="ghost"
              className="h-7 w-full text-xs"
              data-testid="inbox-criar-outra-oportunidade"
              onClick={() => setOutraOpen(true)}
            >
              Criar outra oportunidade
            </Button>
          </div>
        </details>
      </div>

      {pipelines_utilizaveis[0] || funilEscolhido ? (
        <NewLeadDialog
          open={outraOpen}
          onOpenChange={(v) => {
            setOutraOpen(v);
            if (!v) onAtualizou();
          }}
          pipelineId={(funilEscolhido ?? pipelines_utilizaveis[0])!.id}
          stages={stagesOutra}
          contactId={contactId}
        />
      ) : null}
    </section>
  );
}
