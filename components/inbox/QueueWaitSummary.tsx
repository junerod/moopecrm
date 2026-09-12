"use client";
import { useQueueStatus } from "@/hooks/inbox/useQueueStatus";
import { resumoDaFila } from "@/lib/inbox/formato-espera";

export function QueueWaitSummary({ visible }: { visible: boolean }) {
  const { data } = useQueueStatus(visible);
  if (!visible || !data) return null;
  const resumo = resumoDaFila({
    queue_size: data.queue_size,
    oldest_wait_seconds: data.oldest_wait_seconds,
  });
  return (
    <p className="text-[11px] text-muted-foreground" data-testid="queue-wait">
      <span className="font-medium text-foreground">{resumo.titulo}</span>
      {" · "}
      {resumo.detalhe}
    </p>
  );
}
