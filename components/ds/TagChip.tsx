"use client";

import type { ReactNode } from "react";

import { X } from "@/lib/ui/icons";
import { ESTILO_DO_TOM, type TomDs } from "@/lib/design-system/tones";
import { tomDaTag } from "@/lib/inbox/tom-da-tag";
import { cn } from "@/lib/utils";

export function TagChip({
  children,
  tone,
  label,
  onRemove,
  onSelect,
  dashed,
  className,
}: {
  children?: ReactNode;
  /** Se omitido e houver `label`, a cor sai do hash estável do nome. */
  tone?: TomDs;
  label?: string;
  onRemove?: () => void;
  onSelect?: () => void;
  dashed?: boolean;
  className?: string;
}) {
  const texto = label ?? (typeof children === "string" ? children : "");
  const tom = tone ?? (texto ? tomDaTag(texto) : "blue");
  const cor = ESTILO_DO_TOM[tom];
  const conteudo = children ?? label;

  const classe = cn(
    "inline-flex h-5 max-w-full items-center gap-0.5 rounded-full px-1.5 text-[10px] font-medium leading-none",
    dashed && "border border-dashed bg-transparent",
    onSelect && "cursor-pointer hover:brightness-[0.97]",
    className,
  );
  const estilo = dashed
    ? { borderColor: cor.fg, color: cor.fg }
    : { background: cor.bg, color: cor.fg };

  const miolo = (
    <>
      <span className="truncate">{conteudo}</span>
      {onRemove ? (
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            onRemove();
          }}
          aria-label={texto ? `Remover tag ${texto}` : "Remover tag"}
          className="rounded-sm hover:opacity-70"
        >
          <X size={10} weight="bold" aria-hidden />
        </button>
      ) : null}
    </>
  );

  if (onSelect) {
    return (
      <button type="button" onClick={onSelect} className={classe} style={estilo}>
        {dashed ? `+ ${conteudo}` : miolo}
      </button>
    );
  }

  return (
    <span className={classe} style={estilo}>
      {miolo}
    </span>
  );
}
