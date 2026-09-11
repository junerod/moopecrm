"use client";
import { useState } from "react";
import { useT } from "@/hooks/i18n/useT";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { JanelaSelo } from "@/components/inbox/JanelaSelo";
import { Phone, DotsThree } from "@/lib/ui/icons";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useAuth } from "@/hooks/auth/AuthProvider";
import { useClaimConversation } from "@/hooks/inbox/useClaimConversation";
import { useReleaseConversation } from "@/hooks/inbox/useReleaseConversation";
import { useCloseConversation } from "@/hooks/inbox/useCloseConversation";
import { useResumeAiAttendance } from "@/hooks/inbox/useResumeAiAttendance";
import { usePauseAiAttendance } from "@/hooks/inbox/usePauseAiAttendance";
import { useSnoozeConversation } from "@/hooks/inbox/useSnoozeConversation";
import { useAutomaticoAtivo } from "@/hooks/ai/useAutomaticoAtivo";
import { OwnerBadge } from "@/components/kanban/OwnerBadge";
import { comandoDaConversa, ROTULO_DO_MOTIVO } from "@/lib/inbox/comando-da-conversa";
import { ReassignDialog } from "@/components/inbox/ReassignDialog";
import type { ConversationWithContact } from "@/hooks/inbox/useConversationsRealtime";
import { contatoDoEmbed, rotuloDoContato } from "@/lib/contacts/rotulo-do-contato";
import { MarcarPessoa } from "./MarcarPessoa";
import { SeloDaPessoa } from "./SeloDaPessoa";

interface Props {
  conversation: ConversationWithContact;
}

const STATUS_LABEL: Record<string, string> = {
  open: "Aberta",
  pending: "Aguardando atendente",
  claimed: "Em atendimento",
  ai_handling: "Automático atendendo",
  closed: "Fechada",
  archived: "Arquivada",
};

const SNOOZE_HORAS: Array<{ hours: 1 | 3 | 24; label: string }> = [
  { hours: 1, label: "Em 1 hora" },
  { hours: 3, label: "Em 3 horas" },
  { hours: 24, label: "Em 24 horas" },
];

export function ConversationHeader({ conversation }: Props) {
  const t = useT();
  const { user } = useAuth();
  const claim = useClaimConversation();
  const release = useReleaseConversation();
  const close = useCloseConversation();
  const retomar = useResumeAiAttendance();
  const pausar = usePauseAiAttendance();
  const { snooze, cancel } = useSnoozeConversation();
  const automaticoDaOrg = useAutomaticoAtivo();
  const [reassignOpen, setReassignOpen] = useState(false);

  const c = contatoDoEmbed(conversation.contacts);
  const displayName = rotuloDoContato(c);
  const phone = c?.phone_number ?? null;
  const status = conversation.status;
  const isMineAssigned = conversation.assigned_to_user_id === user.id;
  const isOpen = status === "open" || conversation.assigned_to_user_id == null;
  const lembreteAtivo = conversation.snooze_until != null;

  const { comando, automaticoAtivo, travaVigente, motivo } = comandoDaConversa({
    status,
    assigned_to_user_id: conversation.assigned_to_user_id,
    assigned_to_user_name: conversation.assigned_to_user_name ?? null,
    assignee_kind: conversation.assignee_kind ?? null,
    bot_silenced_until: conversation.bot_silenced_until ?? null,
    force_human: c?.force_human ?? null,
    automaticoDaOrg: automaticoDaOrg.data,
  });

  const encerrada = status === "closed" || status === "archived";
  const podeDevolver = travaVigente;
  const podePausar =
    automaticoAtivo && !encerrada && conversation.assigned_to_user_id !== null;
  const podeTransferir = status !== "closed" && status !== "archived";

  return (
    // `flex-wrap` permanece como catraca de largura (inbox-header-nao-trava).
    // No mobile a barra visível é nome + ⋯; Assumir só entra se for o gesto.
    <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border bg-background px-3 py-2 md:px-4 md:py-2.5">
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <h2 className="truncate text-base font-semibold md:text-lg">{displayName}</h2>
          <SeloDaPessoa contact={c} />
          <Badge variant="outline" className="hidden h-5 px-1.5 text-[11px] sm:inline-flex">
            {t(STATUS_LABEL[status] ?? status)}
          </Badge>
          <JanelaSelo
            provider={conversation.channel_sessions?.provider ?? null}
            lastInboundAt={conversation.last_inbound_at}
          />
          {motivo !== null && (
            <Badge
              variant="outline"
              className="h-5 px-1.5 text-[11px]"
              data-testid="badge-atendimento-humano"
            >
              {t(ROTULO_DO_MOTIVO[motivo])}
            </Badge>
          )}
        </div>

        <div className="mt-0.5 flex items-center gap-2" data-testid="comando-da-conversa">
          {comando.quem === "humano" ? (
            <OwnerBadge ownerKind="user" ownerName={comando.nome ?? "Atendente"} />
          ) : comando.quem === "automatico" ? (
            <OwnerBadge ownerKind="ai" ownerName="Automático" />
          ) : (
            <OwnerBadge ownerKind={null} ownerName={null} />
          )}
          {phone ? (
            <p className="hidden items-center gap-1 text-xs text-muted-foreground sm:flex">
              <Phone size={11} weight="regular" aria-hidden /> {phone}
            </p>
          ) : null}
        </div>
      </div>

      <div className="flex min-w-0 flex-wrap items-center justify-end gap-1.5">
        {isOpen && (
          <Button
            size="sm"
            variant="default"
            className="min-h-11 px-4 md:min-h-8"
            disabled={claim.isPending}
            title="Você passa a responder esta conversa e o atendimento automático para aqui."
            onClick={() =>
              claim.mutate({
                conversation_id: conversation.id,
                expected_assignee: conversation.assigned_to_user_id,
              })
            }
          >
            {t("Assumir")}
          </Button>
        )}
        {podeTransferir && (
          <Button
            size="sm"
            variant="ghost"
            className="hidden min-h-8 md:inline-flex"
            onClick={() => setReassignOpen(true)}
          >
            {t("Transferir")}
          </Button>
        )}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              size="sm"
              variant="ghost"
              aria-label={t("Mais ações")}
              className="min-h-11 min-w-11 px-2 md:min-h-8 md:min-w-8"
            >
              <DotsThree size={18} weight="bold" aria-hidden />
              <span className="sr-only">{t("Mais ações")}</span>
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="min-w-52">
            {c?.id ? (
              <div className="px-1.5 py-1">
                <MarcarPessoa contactId={c.id} papel={c.papel} contactName={displayName} />
              </div>
            ) : null}
            {podeTransferir ? (
              <DropdownMenuItem
                className="md:hidden"
                onClick={() => setReassignOpen(true)}
              >
                {t("Transferir")}
              </DropdownMenuItem>
            ) : null}
            {podeTransferir ? (
              lembreteAtivo ? (
                <DropdownMenuItem
                  onClick={() => cancel.mutate({ conversation_id: conversation.id })}
                >
                  Cancelar lembrete
                </DropdownMenuItem>
              ) : (
                <DropdownMenuSub>
                  <DropdownMenuSubTrigger>{t("Lembrar")}</DropdownMenuSubTrigger>
                  <DropdownMenuSubContent>
                    {SNOOZE_HORAS.map((d) => (
                      <DropdownMenuItem
                        key={d.hours}
                        onClick={() =>
                          snooze.mutate({
                            conversation_id: conversation.id,
                            duration_hours: d.hours,
                          })
                        }
                      >
                        {d.label}
                      </DropdownMenuItem>
                    ))}
                  </DropdownMenuSubContent>
                </DropdownMenuSub>
              )
            ) : null}
            {isMineAssigned && (
              <DropdownMenuItem
                disabled={release.isPending}
                onClick={() => release.mutate({ conversation_id: conversation.id })}
              >
                {t("Liberar")}
              </DropdownMenuItem>
            )}
            {podeDevolver && (
              <DropdownMenuItem
                disabled={retomar.isPending}
                data-testid="devolver-ao-automatico"
                title={
                  motivo === "contato_travado"
                    ? "Religa o atendimento automático para este cliente — vale para todas as conversas dele."
                    : "Devolve esta conversa ao atendimento automático."
                }
                onClick={() => retomar.mutate({ conversation_id: conversation.id })}
              >
                {retomar.isPending ? "Devolvendo..." : t("Devolver ao automático")}
              </DropdownMenuItem>
            )}
            {podePausar && (
              <DropdownMenuItem
                disabled={pausar.isPending}
                data-testid="pausar-o-automatico"
                title="O atendimento automático para nesta conversa. O dono não muda."
                onClick={() => pausar.mutate({ conversation_id: conversation.id })}
              >
                {pausar.isPending ? "Pausando..." : t("Pausar o automático")}
              </DropdownMenuItem>
            )}
            {status !== "closed" && status !== "archived" && (
              <DropdownMenuItem
                disabled={close.isPending}
                className="text-destructive focus:text-destructive"
                onClick={() => {
                  if (confirm("Fechar esta conversa?")) {
                    close.mutate({ conversation_id: conversation.id });
                  }
                }}
              >
                {t("Fechar")}
              </DropdownMenuItem>
            )}
            {c?.id ? (
              <DropdownMenuItem asChild>
                <Link href={`/app/contacts/${c.id}`}>Ver contato</Link>
              </DropdownMenuItem>
            ) : null}
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
      <ReassignDialog
        conversationId={conversation.id}
        open={reassignOpen}
        onOpenChange={setReassignOpen}
      />
    </div>
  );
}
