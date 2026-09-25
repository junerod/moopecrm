"use client";
import { useCallback, useMemo, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { DragDropContext, type DropResult } from "@hello-pangea/dnd";
import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { useBoard } from "@/hooks/kanban/useBoard";
import { useMoveCard } from "@/hooks/kanban/useMoveCard";
import { useBoardScroll } from "@/hooks/kanban/useBoardScroll";
import { useAssignableMembers } from "@/hooks/inbox/useAssignableMembers";
import { useAtRiskLeads } from "@/hooks/leads/useAtRiskLeads";
import { useReactivations } from "@/hooks/leads/useReactivations";
import { midpoint } from "@/lib/kanban/fractional-indexing";
import type { Lead } from "@/lib/types/leads";
import type { Pipeline, Stage } from "@/lib/kanban/types";
import { ProximaAcaoControles } from "@/components/comercial/ProximaAcaoControles";
import { apiClient } from "@/lib/api/client";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { CaretLeft, CaretRight } from "@/lib/ui/icons";
import { cn } from "@/lib/utils";
import { StageColumn } from "./StageColumn";
import { StageFocusView } from "./StageFocusView";
import { LeadDossier } from "./LeadDossier";

interface KanbanBoardProps {
  pipelineId: string;
  /** Optional override: if provided, skips internal useBoard fetch. */
  stages?: Stage[];
  leads?: Lead[];
  pipeline?: Pipeline;
  selectedIds?: string[];
  /**
   * Ids que chegaram por evento remoto, quando o board recebe os dados de fora.
   *
   * Quem assina o realtime é quem chama `useBoard` com o pipeline — e nesta
   * página é o _client, não este componente (aqui `useBoard(null)` fica
   * desligado por causa do `useExternal`). Sem esta prop o pulso nasce no lugar
   * certo e morre na fronteira: o dado vem por prop e o sinal ficava para trás.
   */
  pulses?: Map<string, number>;
  onSelectionChange?: (ids: string[]) => void;
  /** Lead a abrir já na montagem (deep link `?lead=` — ver o dossiê abaixo). */
  leadInicial?: string | null;
  /** Funis irmãos da org — «Enviar para funil…» no card. */
  funis?: Array<{ id: string; name: string }>;
}

function groupLeadsByStage(stages: Stage[], leads: Lead[]): Map<string, Lead[]> {
  const map = new Map<string, Lead[]>();
  for (const stage of stages) map.set(stage.id, []);
  for (const lead of leads) {
    const bucket = map.get(lead.stage_id);
    if (bucket) bucket.push(lead);
  }
  for (const list of map.values()) {
    list.sort((a, b) => a.position_in_stage - b.position_in_stage);
  }
  return map;
}

function BoardSkeleton() {
  return (
    <div className="flex min-h-0 flex-1 gap-3 overflow-x-auto p-4">
      {[0, 1, 2].map((c) => (
        <div
          key={c}
          className="flex w-80 shrink-0 flex-col gap-2 rounded-lg border border-border bg-surface-muted/40 p-3"
        >
          <Skeleton className="h-5 w-32" />
          {[0, 1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-24 w-full animate-pulse" />
          ))}
        </div>
      ))}
    </div>
  );
}

export function KanbanBoard({
  pipelineId,
  stages: stagesProp,
  leads: leadsProp,
  pipeline: pipelineProp,
  selectedIds,
  pulses: pulsesProp,
  onSelectionChange,
  leadInicial,
  funis = [],
}: KanbanBoardProps) {
  const useExternal = stagesProp !== undefined && leadsProp !== undefined;
  const queryResult = useBoard(useExternal ? null : pipelineId);
  const moveCard = useMoveCard(pipelineId);
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const { data: members } = useAssignableMembers(true);
  const ownerNames = useMemo(
    () => new Map((members ?? []).map((m) => [m.user_id, m.full_name])),
    [members],
  );
  const { data: atRisk } = useAtRiskLeads();
  const { data: propostasVivas } = useReactivations();
  const reactivations = useMemo(() => {
    const m = new Map<string, { proposalId: string; expiresAt: string }>();
    for (const p of propostasVivas ?? []) {
      m.set(p.lead_id, { proposalId: p.proposal_id, expiresAt: p.expires_at });
    }
    return m;
  }, [propostasVivas]);
  const coolingIds = useMemo(() => {
    const ids = new Set<string>();
    for (const item of atRisk?.items ?? []) {
      if (item.pipeline_id !== pipelineId) continue;
      if (item.risk === "em_risco" || item.risk === "critico") ids.add(item.id);
    }
    return ids;
  }, [atRisk, pipelineId]);
  const canonicalTags = useMemo(() => {
    const raw = (pipelineProp ?? queryResult.data?.pipeline)?.settings?.canonical_tags;
    return Array.isArray(raw) ? raw.filter((t): t is string => typeof t === "string") : [];
  }, [pipelineProp, queryResult.data?.pipeline]);

  const [dossieId, setDossieId] = useState<string | null>(leadInicial ?? null);
  const [internalSelected, setInternalSelected] = useState<Set<string>>(new Set());
  const [promptLead, setPromptLead] = useState<Lead | null>(null);
  const selectedLeadIds = useMemo(
    () => (selectedIds ? new Set(selectedIds) : internalSelected),
    [selectedIds, internalSelected],
  );

  const data = useMemo(() => {
    if (useExternal) {
      return {
        pipeline: pipelineProp ?? ({} as Pipeline),
        stages: stagesProp!,
        leads: leadsProp!,
      };
    }
    return queryResult.data;
  }, [useExternal, pipelineProp, stagesProp, leadsProp, queryResult.data]);

  const isLoading = useExternal ? false : queryResult.isLoading;
  const isError = useExternal ? false : queryResult.isError;
  const error = useExternal ? null : queryResult.error;

  const stageIds = useMemo(() => (data?.stages ?? []).map((s) => s.id), [data?.stages]);
  const { scrollerRef, state: scrollState, scrollByColumns, scrollToStage } =
    useBoardScroll(stageIds);

  const leadDoDossie = dossieId
    ? (data?.leads.find((l) => l.id === dossieId) ?? null)
    : null;

  const grouped = useMemo(() => {
    if (!data) return null;
    return groupLeadsByStage(data.stages, data.leads);
  }, [data]);

  // Deep link `?stage=` é a fonte — sem espelho em state que dispare effect.
  const focusStageId = searchParams.get("stage");
  const focusStage =
    focusStageId && data?.stages
      ? (data.stages.find((s) => s.id === focusStageId) ?? null)
      : null;

  const setStageNaUrl = useCallback(
    (stageId: string | null) => {
      const next = new URLSearchParams(searchParams.toString());
      if (stageId) next.set("stage", stageId);
      else next.delete("stage");
      const qs = next.toString();
      router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
    },
    [router, pathname, searchParams],
  );

  const abrirFoco = useCallback(
    (stageId: string) => {
      setStageNaUrl(stageId);
    },
    [setStageNaUrl],
  );

  const fecharFoco = useCallback(
    (open: boolean) => {
      if (open) return;
      setStageNaUrl(null);
    },
    [setStageNaUrl],
  );
  const handleSelect = useCallback(
    (leadId: string, additive: boolean) => {
      const apply = (prev: Set<string>): Set<string> => {
        const next = new Set(additive ? prev : []);
        if (additive && prev.has(leadId)) {
          next.delete(leadId);
        } else {
          next.add(leadId);
        }
        return next;
      };
      if (onSelectionChange) {
        const nextSet = apply(selectedLeadIds);
        onSelectionChange(Array.from(nextSet));
      } else {
        setInternalSelected((prev) => apply(prev));
      }
    },
    [onSelectionChange, selectedLeadIds],
  );

  const handleDragEnd = useCallback(
    (result: DropResult) => {
      if (!data || !grouped) return;
      const { source, destination, draggableId } = result;
      if (!destination) return;
      if (
        source.droppableId === destination.droppableId &&
        source.index === destination.index
      ) {
        return;
      }

      const lead = data.leads.find((l) => l.id === draggableId);
      if (!lead) return;

      const destStageId = destination.droppableId;
      const destList = (grouped.get(destStageId) ?? []).filter(
        (l) => l.id !== draggableId,
      );

      const before = destination.index > 0 ? destList[destination.index - 1] : null;
      const after =
        destination.index < destList.length ? destList[destination.index] : null;

      const newPosition = midpoint(
        before?.position_in_stage ?? null,
        after?.position_in_stage ?? null,
      );

      if (Number.isNaN(newPosition)) {
        return;
      }

      const destStage = data.stages.find((s) => s.id === destStageId);
      moveCard.mutate(
        {
          leadId: lead.id,
          stageId: destStageId,
          positionInStage: newPosition,
          expectedUpdatedAt: lead.updated_at,
        },
        {
          onSuccess: () => {
            if (
              destStage &&
              !destStage.is_won &&
              !destStage.is_lost &&
              source.droppableId !== destStageId
            ) {
              setPromptLead(lead);
            }
          },
        },
      );
    },
    [data, grouped, moveCard],
  );

  if (isLoading) {
    return <BoardSkeleton />;
  }

  if (isError) {
    return (
      <Card className="m-4 p-6 text-sm text-text-muted">
        Falha ao carregar o board.
        {error instanceof Error ? ` ${error.message}` : null}
      </Card>
    );
  }

  if (!data || !grouped) {
    return null;
  }

  if (data.stages.length === 0) {
    return (
      <Card className="m-4 p-6 text-sm text-text-muted">
        Nenhuma etapa neste funil ainda.
      </Card>
    );
  }

  const pulses = pulsesProp ?? queryResult.pulses;

  return (
    <DragDropContext onDragEnd={handleDragEnd}>
      <div
        className="flex min-h-0 flex-1 flex-col gap-2"
        data-testid="kanban-board-shell"
      >
        {/* Trilho de etapas — orientação espacial quando há muitas colunas. */}
        <div
          className="flex shrink-0 gap-1.5 overflow-x-auto px-1 pb-0.5"
          data-testid="kanban-stage-rail"
          role="tablist"
          aria-label="Etapas do funil"
        >
          {data.stages.map((stage) => {
            const count = grouped.get(stage.id)?.length ?? 0;
            const active = scrollState.activeStageId === stage.id;
            return (
              <button
                key={stage.id}
                type="button"
                role="tab"
                aria-selected={active}
                data-testid={`stage-chip-${stage.id}`}
                onClick={() => scrollToStage(stage.id)}
                onDoubleClick={() => abrirFoco(stage.id)}
                className={cn(
                  "shrink-0 rounded-full px-2.5 py-1 text-[11px] font-medium tabular-nums transition-colors",
                  "ring-1 ring-[var(--color-border)]",
                  active
                    ? "bg-[var(--moope-primary)] text-white ring-[var(--moope-primary)]"
                    : "bg-[var(--color-surface)] text-[var(--color-text-muted)] hover:bg-[var(--color-surface-muted)] hover:text-[var(--color-text)]",
                )}
                title="Clique para ir · duplo clique para tela cheia"
              >
                {stage.name}
                <span className="ml-1 opacity-80">({count})</span>
              </button>
            );
          })}
        </div>

        <div className="relative min-h-0 flex-1">
          {scrollState.canScrollLeft ? (
            <Button
              type="button"
              size="icon"
              variant="outline"
              className="absolute left-1 top-1/2 z-10 h-9 w-9 -translate-y-1/2 rounded-full bg-[var(--color-surface)] shadow-md"
              onClick={() => scrollByColumns(-1)}
              aria-label="Ver etapas à esquerda"
              data-testid="kanban-scroll-left"
            >
              <CaretLeft size={16} weight="bold" />
            </Button>
          ) : null}
          {scrollState.canScrollRight ? (
            <Button
              type="button"
              size="icon"
              variant="outline"
              className="absolute right-1 top-1/2 z-10 h-9 w-9 -translate-y-1/2 rounded-full bg-[var(--color-surface)] shadow-md"
              onClick={() => scrollByColumns(1)}
              aria-label="Ver etapas à direita"
              data-testid="kanban-scroll-right"
            >
              <CaretRight size={16} weight="bold" />
            </Button>
          ) : null}

          <div
            ref={scrollerRef}
            tabIndex={0}
            className="flex h-full min-h-0 gap-3 overflow-x-auto overflow-y-hidden scroll-smooth bg-[var(--color-bg)] px-1 pb-1 outline-none focus-visible:ring-2 focus-visible:ring-[var(--moope-primary)]"
            data-testid="kanban-board-scroller"
          >
            {data.stages.map((stage, i) => (
              <StageColumn
                key={stage.id}
                stage={stage}
                stageIndex={i}
                leads={grouped.get(stage.id) ?? []}
                pipelineId={pipelineId}
                stages={data.stages}
                ownerNames={ownerNames}
                coolingIds={coolingIds}
                reactivations={reactivations}
                pulses={pulses}
                canonicalTags={canonicalTags}
                selectedLeadIds={selectedLeadIds}
                onSelect={handleSelect}
                onOpen={setDossieId}
                onFocusStage={abrirFoco}
                funis={funis}
              />
            ))}
          </div>
        </div>
      </div>

      <StageFocusView
        open={!!focusStage}
        onOpenChange={fecharFoco}
        stage={focusStage}
        leads={focusStage ? (grouped.get(focusStage.id) ?? []) : []}
        pipelineId={pipelineId}
        stages={data.stages}
        ownerNames={ownerNames}
        coolingIds={coolingIds}
        reactivations={reactivations}
        canonicalTags={canonicalTags}
        selectedLeadIds={selectedLeadIds}
        pulses={pulses}
        onSelect={handleSelect}
        onOpenLead={setDossieId}
        funis={funis}
      />

      {leadDoDossie && (
        <LeadDossier
          open
          onOpenChange={(v) => !v && setDossieId(null)}
          lead={leadDoDossie}
          pipelineId={pipelineId}
          pipelineSettings={(pipelineProp ?? data?.pipeline)?.settings}
          stageName={
            data.stages.find((s) => s.id === leadDoDossie.stage_id)?.name ?? "—"
          }
          ownerNames={ownerNames}
        />
      )}
      <Dialog open={!!promptLead} onOpenChange={(v) => !v && setPromptLead(null)}>
        <DialogContent className="sm:max-w-md" data-testid="prompt-proximo-passo">
          <DialogHeader>
            <DialogTitle>Qual é o próximo passo?</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">Opcional — o card já mudou de etapa.</p>
          {promptLead ? (
            <ProximaAcaoControles
              textoInicial={promptLead.proxima_acao?.texto ?? ""}
              emInicial={promptLead.proxima_acao?.em ?? null}
              onSalvar={async (texto, em) => {
                if (!promptLead.contact_id) {
                  setPromptLead(null);
                  return;
                }
                await apiClient.post("/api/v1/demandas", {
                  contact_id: promptLead.contact_id,
                  conversation_id: promptLead.conversa?.id ?? null,
                  lead_id: promptLead.id,
                  proximo_passo: texto,
                  proximo_passo_em: em,
                });
                toast.success("Próxima ação definida.");
                setPromptLead(null);
              }}
              onCancelar={() => setPromptLead(null)}
            />
          ) : null}
          <Button
            type="button"
            variant="ghost"
            className="h-8 text-xs"
            data-testid="prompt-sem-proxima-acao"
            onClick={() => setPromptLead(null)}
          >
            Sem próxima ação
          </Button>
        </DialogContent>
      </Dialog>
    </DragDropContext>
  );
}
