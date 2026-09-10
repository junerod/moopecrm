"use client";

import Link from "next/link";
import { useState } from "react";

import { Card } from "@/components/ui/card";

export interface ItemDoChecklist {
  id: string;
  label: string;
  feito: boolean;
  href: string;
}

export function ChecklistPrimeirosPassos({
  itens,
  recolhidoInicial,
}: {
  itens: ItemDoChecklist[];
  recolhidoInicial?: boolean;
}) {
  const feitos = itens.filter((i) => i.feito).length;
  const completo = feitos === itens.length && itens.length > 0;
  const [aberto, setAberto] = useState(!(recolhidoInicial ?? completo));

  return (
    <Card className="p-4" data-testid="checklist-primeiros-passos">
      <button
        type="button"
        className="flex w-full items-center justify-between gap-3 text-left"
        onClick={() => setAberto((v) => !v)}
        aria-expanded={aberto}
      >
        <span>
          <span className="block text-sm font-semibold">Configure seu CRM</span>
          <span className="text-xs text-muted-foreground">
            {feitos} de {itens.length} concluídos
          </span>
        </span>
        <span className="text-xs text-muted-foreground">{aberto ? "Recolher" : "Mostrar"}</span>
      </button>
      {aberto ? (
        <ul className="mt-3 space-y-2">
          {itens.map((item) => (
            <li key={item.id}>
              <Link
                href={item.href}
                data-testid={`checklist-${item.id}`}
                data-feito={item.feito ? "sim" : "nao"}
                className="flex items-center gap-2 rounded-md px-1 py-1 text-sm hover:bg-muted/50"
              >
                <span aria-hidden>{item.feito ? "☑" : "☐"}</span>
                <span className={item.feito ? "text-muted-foreground line-through" : ""}>
                  {item.label}
                </span>
              </Link>
            </li>
          ))}
        </ul>
      ) : null}
    </Card>
  );
}
