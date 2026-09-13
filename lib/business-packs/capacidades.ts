/**
 * Catálogo amigável — só o que o código realmente registra como tool MCP.
 * Check verde = tool existe E a conexão Gestão está configurada.
 */
import { TOOLS_LOCADORA } from "@/lib/mcp/tools/catalogo/locadora";
import type { PackCapabilitySlot } from "@/lib/business-packs/tipos";

export interface CapacidadeAmigavel {
  key: string;
  label: string;
  disponivel: boolean;
  motivo?: string;
  tool_id: string | null;
  read: boolean;
  write: boolean;
}

const TOOLS_REAIS = new Set(TOOLS_LOCADORA.map((t) => t.name));

export function catalogoAmigavel(
  slots: PackCapabilitySlot[],
  gestaoConfigurada: boolean,
): CapacidadeAmigavel[] {
  return slots.map((slot) => {
    if (!slot.tool_id) {
      return {
        key: slot.key,
        label: slot.label,
        disponivel: false,
        motivo: "Não disponível nesta integração.",
        tool_id: null,
        read: slot.read,
        write: slot.write,
      };
    }
    if (!TOOLS_REAIS.has(slot.tool_id)) {
      return {
        key: slot.key,
        label: slot.label,
        disponivel: false,
        motivo: "Não disponível nesta integração.",
        tool_id: slot.tool_id,
        read: slot.read,
        write: slot.write,
      };
    }
    if (!gestaoConfigurada) {
      return {
        key: slot.key,
        label: slot.label,
        disponivel: false,
        motivo: "Conecte seu sistema de gestão para consultar dados ao vivo.",
        tool_id: slot.tool_id,
        read: slot.read,
        write: slot.write,
      };
    }
    return {
      key: slot.key,
      label: slot.label,
      disponivel: true,
      tool_id: slot.tool_id,
      read: slot.read,
      write: slot.write,
    };
  });
}

export function toolExisteNoCatalogo(toolId: string): boolean {
  return TOOLS_REAIS.has(toolId);
}
