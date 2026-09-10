/**
 * Origens que o comercial da MOOPE precisa distinguir no funil.
 * O banco já tem `crm_leads.source` (text); isto é só o vocabulário da UI.
 */
export const ORIGENS_COMERCIAIS = [
  { value: "instagram", label: "Instagram" },
  { value: "whatsapp", label: "WhatsApp" },
  { value: "site", label: "Site" },
  { value: "indicacao", label: "Indicação" },
  { value: "prospeccao", label: "Prospecção" },
  { value: "manual", label: "Outro" },
] as const;

export type OrigemComercial = (typeof ORIGENS_COMERCIAIS)[number]["value"];

export function rotuloDaOrigem(source: string | null | undefined): string {
  if (!source) return "—";
  const hit = ORIGENS_COMERCIAIS.find((o) => o.value === source);
  if (hit) return hit.label;
  if (source === "moope") return "MOOPE";
  if (source === "import_csv") return "Importado";
  return source;
}
