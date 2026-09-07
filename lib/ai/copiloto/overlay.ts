/**
 * Overlay do Copilot — dado copiado no funil, não ramo no runtime.
 * O mesmo copilot_turn; nenhuma branch por Ready Model.
 */
import type { Queryable } from "@/lib/agent-engine/queue/queue";
export interface OverlayDoCopiloto {
  instruction: string | null;
  fieldKeys: string[];
  fieldLabels: Array<{ key: string; label: string }>;
}

export async function carregarOverlayDoFunilPadrao(
  db: Queryable,
  organizationId: string,
): Promise<OverlayDoCopiloto> {
  const { rows } = await db.query<{ settings: unknown }>(
    `select settings from crm_pipelines
      where organization_id = $1 and is_default = true and coalesce(is_archived, false) = false
      limit 1`,
    [organizationId],
  );
  return overlayDoPipeline(rows[0]?.settings);
}

export function overlayDoPipeline(settings: unknown): OverlayDoCopiloto {
  if (!settings || typeof settings !== "object") {
    return { instruction: null, fieldKeys: [], fieldLabels: [] };
  }
  const s = settings as {
    copilot_overlay?: { instruction?: unknown };
    fields?: unknown;
  };
  const instruction =
    typeof s.copilot_overlay?.instruction === "string" && s.copilot_overlay.instruction.trim()
      ? s.copilot_overlay.instruction.trim()
      : null;
  const fieldLabels: Array<{ key: string; label: string }> = [];
  if (Array.isArray(s.fields)) {
    for (const raw of s.fields) {
      if (!raw || typeof raw !== "object") continue;
      const key = (raw as { key?: unknown }).key;
      const label = (raw as { label?: unknown }).label;
      if (typeof key === "string" && key.length > 0) {
        fieldLabels.push({
          key,
          label: typeof label === "string" && label.length > 0 ? label : key,
        });
      }
    }
  }
  return {
    instruction,
    fieldKeys: fieldLabels.map((f) => f.key),
    fieldLabels,
  };
}

export function montarSystemDoCopiloto(base: string, overlay: OverlayDoCopiloto): string {
  const partes = [base];
  if (overlay.instruction) partes.push(overlay.instruction);
  if (overlay.fieldLabels.length > 0) {
    const lista = overlay.fieldLabels.map((f) => `${f.key} (${f.label})`).join(", ");
    partes.push(
      `extractedFields só pode usar estas chaves: ${lista}. ` +
        "Se a conversa não informou o valor, omita a chave. Não invente campo.",
    );
  }
  return partes.join(" ");
}

export function filtrarCamposExtraidos(
  extracted: Record<string, string>,
  keysConhecidas: string[],
): Record<string, string> {
  if (keysConhecidas.length === 0) return {};
  const permitidas = new Set(keysConhecidas);
  const saida: Record<string, string> = {};
  for (const [k, v] of Object.entries(extracted)) {
    if (!permitidas.has(k)) continue;
    if (typeof v !== "string" || v.trim().length === 0) continue;
    saida[k] = v;
  }
  return saida;
}
