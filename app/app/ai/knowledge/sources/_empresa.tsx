"use client";

import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";

import { AdicionarConhecimento } from "@/components/negocio/AdicionarConhecimento";
import { DocumentosDaEmpresa } from "@/components/negocio/DocumentosDaEmpresa";
import { FontesDaEmpresa } from "@/components/negocio/FontesDaEmpresa";
import { TestarConhecimento } from "@/components/negocio/TestarConhecimento";
import { sourcesQueryKey, type SourceRow } from "@/hooks/ai/useKnowledgeSources";
import { cn } from "@/lib/utils";

const ABAS = [
  { id: "documentos", label: "Documentos", testid: "aba-conhecimento-documentos" },
  { id: "texto", label: "Texto rápido", testid: "aba-conhecimento-texto" },
  { id: "fontes", label: "Fontes", testid: "aba-conhecimento-fontes" },
  { id: "testar", label: "Testar", testid: "aba-conhecimento-testar" },
] as const;

type Aba = (typeof ABAS)[number]["id"];

export function ConhecimentoDaEmpresaClient({
  agentId,
  initialSources,
}: {
  agentId: string;
  initialSources: SourceRow[];
}) {
  const qc = useQueryClient();
  const [aba, setAba] = useState<Aba>("documentos");
  const [perguntaTeste, setPerguntaTeste] = useState<string>("");

  return (
    <div className="space-y-4">
      <div
        role="tablist"
        aria-label="Áreas do conhecimento"
        className="flex flex-wrap gap-1 rounded-[12px] bg-[var(--color-surface)] p-1 ring-1 ring-[var(--color-border)]"
      >
        {ABAS.map((a) => (
          <button
            key={a.id}
            type="button"
            role="tab"
            aria-selected={aba === a.id}
            data-testid={a.testid}
            className={cn(
              "min-h-10 flex-1 rounded-[10px] px-3 py-2 text-sm font-medium",
              aba === a.id
                ? "bg-[var(--color-bg)] text-[var(--color-text)] shadow-[var(--shadow-sm)]"
                : "text-[var(--color-text-muted)]",
            )}
            onClick={() => setAba(a.id)}
          >
            {a.label}
          </button>
        ))}
      </div>

      {aba === "documentos" ? (
        <DocumentosDaEmpresa
          agentId={agentId}
          initialSources={initialSources}
          onTestar={(nome) => {
            setPerguntaTeste(`O que o documento ${nome} diz?`);
            setAba("testar");
          }}
        />
      ) : null}
      {aba === "texto" ? (
        <AdicionarConhecimento
          agentId={agentId}
          onCriada={() => {
            void qc.invalidateQueries({ queryKey: sourcesQueryKey(agentId) });
          }}
        />
      ) : null}
      {aba === "fontes" ? (
        <FontesDaEmpresa agentId={agentId} initialSources={initialSources} />
      ) : null}
      {aba === "testar" ? <TestarConhecimento perguntaInicial={perguntaTeste} /> : null}
    </div>
  );
}
