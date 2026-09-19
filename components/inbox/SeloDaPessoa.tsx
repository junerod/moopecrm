"use client";

import { StatusBadge } from "@/components/ds/StatusBadge";
import { contatoNaoSalvo } from "@/lib/contacts/rotulo-do-contato";
import {
  precisaAvisarNomeNaoSalvo,
  seloDaPessoa,
  temperaturaDoLeadAberto,
} from "@/lib/crm/papel-e-temperatura";
import { tomDoSelo } from "@/lib/inbox/tom-da-tag";
import type { ContactSummary } from "@/hooks/inbox/useConversationsRealtime";

interface Props {
  contact: ContactSummary | null | undefined;
}

export function SeloDaPessoa({ contact }: Props) {
  if (!contact) return null;
  const temperatura = temperaturaDoLeadAberto(contact.crm_leads);
  const naoSalvo = contatoNaoSalvo(contact);
  const selo = seloDaPessoa({
    papel: contact.papel,
    naoSalvo,
    temperatura,
  });
  const avisoNome = precisaAvisarNomeNaoSalvo({ papel: contact.papel, naoSalvo });
  if (!selo && !avisoNome) return null;
  return (
    <span className="inline-flex flex-wrap items-center gap-1">
      {selo ? (
        <StatusBadge
          tone={tomDoSelo(selo.kind, temperatura)}
          className="h-5 px-1.5 text-[10px]"
          data-testid="selo-da-pessoa"
          data-selo={selo.kind}
        >
          {selo.texto}
        </StatusBadge>
      ) : null}
      {avisoNome ? (
        <StatusBadge
          tone="red"
          className="h-5 px-1.5 text-[10px]"
          data-testid="selo-nome-nao-salvo"
          data-selo="nao_salvo"
        >
          <span className="sm:hidden">Sem nome</span>
          <span className="hidden sm:inline">Nome do WhatsApp · não salvo</span>
        </StatusBadge>
      ) : null}
    </span>
  );
}
