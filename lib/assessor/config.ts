/**
 * Quando avisar o WhatsApp do Meu Assessor.
 * Só a primeira mensagem de entrada da conversa — cliente novo, não cada "ok".
 */
export function deveAvisarAssessor(input: {
  enabled: boolean;
  phone: string | null | undefined;
  inboundCount: number;
}): boolean {
  const phone = (input.phone || "").replace(/\D/g, "");
  return input.enabled && phone.length >= 10 && input.inboundCount === 1;
}

export type AssessorOrgConfig = {
  enabled: boolean;
  phone: string;
};

/** Quem acompanha o fluxo comercial da MOOPE — sempre, além do número da tela. */
export const EMAIL_FLUXO_COMERCIAL = "comercial@moope.com.br";

export const DESTINOS_FLUXO_COMERCIAL = [
  "+5531984246434",
  "+5561996715985",
] as const;

const LINHAS_MOOPE = [
  { sufixo: "61994114879", rotulo: "SUPORTE", display: "+55 61 99411-4879" },
  { sufixo: "61992089343", rotulo: "COMERCIAL", display: "+55 61 99208-9343" },
] as const;

export function ehFluxoComercialMoope(emails: string[]): boolean {
  return emails.some((e) => e.trim().toLowerCase() === EMAIL_FLUXO_COMERCIAL);
}

export function rotuloDaLinha(phone: string | null | undefined): {
  rotulo: string;
  display: string;
} | null {
  const digits = (phone || "").replace(/\D/g, "");
  if (!digits) return null;
  const hit = LINHAS_MOOPE.find((l) => digits.endsWith(l.sufixo));
  return hit ? { rotulo: hit.rotulo, display: hit.display } : null;
}

/** Comercial MOOPE: Tatiana + DEV, mais o número da tela se for outro. Demais orgs: só o da tela. */
export function destinatariosDoAviso(input: {
  fluxoComercial: boolean;
  phoneConfigurado: string | null | undefined;
  enabled: boolean;
}): string[] {
  const cfg = (input.phoneConfigurado || "").trim();
  const cfgDigits = cfg.replace(/\D/g, "");
  if (!input.fluxoComercial) {
    return input.enabled && cfgDigits.length >= 10 ? [cfg] : [];
  }
  const lista: string[] = [...DESTINOS_FLUXO_COMERCIAL];
  if (input.enabled && cfgDigits.length >= 10) {
    const ja = lista.some((p) => p.replace(/\D/g, "").endsWith(cfgDigits.slice(-11)));
    if (!ja) lista.push(cfg);
  }
  return lista;
}

export function lerAssessorNasSettings(settings: unknown): AssessorOrgConfig {
  const bag = settings && typeof settings === "object" ? (settings as Record<string, unknown>) : {};
  const raw = bag.assessor;
  const box = raw && typeof raw === "object" ? (raw as Record<string, unknown>) : {};
  return {
    enabled: box.enabled === true,
    phone: typeof box.phone === "string" ? box.phone : "",
  };
}
