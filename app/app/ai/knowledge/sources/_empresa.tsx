"use client";

import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";

import { ProximoPasso } from "@/components/ds/ProximoPasso";
import { AdicionarConhecimento } from "@/components/negocio/AdicionarConhecimento";
import { ColecoesDaEmpresa } from "@/components/negocio/ColecoesDaEmpresa";
import { DocumentosDaEmpresa } from "@/components/negocio/DocumentosDaEmpresa";
import { FontesDaEmpresa } from "@/components/negocio/FontesDaEmpresa";
import { TestarConhecimento } from "@/components/negocio/TestarConhecimento";
import {
  sourcesQueryKey,
  useKnowledgeSources,
  type SourceRow,
} from "@/hooks/ai/useKnowledgeSources";
import { cn } from "@/lib/utils";

const ABAS = [
  { id: "documentos", label: "Documentos", testid: "aba-conhecimento-documentos" },
  { id: "texto", label: "Texto rápido", testid: "aba-conhecimento-texto" },
  { id: "colecoes", label: "Coleções", testid: "aba-conhecimento-colecoes" },
  { id: "fontes", label: "Fontes", testid: "aba-conhecimento-fontes" },
  { id: "testar", label: "Testar", testid: "aba-conhecimento-testar" },
] as const;

type Aba = (typeof ABAS)[number]["id"];

export function ehConhecimentoVazio(sources: SourceRow[]): boolean {
  return sources.filter((s) => s.status !== "archived" && s.is_active).length === 0;
}

export function ConhecimentoDaEmpresaClient({
  agentId,
  initialSources,
  contextoAgente = null,
}: {
  agentId: string;
  initialSources: SourceRow[];
  contextoAgente?: { id: string; name: string } | null;
}) {
  const qc = useQueryClient();
  const { data: sources } = useKnowledgeSources(agentId, { initialData: initialSources });
  const [aba, setAba] = useState<Aba>("documentos");
  const [perguntaTeste, setPerguntaTeste] = useState<string>("");
  const vazio = ehConhecimentoVazio(sources ?? initialSources);

  return (
    <div className="space-y-4">
      {vazio ? (
        <ProximoPasso
          titulo="Os assistentes ainda não conhecem a empresa"
          texto="Solte um PDF, uma tabela ou um texto com preços e regras. Sem isso, a IA inventa ou pede uma pessoa."
          acao="Adicionar material"
          href="#conhecimento-documentos"
        />
      ) : null}
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
        <div id="conhecimento-documentos">
        <DocumentosDaEmpresa
          agentId={agentId}
          initialSources={initialSources}
          onTestar={(nome) => {
            setPerguntaTeste(`O que o documento ${nome} diz?`);
            setAba("testar");
          }}
        />
        </div>
      ) : null}
      {aba === "texto" ? (
        <AdicionarConhecimento
          agentId={agentId}
          onCriada={() => {
            void qc.invalidateQueries({ queryKey: sourcesQueryKey(agentId) });
          }}
        />
      ) : null}
      {aba === "colecoes" ? (
        <ColecoesDaEmpresa
          agentId={contextoAgente?.id ?? agentId}
          initialSources={initialSources}
          contextoAgente={contextoAgente}
        />
      ) : null}
      {aba === "fontes" ? (
        <FontesDaEmpresa agentId={agentId} initialSources={initialSources} />
      ) : null}
      {aba === "testar" ? (
        <TestarConhecimento agentId={agentId} perguntaInicial={perguntaTeste} />
      ) : null}
    </div>
  );
}
