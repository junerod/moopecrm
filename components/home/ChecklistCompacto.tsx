"use client";

import Link from "next/link";
import { useState } from "react";

export interface ItemDoSetup {
  id: string;
  label: string;
  feito: boolean;
  href: string;
}

export function ChecklistCompacto({ itens }: { itens: ItemDoSetup[] }) {
  const feitos = itens.filter((i) => i.feito).length;
  const [aberto, setAberto] = useState(false);

  return (
    <div data-testid="checklist-primeiros-passos" className="inline-flex max-w-full flex-col gap-1">
      <div className="inline-flex items-center gap-2 rounded-full bg-[var(--color-surface-elevated)] px-3 py-1.5 text-[12px] ring-1 ring-white/[0.06]">
        <Link href="/app/settings/business" className="hover:underline">
          Configuração {feitos}/{itens.length} concluída
        </Link>
        <button
          type="button"
          className="text-[var(--color-text-muted)] hover:underline"
          onClick={() => setAberto((v) => !v)}
          aria-expanded={aberto}
        >
          {aberto ? "Recolher" : "Itens"}
        </button>
        <Link
          href="/app/settings/business"
          className="font-medium text-[var(--color-info-fg)] hover:underline"
        >
          Continuar
        </Link>
      </div>
      <ul hidden={!aberto} className="space-y-1 rounded-lg bg-[var(--color-surface)] px-3 py-2">
        {itens.map((item) => (
          <li key={item.id}>
            <Link
              href={item.href}
              data-testid={`checklist-${item.id}`}
              data-feito={item.feito ? "sim" : "nao"}
              className="flex items-center gap-2 text-[13px] hover:text-[var(--color-info-fg)]"
            >
              <span aria-hidden>{item.feito ? "☑" : "☐"}</span>
              <span className={item.feito ? "text-[var(--color-text-muted)] line-through" : ""}>
                {item.label}
              </span>
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}
