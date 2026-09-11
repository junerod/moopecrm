"use client";

import { Badge } from "@/components/ui/badge";
import { contatoNaoSalvo } from "@/lib/contacts/rotulo-do-contato";
import { seloDaPessoa, temperaturaDoLeadAberto } from "@/lib/crm/papel-e-temperatura";
import type { ContactSummary } from "@/hooks/inbox/useConversationsRealtime";

interface Props {
  contact: ContactSummary | null | undefined;
}

export function SeloDaPessoa({ contact }: Props) {
  if (!contact) return null;
  const selo = seloDaPessoa({
    papel: contact.papel,
    naoSalvo: contatoNaoSalvo(contact),
    temperatura: temperaturaDoLeadAberto(contact.crm_leads),
  });
  if (!selo) return null;
  return (
    <Badge
      variant="outline"
      className="h-4 px-1.5 text-[10px] font-normal"
      data-testid="selo-da-pessoa"
      data-selo={selo.kind}
    >
      {selo.texto}
    </Badge>
  );
}
