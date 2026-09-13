"use client";

import Link from "next/link";

import { Button } from "@/components/ui/button";
import { usePackDoWizard } from "@/app/onboarding/_components/PackDoWizard";
import { passoAnterior } from "@/lib/onboarding/passos";
import { CaretLeft } from "@/lib/ui/icons";

/**
 * Volta um passo. O segmento vem da TELA, não da URL: no passo 5 o
 * pathname às vezes ainda era o do 6, e o botão sumia.
 *
 * Mesmo tamanho e peso do "Pular" — os dois ficam na mesma linha.
 */
export function VoltarDoPasso({
  segmento,
  packId,
}: {
  segmento: string;
  packId?: string | null;
}) {
  const doWizard = usePackDoWizard();
  const anterior = passoAnterior(segmento, {
    lojaLigada: false,
    packId: packId ?? doWizard,
  });
  if (!anterior) return null;

  return (
    <Button asChild type="button" variant="ghost">
      <Link href={`/onboarding/${anterior.segmento}`} className="inline-flex items-center gap-1">
        <CaretLeft size={16} aria-hidden />
        Voltar
      </Link>
    </Button>
  );
}

/** Rodapé único: Voltar + Pular à esquerda, avançar à direita. */
export function AcoesDoPasso({
  segmento,
  pular,
  avancar,
  packId,
}: {
  segmento: string;
  pular?: React.ReactNode;
  avancar?: React.ReactNode;
  packId?: string | null;
}) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-2 pt-2">
      <div className="flex flex-wrap items-center gap-2">
        <VoltarDoPasso segmento={segmento} packId={packId} />
        {pular}
      </div>
      {avancar}
    </div>
  );
}
