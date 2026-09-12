"use client";
import { useState } from "react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";

import { apiClient } from "@/lib/api/client";
import { DotsThree, PencilSimple, Users } from "@/lib/ui/icons";
import { useQueryClient } from "@tanstack/react-query";
import { useWinLead, useEditLead } from "@/hooks/kanban/useUpdateLead";
import { useMoveCard } from "@/hooks/kanban/useMoveCard";
import { useAssignableMembers } from "@/hooks/inbox/useAssignableMembers";
import { useAssignableAgents } from "@/hooks/kanban/useAssignableAgents";
import { usePermission } from "@/hooks/auth/AuthProvider";
import { ProximaAcaoControles } from "@/components/comercial/ProximaAcaoControles";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { LoseLeadDialog } from "./LoseLeadDialog";
import { EditLeadDialog } from "./EditLeadDialog";
import type { Lead } from "@/lib/types/leads";
import type { Stage } from "@/lib/kanban/types";

interface KanbanCardActionsProps {
  lead: Lead;
  pipelineId: string;
  stages?: Stage[];
}

export function KanbanCardActions({ lead, pipelineId, stages = [] }: KanbanCardActionsProps) {
  const [loseOpen, setLoseOpen] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [acaoOpen, setAcaoOpen] = useState(false);
  const winMutation = useWinLead(pipelineId);
  const editMutation = useEditLead(pipelineId);
  const moveMutation = useMoveCard(pipelineId);
  // spec 13 §4: escrita no funil é agent+ — viewer não reatribui (a rota
  // PATCH também recusa; aqui é só não oferecer o que seria negado).
  const canAssign = usePermission("pipeline.move_card");
  const { data: members } = useAssignableMembers(canAssign);
  // A rota já devolve só agente ativo e não arquivado — é o picker.
  const { data: agents } = useAssignableAgents(canAssign);

  const reassignToUser = (ownerUserId: string | null) => {
    if (ownerUserId === lead.owner_user_id) return;
    editMutation.mutate({ leadId: lead.id, patch: { owner_user_id: ownerUserId } });
  };

  /** Transferir para um agente: o handler zera o dono humano e deriva owner_kind. */
  const reassignToAgent = (agentId: string) => {
    if (agentId === lead.owner_agent_id) return;
    editMutation.mutate({ leadId: lead.id, patch: { owner_agent_id: agentId } });
  };

  const clearOwner = () => {
    if (lead.owner_user_id === null && lead.owner_agent_id === null) return;
    editMutation.mutate({
      leadId: lead.id,
      patch: lead.owner_agent_id ? { owner_agent_id: null } : { owner_user_id: null },
    });
  };

  const queryClient = useQueryClient();
  const etapasAbertas = stages.filter((s) => !s.is_archived && !s.is_won && !s.is_lost);
  const etapaReativar =
    etapasAbertas.find((s) => /reativar/i.test(s.name)) ?? etapasAbertas[0];

  const moverPara = (stageId: string) => {
    if (stageId === lead.stage_id || moveMutation.isPending) return;
    moveMutation.mutate({
      leadId: lead.id,
      stageId,
      positionInStage: 1_000_000,
      expectedUpdatedAt: lead.updated_at,
    });
  };

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7 shrink-0 opacity-100 transition-opacity sm:opacity-0 sm:group-hover:opacity-100 data-[state=open]:opacity-100"
            onClick={(e) => e.stopPropagation()}
            aria-label="Ações do lead"
          >
            <DotsThree size={16} weight="bold" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent
          align="end"
          onClick={(e) => e.stopPropagation()}
          onCloseAutoFocus={(e) => e.preventDefault()}
        >
          <DropdownMenuItem
            onSelect={() => {
              setEditOpen(true);
            }}
          >
            <PencilSimple size={14} className="mr-2" /> Editar
          </DropdownMenuItem>
          {lead.conversa?.id ? (
            <DropdownMenuItem
              onSelect={() => {
                window.location.href = `/app/inbox/${lead.conversa!.id}`;
              }}
            >
              Abrir conversa
            </DropdownMenuItem>
          ) : null}
          {lead.proxima_acao?.demanda_id ? (
            <DropdownMenuItem
              onSelect={() => {
                void apiClient
                  .post(`/api/v1/demandas/${lead.proxima_acao!.demanda_id}/concluir`, {})
                  .then(() => {
                    toast.success("Próxima ação concluída.");
                    void queryClient.invalidateQueries({ queryKey: ["board", pipelineId] });
                  })
                  .catch(() => toast.error("Não consegui concluir."));
              }}
            >
              Concluir próxima ação
            </DropdownMenuItem>
          ) : lead.status === "open" && lead.contact_id ? (
            <DropdownMenuItem onSelect={() => setAcaoOpen(true)}>
              Definir próxima ação
            </DropdownMenuItem>
          ) : null}
          {etapasAbertas.length > 0 && (
            <DropdownMenuSub>
              <DropdownMenuSubTrigger>Mover para…</DropdownMenuSubTrigger>
              <DropdownMenuSubContent>
                {etapasAbertas.map((s) => (
                    <DropdownMenuItem
                      key={s.id}
                      disabled={moveMutation.isPending || s.id === lead.stage_id}
                      onSelect={() => moverPara(s.id)}
                    >
                      {s.name}
                    </DropdownMenuItem>
                  ))}
              </DropdownMenuSubContent>
            </DropdownMenuSub>
          )}
          {(lead.status === "won" || lead.status === "lost") && etapaReativar && (
            <DropdownMenuItem
              disabled={moveMutation.isPending}
              onSelect={() => moverPara(etapaReativar.id)}
            >
              Reabrir / reativar
            </DropdownMenuItem>
          )}
          {canAssign && (
            <DropdownMenuSub>
              <DropdownMenuSubTrigger>
                <Users size={14} className="mr-2" /> Responsável
              </DropdownMenuSubTrigger>
              <DropdownMenuSubContent>
                <DropdownMenuItem
                  disabled={
                    editMutation.isPending ||
                    (lead.owner_user_id === null && lead.owner_agent_id === null)
                  }
                  onSelect={clearOwner}
                >
                  Sem responsável
                </DropdownMenuItem>
                {(members ?? []).length > 0 && <DropdownMenuSeparator />}
                {(members ?? []).map((m) => (
                  <DropdownMenuItem
                    key={m.user_id}
                    disabled={editMutation.isPending || m.user_id === lead.owner_user_id}
                    onSelect={() => reassignToUser(m.user_id)}
                  >
                    {m.full_name ?? "Sem nome"}
                  </DropdownMenuItem>
                ))}
                {(agents ?? []).length > 0 && <DropdownMenuSeparator />}
                {(agents ?? []).map((a) => (
                  <DropdownMenuItem
                    key={a.agent_id}
                    disabled={editMutation.isPending || a.agent_id === lead.owner_agent_id}
                    onSelect={() => reassignToAgent(a.agent_id)}
                  >
                    {a.name}
                    {a.version_number != null && (
                      <span className="ml-1.5 font-mono text-[10px] text-text-muted">
                        v{a.version_number}
                      </span>
                    )}
                  </DropdownMenuItem>
                ))}
              </DropdownMenuSubContent>
            </DropdownMenuSub>
          )}
          <DropdownMenuItem
            disabled={winMutation.isPending}
            onSelect={() => {
              winMutation.mutate({ leadId: lead.id });
            }}
          >
            Marcar como ganho
          </DropdownMenuItem>
          <DropdownMenuItem
            onSelect={() => {
              setLoseOpen(true);
            }}
          >
            Marcar como perdido
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      <LoseLeadDialog
        open={loseOpen}
        onOpenChange={setLoseOpen}
        leadId={lead.id}
        pipelineId={pipelineId}
      />
      <EditLeadDialog
        open={editOpen}
        onOpenChange={setEditOpen}
        lead={lead}
        pipelineId={pipelineId}
      />
      <Dialog open={acaoOpen} onOpenChange={setAcaoOpen}>
        <DialogContent className="sm:max-w-md" data-testid="definir-proxima-acao">
          <DialogHeader>
            <DialogTitle>Próxima ação</DialogTitle>
          </DialogHeader>
          <ProximaAcaoControles
            textoInicial={lead.proxima_acao?.texto ?? ""}
            emInicial={lead.proxima_acao?.em ?? null}
            onSalvar={async (texto, em) => {
              if (!lead.contact_id) return;
              await apiClient.post("/api/v1/demandas", {
                contact_id: lead.contact_id,
                conversation_id: lead.conversa?.id ?? null,
                lead_id: lead.id,
                proximo_passo: texto,
                proximo_passo_em: em,
              });
              toast.success("Próxima ação definida.");
              setAcaoOpen(false);
              void queryClient.invalidateQueries({ queryKey: ["board", pipelineId] });
            }}
            onCancelar={() => setAcaoOpen(false)}
          />
        </DialogContent>
      </Dialog>
    </>
  );
}
