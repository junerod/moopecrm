"use client";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
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
import { chipNoPonto } from "@/lib/kanban/board-scroll";
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
  /** Etapa de origem do card em arrasto; null fora do arrasto. */
  const [arrastando, setArrastando] = useState<string | null>(null);
  /** Etapa do chip sob o ponteiro durante o arrasto (já sem a de origem). */
  const [chipSobArrasto, setChipSobArrasto] = useState<string | null>(null);
  const chipSobArrastoRef = useRef<string | null>(null);
  const trilhoRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!arrastando) return;
    const trilho = trilhoRef.current;
    if (!trilho) return;
    // No celular o trilho transborda: segurar o dedo na borda dele rola para
    // alcançar o chip que está fora da tela.
    let direcaoDaBorda = 0;
    let ultimo: { x: number; y: number } | null = null;
    const marcarChip = (x: number, y: number) => {
      const chips = Array.from(trilho.querySelectorAll<HTMLElement>("[data-stage-chip]")).map(
        (el) => {
          const r = el.getBoundingClientRect();
          return { id: el.dataset.stageChip ?? "", left: r.left, right: r.right, top: r.top, bottom: r.bottom };
        },
      );
      const achado = chipNoPonto(chips, x, y);
      const valido = achado && achado !== arrastando ? achado : null;
      if (chipSobArrastoRef.current === valido) return;
      chipSobArrastoRef.current = valido;
      setChipSobArrasto(valido);
    };
    const rolagem = window.setInterval(() => {
      if (direcaoDaBorda === 0 || !ultimo) return;
      trilho.scrollLeft += direcaoDaBorda * 7;
      marcarChip(ultimo.x, ultimo.y);
    }, 30);
    const atualizar = (x: number, y: number) => {
      ultimo = { x, y };
      const t = trilho.getBoundingClientRect();
      const naAlturaDoTrilho = y >= t.top - 24 && y <= t.bottom + 24;
      direcaoDaBorda = !naAlturaDoTrilho ? 0 : x < t.left + 40 ? -1 : x > t.right - 40 ? 1 : 0;
      marcarChip(x, y);
    };
    const onMouse = (e: MouseEvent) => atualizar(e.clientX, e.clientY);
    const onTouch = (e: TouchEvent) => {
      const t = e.touches[0];
      if (t) atualizar(t.clientX, t.clientY);
    };
    window.addEventListener("mousemove", onMouse, true);
    window.addEventListener("touchmove", onTouch, { capture: true, passive: true });
    return () => {
      window.clearInterval(rolagem);
      window.removeEventListener("mousemove", onMouse, true);
      window.removeEventListener("touchmove", onTouch, true);
    };
  }, [arrastando]);
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

  // O trilho também transborda: o chip da etapa visível fica sempre à vista.
  useEffect(() => {
    const trilho = trilhoRef.current;
    const id = scrollState.activeStageId;
    if (!trilho || !id) return;
    const chip = trilho.querySelector<HTMLElement>(`[data-stage-chip="${id}"]`);
    if (!chip) return;
    const inicio = chip.offsetLeft;
    const fim = inicio + chip.offsetWidth;
    if (inicio < trilho.scrollLeft) {
      trilho.scrollTo({ left: Math.max(0, inicio - 8), behavior: "smooth" });
    } else if (fim > trilho.scrollLeft + trilho.clientWidth) {
      trilho.scrollTo({ left: fim - trilho.clientWidth + 8, behavior: "smooth" });
    }
  }, [scrollState.activeStageId]);

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
      const chip = chipSobArrastoRef.current;
      chipSobArrastoRef.current = null;
      setChipSobArrasto(null);
      setArrastando(null);
      if (!data || !grouped) return;
      const { source, destination, draggableId } = result;
      if (!chip && !destination) return;
      if (
        !chip &&
        destination &&
        source.droppableId === destination.droppableId &&
        source.index === destination.index
      ) {
        return;
      }

      const lead = data.leads.find((l) => l.id === draggableId);
      if (!lead) return;

      const destStageId = chip ?? destination!.droppableId;
      if (destStageId === source.droppableId && chip) return;
      const destList = (grouped.get(destStageId) ?? []).filter(
        (l) => l.id !== draggableId,
      );
      // Soltar no chip do trilho põe o card no fim da etapa.
      const destIndex = chip ? destList.length : destination!.index;

      const before = destIndex > 0 ? destList[destIndex - 1] : null;
      const after = destIndex < destList.length ? destList[destIndex] : null;

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
    <DragDropContext
      onDragStart={(inicio) => setArrastando(inicio.source.droppableId)}
      onDragEnd={handleDragEnd}
    >
      <div
        className="flex min-h-0 flex-1 flex-col gap-2"
        data-testid="kanban-board-shell"
      >
        {/* Trilho de etapas — clique vai até a etapa; soltar um card no chip
            muda de fase, inclusive para etapa que está fora da tela. */}
        <div
          ref={trilhoRef}
          className="relative flex shrink-0 gap-1.5 overflow-x-auto px-1 pb-0.5"
          data-testid="kanban-stage-rail"
          data-arrastando={arrastando ? "1" : undefined}
          role="tablist"
          aria-label="Etapas do funil"
        >
          {data.stages.map((stage) => {
            const count = grouped.get(stage.id)?.length ?? 0;
            const active = scrollState.activeStageId === stage.id;
            const sobArrasto = chipSobArrasto === stage.id;
            return (
              <button
                key={stage.id}
                type="button"
                role="tab"
                aria-selected={active}
                data-testid={`stage-chip-${stage.id}`}
                data-stage-chip={stage.id}
                data-sob-arrasto={sobArrasto ? "1" : undefined}
                onClick={() => scrollToStage(stage.id)}
                onDoubleClick={() => abrirFoco(stage.id)}
                className={cn(
                  "shrink-0 rounded-full px-3 py-1.5 text-xs font-medium tabular-nums transition-colors",
                  "ring-1 ring-[var(--color-border)]",
                  active
                    ? "bg-[var(--moope-primary)] text-white ring-[var(--moope-primary)]"
                    : "bg-[var(--color-surface)] text-[var(--color-text-muted)] hover:bg-[var(--color-surface-muted)] hover:text-[var(--color-text)]",
                  arrastando &&
                    arrastando !== stage.id &&
                    !sobArrasto &&
                    "outline-dashed outline-2 outline-offset-1 outline-[var(--moope-primary)]",
                  sobArrasto &&
                    "scale-110 bg-[var(--moope-primary)] text-white ring-2 ring-[var(--moope-primary)]",
                )}
                title="Clique para ir · duplo clique para tela cheia · solte um card aqui para mudar de fase"
              >
                {stage.name}
                <span className="ml-1 opacity-80">({count})</span>
              </button>
            );
          })}
        </div>

        <div className="relative min-h-0 flex-1">
          {scrollState.canScrollLeft ? (
            <>
              <div
                aria-hidden
                className="pointer-events-none absolute inset-y-0 left-0 z-[5] w-14 bg-gradient-to-r from-[var(--color-bg)] to-transparent"
              />
              <Button
                type="button"
                size="icon"
                variant="primary"
                className="absolute left-2 top-1/2 z-20 h-12 w-12 -translate-y-1/2 touch-manipulation rounded-full shadow-lg max-md:bottom-3 max-md:top-auto max-md:translate-y-0"
                onPointerDown={(e) => e.stopPropagation()}
                onClick={() => scrollByColumns(-1)}
                aria-label="Etapa anterior"
                title="Etapa anterior"
                data-testid="kanban-scroll-left"
              >
                <CaretLeft size={22} weight="bold" />
              </Button>
            </>
          ) : null}
          {scrollState.canScrollRight ? (
            <>
              <div
                aria-hidden
                className="pointer-events-none absolute inset-y-0 right-0 z-[5] w-14 bg-gradient-to-l from-[var(--color-bg)] to-transparent"
              />
              <Button
                type="button"
                size="icon"
                variant="primary"
                className="absolute right-2 top-1/2 z-20 h-12 w-12 -translate-y-1/2 touch-manipulation rounded-full shadow-lg max-md:bottom-3 max-md:top-auto max-md:translate-y-0"
                onPointerDown={(e) => e.stopPropagation()}
                onClick={() => scrollByColumns(1)}
                aria-label="Próxima etapa"
                title="Próxima etapa"
                data-testid="kanban-scroll-right"
              >
                <CaretRight size={22} weight="bold" />
              </Button>
            </>
          ) : null}

          <div
            ref={scrollerRef}
            tabIndex={0}
            className="relative flex h-full min-h-0 gap-3 overflow-x-auto overflow-y-hidden bg-[var(--color-bg)] px-1 pb-1 outline-none focus-visible:ring-2 focus-visible:ring-[var(--moope-primary)] max-md:snap-x max-md:snap-mandatory max-md:scroll-px-1"
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

      {/* Fixo na tela: não mexe no layout no meio do arrasto (o dnd mede as
          colunas no começo e erraria o alvo se algo empurrasse o quadro). */}
      {arrastando ? (
        <div
          aria-live="polite"
          data-testid="kanban-dica-arrasto"
          className={cn(
            "pointer-events-none fixed inset-x-0 bottom-6 z-50 mx-auto w-fit max-w-[90vw] truncate rounded-full px-4 py-2 text-sm font-medium shadow-lg",
            chipSobArrasto
              ? "bg-[var(--moope-primary)] text-white"
              : "bg-[var(--color-surface)] text-[var(--color-text)] ring-1 ring-[var(--color-border)]",
          )}
        >
          {chipSobArrasto
            ? `Soltar em ${data.stages.find((s) => s.id === chipSobArrasto)?.name ?? "etapa"}`
            : "Solte numa coluna ou leve até uma etapa lá em cima"}
        </div>
      ) : null}

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
