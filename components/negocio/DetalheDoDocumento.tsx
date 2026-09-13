"use client";

import { Button } from "@/components/ui/button";
import type { SourceRow } from "@/hooks/ai/useKnowledgeSources";

export function DetalheDoDocumento({
  doc,
  onFechar,
  onTestar,
}: {
  doc: SourceRow;
  onFechar: () => void;
  onTestar: () => void;
}) {
  const meta = doc.source_metadata ?? {};
  const nome = (typeof meta.filename === "string" && meta.filename) || doc.name || "Documento";
  const derived = (meta.derived ?? {}) as Record<string, unknown>;
  const topics = Array.isArray(derived.topics) ? (derived.topics as string[]) : [];
  const visuais = typeof meta.visual_pages_count === "number" ? meta.visual_pages_count : 0;

  return (
    <div
      data-testid="conhecimento-detalhe"
      className="fixed inset-0 z-40 flex items-end justify-center bg-black/40 p-4 sm:items-center"
      onClick={onFechar}
    >
      <div
        className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-[16px] bg-[var(--color-bg)] p-5 shadow-[var(--shadow-md)]"
        onClick={(e) => e.stopPropagation()}
      >
        <p className="text-lg font-semibold">{nome}</p>
        <p className="text-sm text-[var(--color-text-muted)]">Pronto para a IA</p>
        <p className="mt-2 text-sm text-[var(--color-text-muted)]">
          {typeof meta.page_count === "number" ? `${meta.page_count} páginas · ` : ""}
          {doc.chunks_count} trechos
          {visuais > 0 ? ` · ${visuais} imagens/telas analisadas` : ""}
        </p>

        <div className="mt-4" data-testid="o-que-aprendeu">
          <p className="text-xs font-medium uppercase tracking-wide text-[var(--color-text-muted)]">
            O que a MOOPE aprendeu
          </p>
          <p className="mt-1 text-xs text-[var(--color-text-muted)]">Organização feita pela IA — não substitui o original.</p>
          {typeof derived.summary === "string" && derived.summary ? (
            <p className="mt-1 text-sm">{derived.summary}</p>
          ) : (
            <p className="mt-1 text-sm text-[var(--color-text-muted)]">
              Ainda não há resumo derivado. O conteúdo original do arquivo continua disponível para busca.
            </p>
          )}
        </div>

        {topics.length > 0 ? (
          <ul className="mt-2 list-disc pl-5 text-sm">
            {topics.map((t) => (
              <li key={t}>{t}</li>
            ))}
          </ul>
        ) : null}

        <p className="mt-4 text-xs text-[var(--color-text-muted)]">
          O conteúdo do documento original permanece intacto. A organização acima é derivada.
        </p>

        <div className="mt-4 flex flex-wrap gap-2">
          <Button type="button" size="sm" onClick={onTestar}>
            Testar conhecimento
          </Button>
          <Button type="button" size="sm" variant="ghost" onClick={onFechar}>
            Fechar
          </Button>
        </div>
      </div>
    </div>
  );
}
