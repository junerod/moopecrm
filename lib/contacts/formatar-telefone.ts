/**
 * Telefone só para leitura no card / lista.
 * Não inventa DDI: se não parecer BR, devolve o que o banco tem.
 */
export function formatarTelefone(raw: string | null | undefined): string | null {
  if (!raw) return null;
  const trimmed = raw.trim();
  if (!trimmed) return null;
  const d = trimmed.replace(/\D/g, "");
  if (d.length >= 12 && d.startsWith("55")) {
    const ddd = d.slice(2, 4);
    const resto = d.slice(4);
    if (resto.length === 9) return `+55 ${ddd} ${resto.slice(0, 5)}-${resto.slice(5)}`;
    if (resto.length === 8) return `+55 ${ddd} ${resto.slice(0, 4)}-${resto.slice(4)}`;
  }
  return trimmed;
}

export function iniciaisDoNome(nome: string): string {
  const parts = nome.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  if (parts.length === 1) return (parts[0] ?? "").slice(0, 2).toUpperCase();
  return `${parts[0]?.[0] ?? ""}${parts[parts.length - 1]?.[0] ?? ""}`.toUpperCase();
}
