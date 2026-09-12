/**
 * Ficha comercial da organização — o que Meu Negócio lê e grava.
 *
 * Mora em `organizations.settings.empresa`, não em coluna: telefone, site e
 * endereço não entram em query quente. O merge NÃO pode apagar branding, crm
 * nem lost_reasons_extra — uma escrita que substitui o jsonb inteiro já
 * apagou configuração de outra tela neste repo.
 */
import {
  empresaContatoSchema,
  type EmpresaContato,
} from "@/lib/schemas/settings";

export const EMPRESA_VAZIA: EmpresaContato = {
  telefone: null,
  site: null,
  endereco: null,
};

export function lerEmpresaDoSettings(settings: unknown): EmpresaContato {
  if (!settings || typeof settings !== "object") return { ...EMPRESA_VAZIA };
  const bruto = (settings as { empresa?: unknown }).empresa;
  const lido = empresaContatoSchema.safeParse(bruto ?? {});
  if (!lido.success) return { ...EMPRESA_VAZIA };
  return {
    telefone: lido.data.telefone ?? null,
    site: lido.data.site ?? null,
    endereco: lido.data.endereco ?? null,
  };
}

export function mesclarSettingsEmpresa(
  atuais: Record<string, unknown>,
  empresa: EmpresaContato,
): Record<string, unknown> {
  return {
    ...atuais,
    empresa: {
      telefone: empresa.telefone ?? null,
      site: empresa.site ?? null,
      endereco: empresa.endereco ?? null,
    },
  };
}

export function iniciaisDoNome(nome: string): string {
  const partes = nome.trim().split(/\s+/).filter(Boolean);
  if (partes.length === 0) return "?";
  if (partes.length === 1) return partes[0]!.slice(0, 2).toUpperCase();
  return `${partes[0]![0]!}${partes[partes.length - 1]![0]!}`.toUpperCase();
}
