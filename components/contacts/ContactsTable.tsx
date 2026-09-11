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
import { rotuloDoContato } from "@/lib/contacts/rotulo-do-contato";
import { ROTULO_DO_PAPEL, ehPapelDoContato } from "@/lib/crm/papel-e-temperatura";
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

function iniciais(nome: string): string {
  const parts = nome.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  if (parts.length === 1) return (parts[0] ?? "").slice(0, 2).toUpperCase();
  return `${parts[0]?.[0] ?? ""}${parts[parts.length - 1]?.[0] ?? ""}`.toUpperCase();
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
          const papel = ehPapelDoContato(c.papel) ? ROTULO_DO_PAPEL[c.papel] : null;
          const meta = [
            papel,
            c.is_blocked ? "Bloqueado" : null,
            c.is_anonymized ? "Anonimizado" : null,
          ]
            .filter(Boolean)
            .join(" · ");
          return (
            <li key={c.id}>
              <div className="flex items-start gap-3 px-3 py-3 hover:bg-muted/40">
                <Avatar className="mt-0.5 h-9 w-9 shrink-0">
                  <AvatarFallback className="text-xs">{iniciais(nome)}</AvatarFallback>
                </Avatar>
                <Link href={`/app/contacts/${c.id}`} className="min-w-0 flex-1">
                  <div className="truncate text-base font-semibold leading-tight">{nome}</div>
                  <div className="mt-0.5 truncate text-sm text-muted-foreground">
                    {[c.email, c.phone_number].filter(Boolean).join(" · ") || "Sem email ou telefone"}
                  </div>
                  {meta ? (
                    <div className="mt-0.5 truncate text-xs text-muted-foreground">{meta}</div>
                  ) : null}
                  <div className="mt-0.5 text-xs text-muted-foreground">
                    {c.last_activity_at
                      ? `Último contato ${formatUltimaAtividade(c.last_activity_at)}`
                      : "Sem atividade recente"}
                  </div>
                </Link>
                <div className="flex shrink-0 items-center gap-1">
                  {c.conversa ? (
                    <Button asChild size="sm" variant="default" className="min-h-11 px-3 md:min-h-8">
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
