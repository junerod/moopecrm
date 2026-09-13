"use client";
import Link from "next/link";
import { format, formatRelative, isToday, isYesterday } from "date-fns";
import { ptBR } from "date-fns/locale";
import { DotsThree } from "@/lib/ui/icons";
import { ImportarConversaButton } from "@/components/contacts/ImportarConversaButton";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import type { ContactOrderBy } from "@/lib/schemas/contacts";
import type { Contact } from "@/lib/types/contacts";
import { formatarTelefone, iniciaisDoNome } from "@/lib/contacts/formatar-telefone";
import { rotuloDoContato } from "@/lib/contacts/rotulo-do-contato";
import { ROTULO_DO_PAPEL, ehPapelDoContato } from "@/lib/crm/papel-e-temperatura";
import { StatusBadge } from "@/components/ds/StatusBadge";
import { TagChip } from "@/components/ds/TagChip";
import { TOM_DO_PAPEL } from "@/lib/inbox/tom-da-tag";
import { cn } from "@/lib/utils";

interface Props {
  contacts: Contact[];
  orderBy: ContactOrderBy;
  orderDir: "asc" | "desc";
  onSort: (column: ContactOrderBy) => void;
}

function displayName(c: Contact): string {
  return rotuloDoContato(c);
}

function formatUltimaAtividade(iso: string, now = new Date()): string {
  const d = new Date(iso);
  if (isToday(d) || isYesterday(d)) {
    return formatRelative(d, now, { locale: ptBR });
  }
  return format(d, "dd/MM/yyyy", { locale: ptBR });
}

const ORDEM: Array<{ coluna: ContactOrderBy; label: string }> = [
  { coluna: "display_name", label: "Nome" },
  { coluna: "last_activity_at", label: "Última atividade" },
  { coluna: "email", label: "Email" },
  { coluna: "phone_number", label: "Telefone" },
];

export function ContactsTable({ contacts, orderBy, orderDir, onSort }: Props) {
  return (
    <div className="overflow-x-hidden">
      <div className="flex flex-wrap items-center gap-1 border-b border-border/70 px-3 py-2">
        <span className="mr-1 text-xs text-muted-foreground">Ordenar</span>
        {ORDEM.map((o) => {
          const ativo = orderBy === o.coluna;
          return (
            <Button
              key={o.coluna}
              type="button"
              size="sm"
              variant="ghost"
              className={cn("h-8 px-2 text-xs", ativo && "text-foreground")}
              onClick={() => onSort(o.coluna)}
              aria-sort={ativo ? (orderDir === "asc" ? "ascending" : "descending") : "none"}
            >
              {o.label}
              {ativo ? (orderDir === "asc" ? " ↑" : " ↓") : ""}
            </Button>
          );
        })}
      </div>
      <ul className="divide-y divide-border/60">
        {contacts.map((c) => {
          const nome = displayName(c);
          const telefone = formatarTelefone(c.phone_number);
          return (
            <li key={c.id}>
              <div className="flex items-start gap-3 px-3 py-3 hover:bg-[var(--color-surface-elevated)]">
                <Avatar className="mt-0.5 h-9 w-9 shrink-0">
                  <AvatarFallback className="bg-[var(--color-teal-bg)] text-[11px] font-semibold text-[var(--color-teal)]">
                    {iniciaisDoNome(nome)}
                  </AvatarFallback>
                </Avatar>
                <Link href={`/app/contacts/${c.id}`} className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-1.5">
                    <span className="truncate text-sm font-semibold leading-tight text-[var(--color-text)]">
                      {nome}
                    </span>
                    {ehPapelDoContato(c.papel) ? (
                      <StatusBadge tone={TOM_DO_PAPEL[c.papel]} className="h-5 px-1.5 text-[10px]">
                        {ROTULO_DO_PAPEL[c.papel]}
                      </StatusBadge>
                    ) : null}
                    {c.is_blocked ? (
                      <StatusBadge tone="amber" className="h-5 px-1.5 text-[10px]">
                        Bloqueado
                      </StatusBadge>
                    ) : null}
                  </div>
                  <div className="mt-0.5 truncate text-sm tabular-nums text-[var(--color-text-muted)]">
                    {[telefone, c.email].filter(Boolean).join(" · ") || "Sem email ou telefone"}
                  </div>
                  {c.tags.length > 0 ? (
                    <div className="mt-1 flex flex-wrap gap-1">
                      {c.tags.slice(0, 3).map((t) => (
                        <TagChip key={t} label={t} />
                      ))}
                    </div>
                  ) : null}
                  <div className="mt-0.5 text-xs text-[var(--color-text-muted)]">
                    {c.last_activity_at
                      ? `Último contato ${formatUltimaAtividade(c.last_activity_at)}`
                      : "Sem atividade recente"}
                  </div>
                </Link>
                <div className="flex shrink-0 items-center gap-1">
                  {c.conversa ? (
                    <Button asChild size="sm" variant="outline" className="hidden min-h-8 px-3 sm:inline-flex">
                      <Link
                        href={`/app/inbox?id=${c.conversa.id}`}
                        aria-label={`Abrir conversa com ${nome}`}
                      >
                        Abrir conversa
                      </Link>
                    </Button>
                  ) : null}
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button
                        size="sm"
                        variant="ghost"
                        className="min-h-11 min-w-11 px-2 md:min-h-8"
                        aria-label={`Mais ações para ${nome}`}
                      >
                        <DotsThree size={18} weight="bold" aria-hidden />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem asChild>
                        <Link href={`/app/contacts/${c.id}`}>Ver ficha</Link>
                      </DropdownMenuItem>
                      {c.conversa ? (
                        <DropdownMenuItem asChild>
                          <Link href={`/app/inbox?id=${c.conversa.id}`}>Abrir conversa</Link>
                        </DropdownMenuItem>
                      ) : null}
                      <div className="px-1 py-1">
                        <ImportarConversaButton
                          contact={c}
                          compact
                          jaTemFio={Boolean(c.conversa)}
                        />
                      </div>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
              </div>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
