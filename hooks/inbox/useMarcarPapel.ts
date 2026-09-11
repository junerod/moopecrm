"use client";

import { useState } from "react";
import { toast } from "sonner";

import { useUpdateContact } from "@/hooks/contacts/useUpdateContact";
import { carregarResumoParaMarcar, garantirLeadAoMarcar } from "@/lib/inbox/marcar-papel";
import type { CrmSummaryData } from "@/lib/inbox/crm-summary-tipos";
import type { PapelDoContato } from "@/lib/crm/papel-e-temperatura";

export function useMarcarPapel(contactId: string) {
  const update = useUpdateContact(contactId);
  const [pendente, setPendente] = useState<PapelDoContato | null>(null);

  async function marcar(
    proximo: PapelDoContato,
    opts: {
      atual: string | null | undefined;
      contactName: string;
      summary?: CrmSummaryData | null;
      onAtualizou?: (papel?: PapelDoContato | null) => void;
    },
  ) {
    const seguinte = opts.atual === proximo ? null : proximo;
    setPendente(proximo);
    try {
      await update.mutateAsync({ papel: seguinte });
      if (seguinte === "lead") {
        const summary = opts.summary ?? (await carregarResumoParaMarcar(contactId));
        await garantirLeadAoMarcar({
          contactId,
          contactName: opts.contactName,
          summary,
        });
      }
      opts.onAtualizou?.(seguinte);
    } catch {
      toast.error("Não consegui gravar a marcação. Tente de novo.");
    } finally {
      setPendente(null);
    }
  }

  return {
    marcar,
    pendente,
    isPending: update.isPending || pendente !== null,
  };
}
