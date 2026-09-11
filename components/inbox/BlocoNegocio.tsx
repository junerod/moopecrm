"use client";

import Link from "next/link";
import { useState } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { NewLeadDialog } from "@/components/kanban/NewLeadDialog";
import { apiClient } from "@/lib/api/client";
import type {
  CrmSummaryData,
  LeadFicha,
  PipelineUtilizavel,
} from "@/lib/inbox/crm-summary-tipos";
import { SEM_NOME } from "@/lib/contacts/rotulo-do-contato";
import { rotuloDaOrigem } from "@/lib/crm/origem-comercial";
import type { Stage } from "@/lib/kanban/types";
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

function isoParaCampos(iso: string | null): { data: string; hora: string } {
  if (!iso) return { data: "", hora: "" };
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return { data: "", hora: "" };
  const pad = (n: number) => String(n).padStart(2, "0");
  return {
    data: `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`,
    hora: `${pad(d.getHours())}:${pad(d.getMinutes())}`,
  };
}

function camposParaIso(data: string, hora: string): string | null {
  if (!data || !hora) return null;
  const d = new Date(`${data}T${hora}`);
  if (Number.isNaN(d.getTime())) return null;
  return d.toISOString();
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

  const passoInicial = isoParaCampos(proximo_passo_comercial?.proximo_passo_em ?? null);
  const [passoTexto, setPassoTexto] = useState(proximo_passo_comercial?.proximo_passo ?? "");
  const [passoData, setPassoData] = useState(passoInicial.data);
  const [passoHora, setPassoHora] = useState(passoInicial.hora);
  const [salvandoPasso, setSalvandoPasso] = useState(false);

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

  async function salvarPasso() {
    const texto = passoTexto.trim();
    if (texto.length < 3) return;
    setSalvandoPasso(true);
    try {
      const quando = camposParaIso(passoData, passoHora);
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
      onAtualizou();
    } catch {
      toast.error("Não consegui salvar o próximo passo. Tente de novo.");
    } finally {
      setSalvandoPasso(false);
    }
  }

  const etapasDoLead = leadUnico
    ? (pipelines_utilizaveis.find((p) => p.id === leadUnico.pipeline?.id)?.etapas ?? [])
    : [];

  return (
    <section data-testid="inbox-ficha-negocio">
      <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
        Negócio
      </h3>
      <Card className="mt-2 space-y-3 p-3 text-sm">
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
              <div className="text-[11px] uppercase tracking-wide text-muted-foreground">Funil</div>
              <p className="min-w-0 truncate" data-testid="inbox-negocio-funil">
                {leadUnico.pipeline?.name ?? "Funil"}
              </p>
            </div>
            <label className="block min-w-0 text-xs">
              <span className="text-muted-foreground">Etapa</span>
              <select
                data-testid="inbox-negocio-etapa"
                disabled={movendo || etapasDoLead.length === 0}
                className="mt-0.5 w-full min-w-0 rounded-md border border-input bg-background px-2 py-1.5 text-xs"
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
            <div>
              <div className="text-[11px] uppercase tracking-wide text-muted-foreground">
                Responsável
              </div>
              <p className="text-xs" data-testid="inbox-negocio-responsavel">
                {leadUnico.owner.display_name ??
                  (leadUnico.owner.agent_id
                    ? "Assistente"
                    : leadUnico.owner.user_id
                      ? "Atendente"
                      : "Sem responsável")}
              </p>
            </div>
            {rotuloOrigem(leadUnico.source) ? (
              <p className="text-xs text-muted-foreground">
                Origem: {rotuloOrigem(leadUnico.source)}
              </p>
            ) : null}
            <Button asChild size="sm" variant="outline" className="h-8 w-full text-xs">
              <Link href={`/app/leads/${leadUnico.id}`} data-testid="inbox-abrir-no-quadro">
                Abrir no quadro
              </Link>
            </Button>
          </div>
        ) : null}

        <div className="space-y-1.5 border-t border-border pt-2" data-testid="inbox-proximo-passo">
          <div className="text-[11px] uppercase tracking-wide text-muted-foreground">
            Próximo passo
          </div>
          <input
            data-testid="inbox-proximo-passo-texto"
            value={passoTexto}
            onChange={(e) => setPassoTexto(e.target.value)}
            maxLength={500}
            placeholder="Ligar para confirmar proposta"
            className="w-full min-w-0 rounded-md border border-input bg-background px-2 py-1.5 text-xs"
          />
          <div className="grid grid-cols-2 gap-1.5">
            <input
              type="date"
              data-testid="inbox-proximo-passo-data"
              value={passoData}
              onChange={(e) => setPassoData(e.target.value)}
              className="min-w-0 rounded-md border border-input bg-background px-2 py-1.5 text-xs"
            />
            <input
              type="time"
              data-testid="inbox-proximo-passo-hora"
              value={passoHora}
              onChange={(e) => setPassoHora(e.target.value)}
              className="min-w-0 rounded-md border border-input bg-background px-2 py-1.5 text-xs"
            />
          </div>
          <Button
            size="sm"
            variant="secondary"
            className="h-8 w-full text-xs"
            disabled={salvandoPasso || passoTexto.trim().length < 3}
            data-testid="inbox-salvar-proximo-passo"
            onClick={() => void salvarPasso()}
          >
            {salvandoPasso ? "Salvando…" : "Salvar próximo passo"}
          </Button>
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
      </Card>

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
