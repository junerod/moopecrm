"use client";
import { useEffect, useMemo, useState, type ReactNode } from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useUser } from "@/hooks/auth/AuthProvider";
import { useAssignableMembers } from "@/hooks/inbox/useAssignableMembers";
import { useAssignableAgents } from "@/hooks/kanban/useAssignableAgents";
import type { Lead, OwnerKind } from "@/lib/types/leads";
import { OwnerBadge } from "./OwnerBadge";
import { ORIGENS_COMERCIAIS, rotuloDaOrigem } from "@/lib/crm/origem-comercial";
import {
  agentOwnerFilter,
  parseAgentOwnerFilter,
  type LeadFilters,
} from "@/lib/kanban/filters";
import { cn } from "@/lib/utils";

interface FilterBarProps {
  filters: LeadFilters;
  onChange: (next: LeadFilters) => void;
  leads: Lead[];
}

const STATUS_OPTIONS: Array<{ value: NonNullable<LeadFilters["status"]>; label: string }> = [
  { value: "all", label: "Todos" },
  { value: "open", label: "Abertos" },
  { value: "won", label: "Ganhos" },
  { value: "lost", label: "Perdidos" },
];

export function FilterBar({ filters, onChange, leads }: FilterBarProps) {
  const user = useUser();
  const { data: members } = useAssignableMembers(true);
  const { data: agents } = useAssignableAgents(true);
  const [searchInput, setSearchInput] = useState(filters.search ?? "");

  // Debounce search 250ms
  useEffect(() => {
    const t = setTimeout(() => {
      if ((filters.search ?? "") !== searchInput) {
        onChange({ ...filters, search: searchInput });
      }
    }, 250);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchInput]);

  const tagOptions = useMemo(() => {
    const set = new Set<string>();
    for (const l of leads) for (const t of l.tags) set.add(t);
    return Array.from(set).sort();
  }, [leads]);

  const filteredAgentId = parseAgentOwnerFilter(filters.owner);

  /**
   * Responsáveis atribuíveis numa lista única — humanos e agentes ordenados
   * juntos. O dono de um lead é UM campo; quem pode ser dono aparece numa lista
   * só. A distinção é geométrica (avatar), nunca posicional.
   */
  const assignees = useMemo(() => {
    type Row = {
      key: string;
      owner: string;
      name: string;
      kind: OwnerKind;
      version: number | null;
    };
    const rows: Row[] = [
      ...(members ?? [])
        .filter((m) => m.user_id !== user.id)
        .map((m) => ({
          key: `u:${m.user_id}`,
          owner: m.user_id,
          name: m.full_name ?? "Sem nome",
          kind: "user" as OwnerKind,
          version: null,
        })),
      ...(agents ?? []).map((a) => ({
        key: `a:${a.agent_id}`,
        owner: agentOwnerFilter(a.agent_id),
        name: a.name,
        kind: "ai" as OwnerKind,
        version: a.version_number,
      })),
    ];
    return rows.sort((x, y) => x.name.localeCompare(y.name, "pt-BR"));
  }, [members, agents, user.id]);
  const ownerLabel =
    filters.owner === "unassigned"
      ? "Sem responsável"
      : !filters.owner || filters.owner === "any"
        ? "Todos"
        : filteredAgentId
          ? (agents?.find((a) => a.agent_id === filteredAgentId)?.name ?? "Agente")
          : filters.owner === user.id
            ? "Eu"
            : (members?.find((m) => m.user_id === filters.owner)?.full_name ??
              "Responsável");

  const statusLabel =
    STATUS_OPTIONS.find((o) => o.value === (filters.status ?? "all"))?.label ?? "Todos";

  const tagLabel = filters.tag ?? "Tag: todas";

  const avancadosAtivos = [
    filters.owner && filters.owner !== "any",
    filters.source,
    filters.status && filters.status !== "all",
    filters.tag,
  ].filter(Boolean).length;

  return (
    <div className="flex flex-wrap items-center gap-1.5 rounded-[12px] bg-[var(--color-surface)] p-2 shadow-[var(--shadow-sm)] ring-1 ring-[var(--color-border)]">
      <Input
        type="search"
        placeholder="Buscar por nome, empresa ou origem…"
        value={searchInput}
        onChange={(e) => setSearchInput(e.target.value)}
        className="h-9 w-full sm:w-64"
      />

      <Chip
        ativo={!!filters.acaoAtrasada}
        onChange={(v) => onChange({ ...filters, acaoAtrasada: v || undefined })}
        testid="filtro-acao-atrasada"
      >
        Atrasadas
      </Chip>
      <Chip
        ativo={!!filters.semProximaAcao}
        onChange={(v) => onChange({ ...filters, semProximaAcao: v || undefined })}
        testid="filtro-sem-proxima-acao"
      >
        Sem próxima ação
      </Chip>
      <Chip
        ativo={!!filters.quentes}
        onChange={(v) => onChange({ ...filters, quentes: v || undefined })}
        testid="filtro-quentes"
      >
        Quentes
      </Chip>

      <details className="w-full md:hidden">
        <summary className="cursor-pointer text-[12px] font-medium text-[var(--color-text-muted)]">
          Filtros{avancadosAtivos ? ` (${avancadosAtivos})` : ""}
        </summary>
        <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
          <FiltrosAvancados
            filters={filters}
            onChange={onChange}
            ownerLabel={ownerLabel}
            statusLabel={statusLabel}
            tagLabel={tagLabel}
            tagOptions={tagOptions}
            assignees={assignees}
            userId={user.id}
            searchInput={searchInput}
            setSearchInput={setSearchInput}
          />
        </div>
      </details>
      <div className="hidden flex-wrap items-center gap-1.5 md:flex">
        <FiltrosAvancados
          filters={filters}
          onChange={onChange}
          ownerLabel={ownerLabel}
          statusLabel={statusLabel}
          tagLabel={tagLabel}
          tagOptions={tagOptions}
          assignees={assignees}
          userId={user.id}
          searchInput={searchInput}
          setSearchInput={setSearchInput}
        />
      </div>
    </div>
  );
}

function FiltrosAvancados({
  filters,
  onChange,
  ownerLabel,
  statusLabel,
  tagLabel,
  tagOptions,
  assignees,
  userId,
  searchInput,
  setSearchInput,
}: {
  filters: LeadFilters;
  onChange: (next: LeadFilters) => void;
  ownerLabel: string;
  statusLabel: string;
  tagLabel: string;
  tagOptions: string[];
  assignees: Array<{
    key: string;
    owner: string;
    name: string;
    kind: OwnerKind;
    version: number | null;
  }>;
  userId: string;
  searchInput: string;
  setSearchInput: (v: string) => void;
}) {
  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="outline" size="sm">Responsável: {ownerLabel}</Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start">
          <DropdownMenuLabel>Responsável</DropdownMenuLabel>
          <DropdownMenuSeparator />
          <DropdownMenuItem onClick={() => onChange({ ...filters, owner: "any" })}>
            Todos
          </DropdownMenuItem>
          <DropdownMenuItem onClick={() => onChange({ ...filters, owner: "unassigned" })}>
            Sem responsável
          </DropdownMenuItem>
          <DropdownMenuItem onClick={() => onChange({ ...filters, owner: userId })}>
            Eu
          </DropdownMenuItem>
          {/*
            Humanos e agentes numa lista SÓ, ordenados juntos por nome. Não existe
            separador entre eles: separador agrupa, e agrupar comunica "as pessoas,
            e depois também os bots" — segregação por posição, que é a mesma ideia
            do badge "AI" colorido que o contrato de UI proíbe. Quem distingue é o
            avatar (disco preenchido = humano, círculo vazado com anel = agente),
            reusando o OwnerBadge do card para os dois não divergirem.
            O separador ACIMA (linha do "Eu") fica: ele divide as opções meta
            (Todos / Sem responsável / Eu) das pessoas, e ali agrupar está certo.
          */}
          {assignees.length > 0 && (
            <>
              <DropdownMenuSeparator />
              {assignees.map((a) => (
                <DropdownMenuItem key={a.key} onClick={() => onChange({ ...filters, owner: a.owner })}>
                  <OwnerBadge
                    ownerKind={a.kind}
                    ownerName={a.name}
                    agentVersion={a.version}
                  />
                </DropdownMenuItem>
              ))}
            </>
          )}
        </DropdownMenuContent>
      </DropdownMenu>

      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="outline" size="sm">
            Origem: {filters.source ? rotuloDaOrigem(filters.source) : "todas"}
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start">
          <DropdownMenuItem onClick={() => onChange({ ...filters, source: undefined })}>
            Todas
          </DropdownMenuItem>
          {ORIGENS_COMERCIAIS.map((o) => (
            <DropdownMenuItem
              key={o.value}
              onClick={() => onChange({ ...filters, source: o.value })}
            >
              {o.label}
            </DropdownMenuItem>
          ))}
        </DropdownMenuContent>
      </DropdownMenu>

      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="outline" size="sm">Status: {statusLabel}</Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start">
          {STATUS_OPTIONS.map((o) => (
            <DropdownMenuItem
              key={o.value}
              onClick={() => onChange({ ...filters, status: o.value })}
            >
              {o.label}
            </DropdownMenuItem>
          ))}
        </DropdownMenuContent>
      </DropdownMenu>

      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="outline" size="sm" disabled={tagOptions.length === 0}>
            {tagLabel}
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start">
          <DropdownMenuItem onClick={() => onChange({ ...filters, tag: undefined })}>
            Todas
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          {tagOptions.map((t) => (
            <DropdownMenuItem key={t} onClick={() => onChange({ ...filters, tag: t })}>
              {t}
            </DropdownMenuItem>
          ))}
        </DropdownMenuContent>
      </DropdownMenu>

      <Chip
        ativo={!!filters.overdueOnly}
        onChange={(v) => onChange({ ...filters, overdueOnly: v || undefined })}
      >
        Fechamento atrasado
      </Chip>

      {(filters.search ||
        filters.owner ||
        filters.tag ||
        filters.source ||
        filters.overdueOnly ||
        filters.acaoAtrasada ||
        filters.semProximaAcao ||
        filters.quentes ||
        (filters.status && filters.status !== "all")) && (
        <Button
          variant="ghost"
          size="sm"
          onClick={() => {
            setSearchInput("");
            onChange({ status: "all" });
          }}
        >
          Limpar filtros
        </Button>
      )}
    </>
  );
}

function Chip({
  ativo,
  onChange,
  children,
  testid,
}: {
  ativo: boolean;
  onChange: (v: boolean) => void;
  children: ReactNode;
  testid?: string;
}) {
  return (
    <label
      data-testid={testid}
      className={cn(
        "flex cursor-pointer select-none items-center gap-1.5 rounded-full border px-2.5 py-1 text-[12px] font-medium",
        ativo
          ? "border-transparent bg-[var(--moope-primary-bg)] text-[var(--moope-primary)]"
          : "border-[var(--color-border)] text-[var(--color-text-muted)]",
      )}
    >
      <input
        type="checkbox"
        checked={ativo}
        onChange={(e) => onChange(e.target.checked)}
        className="sr-only"
      />
      {children}
    </label>
  );
}
