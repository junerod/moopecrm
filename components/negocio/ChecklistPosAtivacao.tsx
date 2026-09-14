import Link from "next/link";

import { Button } from "@/components/ui/button";
import type { ChecklistDoPack } from "@/lib/business-packs/checklist";
import { Check, ArrowRight } from "@/lib/ui/icons";
import { cn } from "@/lib/utils";

export function ChecklistPosAtivacao({ checklist }: { checklist: ChecklistDoPack }) {
  const proximo = checklist.itens.find((i) => !i.feito);
  const pct = Math.round((checklist.concluidos / checklist.total) * 100);

  return (
    <section
      className="overflow-hidden rounded-2xl bg-[var(--color-surface)] shadow-[var(--shadow-sm)] ring-1 ring-[var(--color-border)]"
      data-testid="checklist-pos-ativacao"
    >
      <div className="flex flex-wrap items-end justify-between gap-3 px-5 pt-5">
        <div className="min-w-0">
          <p className="text-[11px] font-medium uppercase tracking-[0.16em] text-[var(--color-text-muted)]">
            {checklist.pronto ? "Operação no ar" : "Falta pouco"}
          </p>
          <h2 className="mt-1 text-lg font-semibold tracking-tight text-[var(--color-text)]">
            {checklist.packLabel}
          </h2>
          {checklist.pronto ? (
            <p
              className="mt-1 text-sm font-medium text-emerald-700 dark:text-emerald-400"
              data-testid="checklist-pronto"
            >
              Pronto para trabalhar
            </p>
          ) : (
            <p className="mt-1 text-sm text-[var(--color-text-muted)]">
              Prepare sua empresa para começar
            </p>
          )}
        </div>
        <p
          className="tabular-nums text-2xl font-semibold tracking-tight text-[var(--color-text)]"
          data-testid="checklist-progresso"
        >
          {checklist.concluidos} de {checklist.total}
        </p>
      </div>

      <div className="mx-5 mt-4 h-1.5 overflow-hidden rounded-full bg-[var(--color-accent-soft)]">
        <div
          className="h-full rounded-full bg-[var(--color-accent)] transition-[width] duration-300"
          style={{ width: `${pct}%` }}
        />
      </div>

      <ol className="grid gap-px border-t border-[var(--color-border)] bg-[var(--color-border)] sm:grid-cols-4">
        {checklist.itens.map((item, i) => {
          const ehProximo = proximo?.id === item.id;
          return (
            <li
              key={item.id}
              data-testid={`checklist-item-${item.id}`}
              className={cn(
                "bg-[var(--color-surface)] px-4 py-4",
                ehProximo && "bg-[color-mix(in_srgb,var(--color-accent-soft)_55%,var(--color-surface))]",
              )}
            >
              <div className="flex items-start gap-2.5">
                <span
                  aria-hidden
                  className={cn(
                    "mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-[11px] font-semibold",
                    item.feito
                      ? "bg-emerald-600 text-white"
                      : ehProximo
                        ? "bg-[var(--color-accent)] text-white"
                        : "bg-[var(--color-accent-soft)] text-[var(--color-text-muted)]",
                  )}
                >
                  {item.feito ? <Check size={13} weight="bold" /> : i + 1}
                </span>
                <div className="min-w-0">
                  <p className="text-sm font-medium text-[var(--color-text)]">{item.titulo}</p>
                  <p
                    className="mt-0.5 text-xs text-[var(--color-text-muted)]"
                    data-testid={`checklist-status-${item.id}`}
                  >
                    {item.status}
                  </p>
                  {!item.feito ? (
                    <p className="mt-1 text-xs leading-5 text-[var(--color-text-muted)]">{item.descricao}</p>
                  ) : null}
                  {!item.feito ? (
                    <Button asChild size="sm" variant={ehProximo ? "default" : "outline"} className="mt-3">
                      <Link href={item.href}>{item.cta}</Link>
                    </Button>
                  ) : null}
                </div>
              </div>
            </li>
          );
        })}
      </ol>

      {proximo ? (
        <div className="flex justify-end border-t border-[var(--color-border)] px-5 py-3">
          <Button asChild size="sm" data-testid="checklist-continuar">
            <Link href={proximo.href} className="inline-flex items-center gap-1.5">
              Continuar configuração
              <ArrowRight size={14} />
            </Link>
          </Button>
        </div>
      ) : null}
    </section>
  );
}
