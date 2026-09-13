"use client";

import { useEffect, useState } from "react";
import { toast } from "sonner";

import { FormSection } from "@/components/ds/FormSection";
import { Button } from "@/components/ui/button";
import { ehDocumentoArquivado } from "@/lib/ai/knowledge/metadado-publico";
import { idsDeColecaoDoMeta } from "@/lib/ai/knowledge/colecoes";
import { useKnowledgeSources, type SourceRow } from "@/hooks/ai/useKnowledgeSources";

type Colecao = { id: string; name: string; slug: string };

export function ColecoesDaEmpresa({
  agentId,
  initialSources,
}: {
  agentId: string;
  initialSources?: SourceRow[];
}) {
  const { data: sources, refetch } = useKnowledgeSources(agentId, {
    initialData: initialSources,
  });
  const [colecoes, setColecoes] = useState<Colecao[]>([]);
  const [nomeNova, setNomeNova] = useState("");
  const docs = (sources ?? []).filter(
    (s) => s.source_type === "policy" && ehDocumentoArquivado(s.source_metadata) && s.status !== "archived",
  );

  useEffect(() => {
    void fetch("/api/v1/ai/knowledge/collections")
      .then((r) => r.json())
      .then((j: { data?: { colecoes?: Colecao[] } }) => setColecoes(j.data?.colecoes ?? []))
      .catch(() => undefined);
  }, []);

  async function criar() {
    const name = nomeNova.trim();
    if (name.length < 2) return;
    const res = await fetch("/api/v1/ai/knowledge/collections", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name }),
    });
    const json = (await res.json()) as { data?: { colecao?: Colecao }; error?: { message?: string } };
    if (!res.ok) {
      toast.error(json.error?.message ?? "Não consegui criar a coleção.");
      return;
    }
    if (json.data?.colecao) setColecoes((c) => [...c, json.data!.colecao!]);
    setNomeNova("");
  }

  async function vincular(sourceId: string, collectionId: string, ligado: boolean) {
    const atual = docs.find((d) => d.id === sourceId);
    const ids = new Set(idsDeColecaoDoMeta(atual?.source_metadata));
    if (ligado) ids.add(collectionId);
    else ids.delete(collectionId);
    const res = await fetch(`/api/v1/ai/knowledge/sources/${sourceId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ collection_ids: [...ids] }),
    });
    if (!res.ok) {
      toast.error("Não consegui atualizar a coleção.");
      return;
    }
    await refetch();
  }

  async function salvarAgente(ids: string[]) {
    const res = await fetch(`/api/v1/ai/agents/${agentId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ config: { knowledge_collection_ids: ids } }),
    });
    if (!res.ok) {
      toast.error("Não consegui salvar o escopo do assistente (precisa ser admin).");
      return;
    }
    toast.success("Este assistente agora consulta só as coleções marcadas.");
  }

  return (
    <div className="space-y-6">
      <FormSection
        testid="conhecimento-colecoes"
        titulo="Coleções"
        descricao="Organize o mesmo conhecimento em grupos. O assistente só consulta o que você marcar."
      >
        <div className="flex flex-wrap gap-2">
          {colecoes.map((c) => (
            <span
              key={c.id}
              data-testid={`colecao-${c.slug}`}
              className="rounded-full bg-[var(--color-surface)] px-3 py-1 text-sm ring-1 ring-[var(--color-border)]"
            >
              {c.name}
            </span>
          ))}
        </div>
        <div className="flex gap-2">
          <input
            data-testid="colecao-nova-nome"
            className="min-h-10 flex-1 rounded-[10px] border border-[var(--color-border)] bg-[var(--color-bg)] px-3 text-sm"
            placeholder="Nova coleção"
            value={nomeNova}
            onChange={(e) => setNomeNova(e.target.value)}
          />
          <Button type="button" size="sm" onClick={() => void criar()}>
            Criar
          </Button>
        </div>
      </FormSection>

      <FormSection titulo="Documentos nas coleções" descricao="Um documento pode estar em mais de uma.">
        <ul className="space-y-3" data-testid="colecoes-vinculos">
          {docs.map((d) => {
            const nome =
              (typeof d.source_metadata.filename === "string" && d.source_metadata.filename) || d.name;
            const atuais = new Set(idsDeColecaoDoMeta(d.source_metadata));
            return (
              <li key={d.id} className="rounded-[12px] bg-[var(--color-surface)] p-3 ring-1 ring-[var(--color-border)]">
                <p className="text-sm font-medium">{nome}</p>
                <div className="mt-2 flex flex-wrap gap-3">
                  {colecoes.map((c) => (
                    <label key={c.id} className="flex items-center gap-1.5 text-sm">
                      <input
                        type="checkbox"
                        defaultChecked={atuais.has(c.id)}
                        onChange={(e) => void vincular(d.id, c.id, e.target.checked)}
                      />
                      {c.name}
                    </label>
                  ))}
                </div>
              </li>
            );
          })}
        </ul>
      </FormSection>

      <FormSection
        testid="assistente-colecoes"
        titulo="Conhecimento permitido neste assistente"
        descricao="Nenhuma marcada = vê tudo (como hoje). Marque para restringir."
      >
        <div className="flex flex-wrap gap-3">
          {colecoes.map((c) => (
            <label key={c.id} className="flex items-center gap-1.5 text-sm">
              <input type="checkbox" data-testid={`agente-colecao-${c.slug}`} className="agente-colecao" value={c.id} />
              {c.name}
            </label>
          ))}
        </div>
        <Button
          type="button"
          size="sm"
          className="mt-3"
          data-testid="salvar-colecoes-agente"
          onClick={() => {
            const ids = Array.from(document.querySelectorAll<HTMLInputElement>(".agente-colecao:checked")).map(
              (el) => el.value,
            );
            void salvarAgente(ids);
          }}
        >
          Salvar escopo do assistente
        </Button>
      </FormSection>
    </div>
  );
}
