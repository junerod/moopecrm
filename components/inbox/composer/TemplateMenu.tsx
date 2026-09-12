"use client";
import Link from "next/link";
import type { MessageTemplate } from "@/hooks/inbox/useMessageTemplates";

/** Estado do slash-menu a partir do texto do composer. Puro (testável). */
export function resolveSlash(text: string): { open: boolean; query: string } {
  if (!text.startsWith("/")) return { open: false, query: "" };
  const rest = text.slice(1);
  if (/\s/.test(rest)) return { open: false, query: "" };
  return { open: true, query: rest };
}

/**
 * Depois de escolher um template o menu some (`menuDismissed`). Um "/" novo
 * precisa reabrir — senão o atalho morre até o atendente apagar o texto.
 */
export function deveReabrirMenuSlash(textoAntes: string, textoDepois: string): boolean {
  if (!resolveSlash(textoDepois).open) return true;
  return !resolveSlash(textoAntes).open;
}

interface Props {
  open: boolean;
  query: string;
  templates: MessageTemplate[];
  onPick: (t: MessageTemplate) => void;
  onClose: () => void;
  busca?: boolean;
  onBusca?: (q: string) => void;
}

export function TemplateMenu({
  open,
  query,
  templates,
  onPick,
  onClose: _onClose,
  busca,
  onBusca,
}: Props) {
  if (!open) return null;
  const q = query.toLowerCase();
  const filtered = templates.filter(
    (t) => t.title.toLowerCase().includes(q) || (t.shortcut ?? "").toLowerCase().includes(q),
  );
  return (
    <div
      className="absolute bottom-14 left-3 z-20 max-h-64 w-80 overflow-y-auto rounded-lg border border-border bg-popover p-1 shadow-lg"
      role="listbox"
      aria-label="Respostas rápidas"
      data-testid="quick-replies-menu"
    >
      {busca ? (
        <input
          value={query}
          onChange={(e) => onBusca?.(e.target.value)}
          placeholder="Buscar resposta rápida…"
          className="mb-1 w-full rounded-md border border-input bg-background px-2 py-1.5 text-sm"
          autoFocus
          data-testid="quick-replies-search"
        />
      ) : null}
      {filtered.length === 0 ? (
        <div className="px-3 py-2 text-xs text-muted-foreground">
          Nenhuma resposta rápida.{" "}
          <Link href="/app/templates" className="underline">
            Administrar modelos
          </Link>
        </div>
      ) : (
        filtered.map((t) => (
          <button
            key={t.id}
            type="button"
            className="flex w-full flex-col items-start gap-0.5 rounded-md px-3 py-2 text-left hover:bg-muted"
            onClick={() => onPick(t)}
          >
            <span className="text-sm font-medium">{t.title}</span>
            <span className="line-clamp-1 text-xs text-muted-foreground">{t.body}</span>
          </button>
        ))
      )}
    </div>
  );
}
