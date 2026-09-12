"use client";

import { StatusBadge } from "@/components/ds/StatusBadge";
import { contatoNaoSalvo } from "@/lib/contacts/rotulo-do-contato";
import { seloDaPessoa, temperaturaDoLeadAberto } from "@/lib/crm/papel-e-temperatura";
import { tomDoSelo } from "@/lib/inbox/tom-da-tag";
import type { ContactSummary } from "@/hooks/inbox/useConversationsRealtime";

interface Props {
  contact: ContactSummary | null | undefined;
}

export function SeloDaPessoa({ contact }: Props) {
  if (!contact) return null;
  const temperatura = temperaturaDoLeadAberto(contact.crm_leads);
  const selo = seloDaPessoa({
    papel: contact.papel,
    naoSalvo: contatoNaoSalvo(contact),
    temperatura,
  });
  if (!selo) return null;
  return (
    <StatusBadge
      tone={tomDoSelo(selo.kind, temperatura)}
      className="h-5 px-1.5 text-[10px]"
      data-testid="selo-da-pessoa"
      data-selo={selo.kind}
    >
      {selo.texto}
    </StatusBadge>
  );
}
