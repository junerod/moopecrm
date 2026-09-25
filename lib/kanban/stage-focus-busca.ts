/** Filtro local da etapa em tela cheia — puro, sem DOM. */
export function bateBuscaDaEtapa(
  lead: {
    title: string;
    contato?: { display_name?: string | null; phone_number?: string | null } | null;
  },
  query: string,
): boolean {
  const q = query.trim().toLowerCase();
  if (!q) return true;
  const telefone = lead.contato?.phone_number ?? "";
  const hay =
    `${lead.title} ${lead.contato?.display_name ?? ""} ${telefone}`.toLowerCase();
  return hay.includes(q);
}
