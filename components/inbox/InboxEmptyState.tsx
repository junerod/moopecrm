import { AppIcon } from "@/components/ds/AppIcon";
import { ChatCircle, IdentificationCard } from "@/lib/ui/icons";

export function InboxEmptyState({
  variante,
}: {
  variante: "thread" | "ficha";
}) {
  const thread = variante === "thread";
  return (
    <div
      data-testid={thread ? "inbox-empty-thread" : "inbox-empty-ficha"}
      className="flex h-full flex-col items-center justify-center gap-3 px-6 text-center"
    >
      <AppIcon
        icon={thread ? ChatCircle : IdentificationCard}
        tone={thread ? "blue" : "teal"}
        size="lg"
      />
      <div className="space-y-1">
        <p className="text-sm font-semibold text-[var(--color-text)]">
          {thread ? "Selecione uma conversa" : "Ficha do contato"}
        </p>
        <p className="max-w-[16rem] text-xs leading-relaxed text-[var(--color-text-muted)]">
          {thread
            ? "Escolha um atendimento na lista para começar."
            : "Os dados do contato e da oportunidade aparecerão aqui."}
        </p>
      </div>
    </div>
  );
}
