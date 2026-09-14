import Link from "next/link";

import { Button } from "@/components/ui/button";
import type { ChecklistDoPack } from "@/lib/business-packs/checklist";

const ATALHOS = [
  { href: "/app/ai/agents", label: "Ver assistentes" },
  { href: "/app/ai/knowledge/sources", label: "Adicionar conhecimento" },
  { href: "/app/connections", label: "Conectar WhatsApp" },
  { href: "/app/ai/followups", label: "Ver automações" },
] as const;

export function ChecklistPosAtivacao({ checklist }: { checklist: ChecklistDoPack }) {
  const proximo = checklist.itens.find((i) => !i.feito);

  return (
    <section
      className="space-y-4 rounded-[16px] border border-[var(--color-border)] bg-[var(--color-surface)] p-5"
      data-testid="checklist-pos-ativacao"
    >
      <div>
        <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
          Pack ativo
        </p>
        <h2 className="mt-1 text-lg font-semibold tracking-tight">{checklist.packLabel}</h2>
        {checklist.pronto ? (
          <p className="mt-1 text-sm font-medium text-emerald-700 dark:text-emerald-400" data-testid="checklist-pronto">
            Pronto para trabalhar
          </p>
        ) : (
          <p className="mt-1 text-sm text-muted-foreground">Prepare sua empresa para começar</p>
        )}
        <p className="mt-1 text-sm font-medium" data-testid="checklist-progresso">
          {checklist.concluidos} de {checklist.total} concluídos
        </p>
      </div>

      <ol className="space-y-3">
        {checklist.itens.map((item) => (
          <li key={item.id} className="flex flex-col gap-1 sm:flex-row sm:items-start sm:justify-between" data-testid={`checklist-item-${item.id}`}>
            <div>
              <p className="text-sm font-medium">
                <span aria-hidden className="mr-2">
                  {item.feito ? "✓" : "○"}
                </span>
                {item.titulo}
              </p>
              <p className="pl-6 text-sm text-muted-foreground">{item.descricao}</p>
              <p className="pl-6 text-xs text-muted-foreground" data-testid={`checklist-status-${item.id}`}>
                {item.status}
              </p>
            </div>
            {!item.feito ? (
              <Button asChild size="sm" variant="outline">
                <Link href={item.href}>{item.cta}</Link>
              </Button>
            ) : null}
          </li>
        ))}
      </ol>

      <nav aria-label="Ações rápidas" className="flex flex-wrap gap-2">
        {ATALHOS.map((a) => (
          <Button key={a.href} asChild variant="outline" size="sm">
            <Link href={a.href}>{a.label}</Link>
          </Button>
        ))}
        {proximo ? (
          <Button asChild size="sm" data-testid="checklist-continuar">
            <Link href={proximo.href}>Continuar configuração</Link>
          </Button>
        ) : null}
      </nav>
    </section>
  );
}
