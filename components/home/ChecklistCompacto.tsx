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
      <div className="inline-flex items-center gap-2 rounded-full bg-[var(--color-surface)] px-3 py-1.5 text-[12px] shadow-[var(--shadow-xs)] ring-1 ring-[var(--color-border)]">
        <Link href="/app/settings/business" className="hover:underline">
          Configuração {feitos}/{itens.length} concluída
        </Link>
        <span className="hidden h-1.5 w-16 overflow-hidden rounded-full bg-[var(--color-surface-elevated)] sm:block" aria-hidden>
          <span
            className="block h-full bg-[var(--moope-primary)]"
            style={{ width: `${itens.length ? (feitos / itens.length) * 100 : 0}%` }}
          />
        </span>
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
          className="font-medium text-[var(--moope-primary)] hover:underline"
        >
          Continuar
        </Link>
      </div>
      <ul hidden={!aberto} className="space-y-1 rounded-lg bg-[var(--color-surface)] px-3 py-2 shadow-[var(--shadow-sm)] ring-1 ring-[var(--color-border)]">
        {itens.map((item) => (
          <li key={item.id}>
            <Link
              href={item.href}
              data-testid={`checklist-${item.id}`}
              data-feito={item.feito ? "sim" : "nao"}
              className="flex items-center gap-2 text-[13px] hover:text-[var(--moope-primary)]"
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
