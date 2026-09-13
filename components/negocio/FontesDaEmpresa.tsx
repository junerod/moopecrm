"use client";

import { AppCard } from "@/components/ds/AppCard";
import { StatusBadge } from "@/components/ds/StatusBadge";
import { ehDocumentoArquivado } from "@/lib/ai/knowledge/metadado-publico";
import { rotuloDoStatus, statusDoDocumento } from "@/lib/ai/knowledge/status-do-documento";
import { useKnowledgeSources, type SourceRow } from "@/hooks/ai/useKnowledgeSources";

function tipoAmigavel(s: SourceRow): string {
  if (s.source_type === "policy" && ehDocumentoArquivado(s.source_metadata)) return "Documento";
  if (s.source_type === "faq") return "FAQ";
  if (s.source_type === "policy") return "Texto manual";
  if (s.source_type === "conversation" || s.source_type === "conversations") return "Conversa";
  if (s.source_type === "catalog" || s.source_type === "nuvemshop_catalog") return "Nuvemshop";
  return "Fonte";
}

function formatarQuando(iso: string | null): string {
  if (!iso) return "Ainda não atualizado";
  return new Date(iso).toLocaleString("pt-BR", {
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function FontesDaEmpresa({
  agentId,
  initialSources,
}: {
  agentId: string;
  initialSources?: SourceRow[];
}) {
  const { data: sources } = useKnowledgeSources(agentId, { initialData: initialSources });
  const ativas = (sources ?? []).filter((s) => s.status !== "archived" && s.is_active);

  if (ativas.length === 0) {
    return (
      <AppCard testid="conhecimento-fontes">
        <p className="text-sm text-[var(--color-text-muted)]">
          Ainda não há fontes. Envie um documento ou cadastre um texto rápido.
        </p>
      </AppCard>
    );
  }

  return (
    <div className="space-y-2" data-testid="conhecimento-fontes">
      {ativas.map((s) => {
        const st = statusDoDocumento(s);
        return (
          <AppCard key={s.id} className="flex flex-wrap items-center justify-between gap-3">
            <div className="min-w-0">
              <p className="truncate text-sm font-medium">{s.name || tipoAmigavel(s)}</p>
              <p className="text-xs text-[var(--color-text-muted)]">
                {tipoAmigavel(s)} · {s.chunks_count}{" "}
                {s.chunks_count === 1 ? "trecho" : "trechos"} · {formatarQuando(s.last_indexed_at ?? s.updated_at)}
              </p>
            </div>
            <StatusBadge tone={st === "pronto" ? "green" : st === "erro" ? "red" : "amber"}>
              {rotuloDoStatus(st)}
            </StatusBadge>
          </AppCard>
        );
      })}
    </div>
  );
}
