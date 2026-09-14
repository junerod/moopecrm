import {
  ehSelecaoDeCanais,
  OBJETIVOS_DA_CAMPANHA,
  PRESETS_DE_CONTEUDO,
  type AnexoDaCampanha,
  type ObjetivoDaCampanha,
  type PresetDeConteudo,
  type SelecaoDeCanais,
  type SettingsDaCampanha,
  type StatusDaCampanha,
  type StatusVisualDaCampanha,
} from "@/lib/campanhas/tipos";

export function lerSettings(bruto: unknown): SettingsDaCampanha {
  if (!bruto || typeof bruto !== "object") return {};
  const o = bruto as Record<string, unknown>;
  const objective = OBJETIVOS_DA_CAMPANHA.includes(o.objective as ObjetivoDaCampanha)
    ? (o.objective as ObjetivoDaCampanha)
    : null;
  const channels = ehSelecaoDeCanais(String(o.channels ?? ""))
    ? (o.channels as SelecaoDeCanais)
    : "whatsapp";
  const content_preset = PRESETS_DE_CONTEUDO.includes(o.content_preset as PresetDeConteudo)
    ? (o.content_preset as PresetDeConteudo)
    : "aviso";
  const attachments = Array.isArray(o.attachments)
    ? (o.attachments as AnexoDaCampanha[]).filter(
        (a) => a && typeof a.storage_path === "string" && typeof a.mime === "string",
      )
    : [];
  return {
    objective,
    channels,
    attachments,
    content_preset,
    preparing: o.preparing === true,
    materializing: o.materializing === true,
    confirm_all_base: o.confirm_all_base === true,
    confirm_large: o.confirm_large === true,
    message_template_id:
      typeof o.message_template_id === "string" ? o.message_template_id : null,
    cta_url: typeof o.cta_url === "string" ? o.cta_url : null,
    cta_label: typeof o.cta_label === "string" ? o.cta_label : null,
    timezone: typeof o.timezone === "string" ? o.timezone : null,
    somente_conversa_existente: o.somente_conversa_existente === true,
  };
}

export function statusVisual(
  status: StatusDaCampanha,
  settings: SettingsDaCampanha,
): StatusVisualDaCampanha {
  if (status === "draft" && (settings.preparing || settings.materializing)) return "preparing";
  return status;
}

export function mesclarSettings(
  atual: SettingsDaCampanha,
  patch: Partial<SettingsDaCampanha>,
): SettingsDaCampanha {
  return { ...atual, ...patch };
}
