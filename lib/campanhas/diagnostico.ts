import { isEmailConfigured } from "@/lib/email/resend";
import {
  campanhaComercialPermitidaPelasCaps,
  campanhaExigeTemplatePelasCaps,
} from "@/lib/channels/campaign-send";
import { capabilitiesOf } from "@/lib/channels/capabilities";
import type { ChannelProvider } from "@/lib/channels/types";

export type ModoDoDispatch = "auto" | "mock" | "real";
export type ViaDoCanal = "real" | "mock" | "indisponivel";

export function lerModoDoDispatch(env: NodeJS.ProcessEnv = process.env): ModoDoDispatch {
  const raw = (env.CAMPAIGN_DISPATCH_ADAPTER ?? "").trim().toLowerCase();
  if (raw === "mock") return "mock";
  if (raw === "real") return "real";
  return "auto";
}

export function viaDoWhatsapp(input: {
  modo: ModoDoDispatch;
  provider: ChannelProvider | null;
  templateId?: string | null;
  adapterConfigured?: boolean;
}): ViaDoCanal {
  if (input.modo === "mock") return "mock";
  if (!input.provider) {
    return input.modo === "real" ? "indisponivel" : "mock";
  }
  const caps = capabilitiesOf(input.provider);
  if (caps.banRisk) {
    if (input.adapterConfigured === false) {
      return input.modo === "real" ? "indisponivel" : "mock";
    }
    return "real";
  }
  if (!campanhaComercialPermitidaPelasCaps(input.provider)) return "indisponivel";
  if (campanhaExigeTemplatePelasCaps(input.provider) && !input.templateId) {
    return "indisponivel";
  }
  if (input.adapterConfigured === false) {
    return input.modo === "real" ? "indisponivel" : "mock";
  }
  if (input.modo === "real") return "real";
  return input.adapterConfigured ? "real" : "mock";
}

export function viaDoEmail(input: { modo: ModoDoDispatch; configurado?: boolean }): ViaDoCanal {
  const ok = input.configurado ?? isEmailConfigured();
  if (input.modo === "mock") return "mock";
  if (input.modo === "real") return ok ? "real" : "indisponivel";
  return ok ? "real" : "mock";
}

export function diagnosticoDeDispatch(input: {
  provider: ChannelProvider | null;
  templateId?: string | null;
  adapterConfigured?: boolean;
}): {
  campaign_dispatch_real: boolean;
  whatsapp: ViaDoCanal;
  email: ViaDoCanal;
  modo: ModoDoDispatch;
} {
  const modo = lerModoDoDispatch();
  const whatsapp = viaDoWhatsapp({
    modo,
    provider: input.provider,
    templateId: input.templateId,
    adapterConfigured: input.adapterConfigured,
  });
  const email = viaDoEmail({ modo });
  return {
    modo,
    whatsapp,
    email,
    campaign_dispatch_real: whatsapp === "real" || email === "real",
  };
}
