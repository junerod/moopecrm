"use client";

import { useEffect } from "react";

import { Button } from "@/components/ui/button";
import { ManualDoOperador } from "@/app/app/manual/_client";
import { rotuloDaTela } from "@/lib/manual/porta";
import { CaretLeft } from "@/lib/ui/icons";

export function PainelDoManual({
  capitulo,
  pathname,
  collapsed,
  onVoltar,
}: {
  capitulo: string;
  pathname: string;
  collapsed?: boolean;
  onVoltar: () => void;
}) {
  useEffect(() => {
    function tecla(e: KeyboardEvent) {
      if (e.key === "Escape") onVoltar();
    }
    window.addEventListener("keydown", tecla);
    return () => window.removeEventListener("keydown", tecla);
  }, [onVoltar]);

  const destino = rotuloDaTela(pathname);

  return (
    <div className="contents" data-testid="painel-do-manual">
      <button
        type="button"
        aria-label={`Fechar o guia e voltar para ${destino}`}
        className={collapsed ? "fixed inset-0 z-40 bg-black/35 md:left-16" : "fixed inset-0 z-40 bg-black/35 md:left-56"}
        data-testid="manual-fundo"
        onClick={onVoltar}
      />
      <aside
        role="dialog"
        aria-modal="true"
        aria-labelledby="manual-titulo-painel"
        className="fixed inset-y-0 right-0 z-50 flex w-full max-w-xl flex-col bg-[var(--color-bg)] shadow-[-16px_0_40px_rgba(0,0,0,0.18)] ring-1 ring-[var(--color-border)] md:max-w-2xl"
      >
        <div className="flex shrink-0 items-center justify-between gap-3 border-b border-[var(--color-border)] bg-[var(--color-surface)] px-4 py-3">
          <Button type="button" variant="outline" size="sm" data-testid="manual-voltar" onClick={onVoltar}>
            <CaretLeft size={14} aria-hidden className="mr-1" />
            Voltar para {destino}
          </Button>
          <p id="manual-titulo-painel" className="text-sm font-medium text-[var(--color-text-muted)]">
            Guia
          </p>
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto">
          <ManualDoOperador capituloInicial={capitulo} compacto onVoltar={onVoltar} />
        </div>
      </aside>
    </div>
  );
}
