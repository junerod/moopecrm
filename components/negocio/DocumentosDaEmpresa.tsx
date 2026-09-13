"use client";

import { useRef, useState } from "react";
import { toast } from "sonner";

import { AppIcon } from "@/components/ds/AppIcon";
import { EmptyState } from "@/components/ds/EmptyState";
import { FormSection } from "@/components/ds/FormSection";
import { StatusBadge } from "@/components/ds/StatusBadge";
import { Button } from "@/components/ui/button";
import {
  rotuloDoStatus,
  statusDoDocumento,
  type StatusDocumento,
} from "@/lib/ai/knowledge/status-do-documento";
import { ehDocumentoArquivado } from "@/lib/ai/knowledge/metadado-publico";
import type { TomDs } from "@/lib/design-system/tones";
import { DotsThree, FileText, Trash, UploadSimple } from "@/lib/ui/icons";
import {
  useArquivarSource,
  useKnowledgeSources,
  useReindexSource,
  type SourceRow,
} from "@/hooks/ai/useKnowledgeSources";

function tomDoStatus(s: StatusDocumento): TomDs {
  if (s === "pronto") return "green";
  if (s === "erro") return "red";
  if (s === "enviando" || s === "ocr") return "blue";
  return "amber";
}

function tipoDoArquivo(nome: string, mime?: unknown): string {
  const ext = nome.split(".").pop()?.toLowerCase();
  if (ext === "pdf" || mime === "application/pdf") return "PDF";
  if (ext === "docx" || String(mime ?? "").includes("wordprocessingml")) return "DOCX";
  if (ext === "md") return "MD";
  if (ext === "txt") return "TXT";
  return "Arquivo";
}

function formatarBytes(n: unknown): string {
  const v = typeof n === "number" ? n : Number(n);
  if (!Number.isFinite(v) || v <= 0) return "—";
  if (v < 1024) return `${v} B`;
  if (v < 1024 * 1024) return `${(v / 1024).toFixed(1)} KB`;
  return `${(v / (1024 * 1024)).toFixed(1)} MB`;
}

function formatarData(iso: string): string {
  return new Date(iso).toLocaleDateString("pt-BR", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

function ehDocumento(s: SourceRow): boolean {
  return s.source_type === "policy" && ehDocumentoArquivado(s.source_metadata) && s.status !== "archived";
}

export function DocumentosDaEmpresa({
  agentId,
  initialSources,
  onTestar,
}: {
  agentId: string;
  initialSources?: SourceRow[];
  onTestar?: (nome: string) => void;
}) {
  const { data: sources, refetch } = useKnowledgeSources(agentId, {
    initialData: initialSources,
  });
  const reindex = useReindexSource(agentId);
  const arquivar = useArquivarSource(agentId);
  const inputRef = useRef<HTMLInputElement>(null);
  const [arrastando, setArrastando] = useState(false);
  const [enviando, setEnviando] = useState<string | null>(null);
  const [menuAberto, setMenuAberto] = useState<string | null>(null);

  const docs = (sources ?? []).filter(ehDocumento);

  async function enviar(files: FileList | File[]) {
    const lista = Array.from(files);
    for (const file of lista) {
      setEnviando(file.name);
      try {
        const fd = new FormData();
        fd.set("file", file);
        fd.set("agent_id", agentId);
        fd.set("name", file.name.slice(0, 120) || "Documento");
        const res = await fetch("/api/v1/ai/knowledge/sources/upload", {
          method: "POST",
          body: fd,
        });
        const json = (await res.json()) as {
          error?: { message?: string };
          data?: { extract_status?: string; message?: string };
        };
        if (!res.ok) {
          toast.error(json.error?.message ?? "Não consegui enviar o arquivo.");
          continue;
        }
        if (json.data?.extract_status === "needs_ocr") {
          toast.warning(json.data.message ?? "Este PDF parece ser digitalizado.");
        } else {
          toast.success("Documento enviado. Estamos indexando.");
        }
        await refetch();
      } catch {
        toast.error("Não consegui falar com o servidor.");
      } finally {
        setEnviando(null);
      }
    }
  }

  return (
    <FormSection
      testid="conhecimento-documentos"
      titulo="Adicione documentos da sua empresa"
      descricao="Catálogos, apresentações, políticas, manuais, tabelas de preços, perguntas frequentes e outros materiais podem alimentar a base de conhecimento."
    >
      <label
        data-testid="conhecimento-dropzone"
        className={`flex cursor-pointer flex-col items-center justify-center gap-2 rounded-[12px] border border-dashed px-4 py-10 text-center transition-colors ${
          arrastando
            ? "border-[var(--moope-primary)] bg-[var(--moope-primary-bg)]"
            : "border-[var(--color-border)] bg-[var(--color-bg)]"
        }`}
        onDragOver={(e) => {
          e.preventDefault();
          setArrastando(true);
        }}
        onDragLeave={() => setArrastando(false)}
        onDrop={(e) => {
          e.preventDefault();
          setArrastando(false);
          if (e.dataTransfer.files.length) void enviar(e.dataTransfer.files);
        }}
      >
        <AppIcon icon={UploadSimple} tone="blue" size="lg" />
        <p className="text-sm font-medium text-[var(--color-text)]">
          {enviando ? `Enviando ${enviando}…` : "Arraste arquivos aqui"}
        </p>
        <p className="text-xs text-[var(--color-text-muted)]">ou</p>
        <Button
          type="button"
          size="sm"
          variant="outline"
          onClick={(e) => {
            e.preventDefault();
            inputRef.current?.click();
          }}
        >
          Selecionar arquivos
        </Button>
        <p className="text-xs text-[var(--color-text-muted)]">PDF, DOCX, Markdown ou TXT · até 20 MB</p>
        <input
          ref={inputRef}
          data-testid="conhecimento-upload-input"
          type="file"
          accept=".pdf,.docx,.md,.txt,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document,text/markdown,text/plain"
          className="sr-only"
          multiple
          onChange={(e) => {
            if (e.target.files?.length) void enviar(e.target.files);
            e.target.value = "";
          }}
        />
      </label>

      {docs.length === 0 && !enviando ? (
        <EmptyState
          icon={FileText}
          tone="amber"
          titulo="Nenhum documento ainda"
          frase="Envie um PDF com políticas, preços ou o manual da empresa."
        />
      ) : (
        <ul className="space-y-2" data-testid="conhecimento-lista-documentos">
          {enviando ? (
            <li className="flex items-center gap-3 rounded-[12px] bg-[var(--color-surface)] px-3 py-3 ring-1 ring-[var(--color-border)]">
              <AppIcon icon={FileText} tone="blue" size="sm" />
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium">{enviando}</p>
                <StatusBadge tone="blue">Enviando</StatusBadge>
              </div>
            </li>
          ) : null}
          {docs.map((d) => {
            const st = statusDoDocumento({
              ...d,
              source_metadata: d.source_metadata,
            });
            const nome =
              (typeof d.source_metadata.filename === "string" && d.source_metadata.filename) ||
              d.name ||
              "Documento";
            const tipo = tipoDoArquivo(nome, d.source_metadata.mime_type);
            return (
              <li
                key={d.id}
                data-testid={`conhecimento-doc-${d.id}`}
                data-status={st}
                className="flex items-start gap-3 rounded-[12px] bg-[var(--color-surface)] px-3 py-3 ring-1 ring-[var(--color-border)]"
              >
                <AppIcon icon={FileText} tone="amber" size="sm" />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium text-[var(--color-text)]">{nome}</p>
                  <p className="text-xs text-[var(--color-text-muted)]">
                    {tipo} · {formatarBytes(d.source_metadata.size_bytes)} · {formatarData(d.created_at)}
                  </p>
                  <div className="mt-1 flex flex-wrap items-center gap-2">
                    <StatusBadge tone={tomDoStatus(st)}>{rotuloDoStatus(st)}</StatusBadge>
                    {st === "pronto" ? (
                      <span className="text-xs text-[var(--color-text-muted)]">
                        {d.chunks_count} trechos disponíveis para a IA
                      </span>
                    ) : null}
                    {(st === "erro" || st === "ocr_necessario") && d.last_index_error ? (
                      <span className="text-xs text-[var(--color-error-fg)]">{d.last_index_error}</span>
                    ) : null}
                  </div>
                </div>
                <div className="relative shrink-0">
                  <Button
                    type="button"
                    size="icon"
                    variant="ghost"
                    aria-label="Ações do documento"
                    onClick={() => setMenuAberto(menuAberto === d.id ? null : d.id)}
                  >
                    <DotsThree />
                  </Button>
                  {menuAberto === d.id ? (
                    <div className="absolute right-0 z-10 mt-1 w-40 rounded-[12px] bg-[var(--color-surface)] p-1 shadow-[var(--shadow-md)] ring-1 ring-[var(--color-border)]">
                      <button
                        type="button"
                        className="block w-full rounded-md px-2 py-1.5 text-left text-sm hover:bg-[var(--color-bg)]"
                        onClick={() => {
                          setMenuAberto(null);
                          onTestar?.(nome);
                        }}
                      >
                        Testar
                      </button>
                      <button
                        type="button"
                        className="block w-full rounded-md px-2 py-1.5 text-left text-sm hover:bg-[var(--color-bg)]"
                        onClick={() => {
                          setMenuAberto(null);
                          reindex.mutate(d.id);
                        }}
                      >
                        Reprocessar
                      </button>
                      <button
                        type="button"
                        className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-sm text-[var(--color-error-fg)] hover:bg-[var(--color-bg)]"
                        onClick={() => {
                          setMenuAberto(null);
                          arquivar.mutate(d.id);
                        }}
                      >
                        <Trash className="size-3.5" />
                        Excluir
                      </button>
                    </div>
                  ) : null}
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </FormSection>
  );
}
