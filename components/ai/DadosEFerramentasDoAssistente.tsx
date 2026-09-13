import type { CapacidadeAmigavel } from "@/lib/business-packs/capacidades";

function rotuloStatus(c: CapacidadeAmigavel): string {
  if (c.disponivel) return "Disponível";
  if (c.tool_id) return "Não conectado";
  return "Não disponível";
}

export function DadosEFerramentasDoAssistente({
  capacidades,
}: {
  capacidades: CapacidadeAmigavel[];
}) {
  if (capacidades.length === 0) {
    return (
      <p className="text-sm text-muted-foreground" data-testid="dados-e-ferramentas">
        Este assistente ainda não consulta dados operacionais. Quando você conectar o sistema
        de gestão, as consultas aparecem aqui com nomes simples — clientes, locações,
        financeiro.
      </p>
    );
  }

  return (
    <ul className="grid gap-2 sm:grid-cols-2" data-testid="dados-e-ferramentas">
      {capacidades.map((c) => (
        <li
          key={c.key}
          className="rounded-xl border border-[var(--color-border)] px-3 py-2 text-sm"
        >
          <p className="font-medium">{c.label}</p>
          <p className="text-xs text-muted-foreground">{rotuloStatus(c)}</p>
          {!c.disponivel && c.motivo ? (
            <p className="text-xs text-muted-foreground">{c.motivo}</p>
          ) : null}
        </li>
      ))}
    </ul>
  );
}
