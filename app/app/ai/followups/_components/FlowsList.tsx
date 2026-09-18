"use client";
import { useState } from "react";
import Link from "next/link";

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { FlowArrow, Plus, Trash } from "@/lib/ui/icons";
import {
  useDeleteFollowupFlow,
  useFollowupFlows,
  type FollowupFlowPointerRow,
} from "@/hooks/followup/useFollowupFlows";
import { FlowStatusBadge } from "./FlowStatusBadge";
import { NewFlowDialog } from "./NewFlowDialog";

interface Props {
  initialData: FollowupFlowPointerRow[];
  canWrite: boolean;
  purpose?: "followup" | "bot";
}

function formatUpdatedAt(iso: string): string {
  return new Date(iso).toLocaleDateString("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
}

export function FlowsList({ initialData, canWrite, purpose = "followup" }: Props) {
  const { data } = useFollowupFlows({ initialData });
  const apagar = useDeleteFollowupFlow();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [alvo, setAlvo] = useState<FollowupFlowPointerRow | null>(null);

  const flows = (data ?? []).filter((f) =>
    purpose === "bot" ? f.purpose === "bot" : f.purpose !== "bot",
  );
  const ehBot = purpose === "bot";

  const newFlowButton = (
    <Button onClick={() => setDialogOpen(true)} className="w-full sm:w-auto">
      <Plus size={14} aria-hidden className="mr-2" /> {ehBot ? "Novo bot" : "Novo fluxo"}
    </Button>
  );

  if (flows.length === 0) {
    return (
      <>
        <Card className="flex flex-col items-center gap-3 p-10 text-center">
          <FlowArrow size={36} aria-hidden className="text-text-muted" />
          <h2 className="font-medium">{ehBot ? "Nenhum bot ainda" : "Nenhuma automação ainda"}</h2>
          <p className="max-w-sm text-sm text-text-muted">
            {ehBot
              ? "Desenhe o menu da porta da frente: 1, 2, 3, horário, FAQ ou humano."
              : "Monte um fluxo para o sistema voltar a falar sozinho quando o cliente sumir, mudar de etapa ou encerrar a conversa — sem depender de alguém lembrar de mandar mensagem."}
          </p>
          {canWrite && <div className="mt-1">{newFlowButton}</div>}
        </Card>
        {canWrite && <NewFlowDialog open={dialogOpen} onOpenChange={setDialogOpen} purpose={purpose} />}
      </>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      {canWrite && (
        <div className="flex sm:justify-end">{newFlowButton}</div>
      )}

      <ul className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3">
        {flows.map((flow) => (
          <li key={flow.id}>
            <Card className="flex h-full flex-col gap-3 p-4 transition-colors hover:border-accent-400">
              <Link href={`/app/ai/followups/${flow.id}`} className="flex flex-1 flex-col gap-3">
                <div className="flex items-start justify-between gap-2">
                  <h3 className="min-w-0 flex-1 truncate font-medium" title={flow.name}>
                    {flow.name}
                  </h3>
                  <FlowStatusBadge status={flow.status} />
                </div>
                <dl className="grid grid-cols-2 gap-2 pt-1 text-xs">
                  <div>
                    <dt className="text-text-muted">Versão</dt>
                    <dd className="font-mono">{flow.active_version_id ? "publicada" : "—"}</dd>
                  </div>
                  <div>
                    <dt className="text-text-muted">Handoff</dt>
                    <dd className="font-mono">{flow.handoff_policy}</dd>
                  </div>
                </dl>
                <p className="mt-auto pt-2 text-xs text-text-muted">
                  Atualizado em {formatUpdatedAt(flow.updated_at)}
                </p>
              </Link>
              {canWrite && (
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="self-start text-destructive hover:text-destructive"
                  data-testid={`apagar-fluxo-${flow.id}`}
                  onClick={() => setAlvo(flow)}
                >
                  <Trash size={14} aria-hidden className="mr-1.5" />
                  Apagar
                </Button>
              )}
            </Card>
          </li>
        ))}
      </ul>

      <AlertDialog open={alvo !== null} onOpenChange={(aberto) => !aberto && setAlvo(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {ehBot ? "Apagar este bot?" : "Apagar esta automação?"}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {alvo
                ? `«${alvo.name}» some da lista e para de falar com o cliente. Isso não volta.`
                : ""}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              data-testid="confirmar-apagar-fluxo"
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={() => {
                if (!alvo) return;
                apagar.mutate(alvo.id);
                setAlvo(null);
              }}
            >
              Apagar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {canWrite && <NewFlowDialog open={dialogOpen} onOpenChange={setDialogOpen} purpose={purpose} />}
    </div>
  );
}
