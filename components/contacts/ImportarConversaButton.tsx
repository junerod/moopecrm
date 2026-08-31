"use client";
import { ClockCounterClockwise, CircleNotch } from "@/lib/ui/icons";
import { Button } from "@/components/ui/button";
import {
  contatoPodeImportarConversa,
  rotuloImportarConversa,
} from "@/lib/channels/historico-tipos";
import { useImportarConversa } from "@/hooks/contacts/useImportarConversa";
import type { Contact } from "@/lib/types/contacts";

export function ImportarConversaButton({
  contact,
  compact = false,
  jaTemFio = false,
}: {
  contact: Pick<Contact, "id" | "is_anonymized" | "phone_number" | "source_metadata">;
  compact?: boolean;
  jaTemFio?: boolean;
}) {
  const pode = contatoPodeImportarConversa(contact);
  const mut = useImportarConversa(contact.id, jaTemFio);

  if (!pode) return null;

  return (
    <Button
      variant="outline"
      size={compact ? "sm" : "default"}
      disabled={mut.isPending}
      onClick={(e) => {
        e.preventDefault();
        e.stopPropagation();
        mut.mutate();
      }}
    >
      {mut.isPending ? (
        <CircleNotch size={14} className="animate-spin" aria-hidden />
      ) : (
        <ClockCounterClockwise size={14} aria-hidden />
      )}
      {rotuloImportarConversa(jaTemFio, compact)}
    </Button>
  );
}
