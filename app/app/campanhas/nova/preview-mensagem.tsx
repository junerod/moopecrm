"use client";

import { Button } from "@/components/ui/button";
import type { AnexoDaCampanha } from "@/lib/campanhas/tipos";

export function PreviewMensagem({
  texto,
  aba,
  onAba,
  ok,
  anexos,
  previews,
  ctaLabel,
}: {
  texto: string;
  aba: "whatsapp" | "email";
  onAba: (a: "whatsapp" | "email") => void;
  ok: boolean;
  anexos: AnexoDaCampanha[];
  previews: Record<string, string>;
  ctaLabel?: string;
}) {
  const midia = anexos[0];
  const url = midia ? previews[midia.storage_path] : undefined;

  return (
    <div>
      <div className="mb-2 flex gap-2">
        <Button
          type="button"
          size="sm"
          variant={aba === "whatsapp" ? "default" : "outline"}
          onClick={() => onAba("whatsapp")}
        >
          WhatsApp
        </Button>
        <Button
          type="button"
          size="sm"
          variant={aba === "email" ? "default" : "outline"}
          onClick={() => onAba("email")}
        >
          E-mail
        </Button>
      </div>
      <p className="mb-2 text-xs text-[var(--color-text-muted)]">
        Assim a mensagem chega — prévia com dados fictícios (Maria)
      </p>
      {aba === "whatsapp" ? (
        <div className="rounded-[28px] bg-[#0b141a] p-3 shadow-[var(--shadow-md)]">
          <div className="mb-2 px-2 text-[11px] text-white/50">hoje</div>
          <blockquote
            className="max-w-[92%] rounded-2xl rounded-tl-sm bg-[#005c4b] p-3 text-sm text-white"
            data-testid="campanha-preview"
            data-ok={ok ? "1" : "0"}
          >
            {url && midia?.kind === "image" ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={url}
                alt={midia.filename}
                className="mb-2 max-h-40 w-full rounded-lg object-cover"
              />
            ) : null}
            {midia && midia.kind !== "image" ? (
              <p className="mb-2 text-xs text-white/80">
                {midia.kind === "video" ? "Vídeo" : "Documento"} · {midia.filename}
              </p>
            ) : null}
            <span data-testid="campanha-preview-whatsapp" className="whitespace-pre-wrap">
              {texto}
            </span>
            {ctaLabel ? (
              <span className="mt-2 block rounded-lg bg-white/10 px-2 py-1 text-center text-xs">
                {ctaLabel}
              </span>
            ) : null}
          </blockquote>
        </div>
      ) : (
        <div
          className="rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] p-4 text-sm"
          data-testid="campanha-preview-email"
        >
          <p className="text-[11px] uppercase tracking-wide text-[var(--color-text-muted)]">
            Envelope da organização
          </p>
          {url && midia?.kind === "image" ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={url} alt={midia.filename} className="mt-3 max-h-40 w-full rounded-lg object-cover" />
          ) : null}
          <p className="mt-3 whitespace-pre-wrap text-[var(--color-text)]">{texto}</p>
          {ctaLabel ? (
            <p className="mt-3 text-xs font-medium text-[var(--color-accent)]">{ctaLabel}</p>
          ) : null}
          <p className="mt-4 border-t border-[var(--color-border)] pt-3 text-[11px] text-[var(--color-text-muted)]">
            Se não quiser mais receber, responda SAIR.
          </p>
        </div>
      )}
    </div>
  );
}
