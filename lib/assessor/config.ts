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

export type AssessorContact = {
  id: string;
  name: string;
  phone: string;
  leadEnabled: boolean;
  replyEnabled: boolean;
};

export type AssessorOrgConfig = {
  /** Algum contato recebe alerta de lead. Espelho do primeiro, para leitores antigos. */
  enabled: boolean;
  /** Algum contato recebe alerta de resposta. */
  replyEnabled: boolean;
  /** Primeiro telefone da lista. Leitores antigos ainda olham este campo. */
  phone: string;
  contacts: AssessorContact[];
};

const MAX_CONTATOS = 12;

function soDigitos(phone: string): string {
  return phone.replace(/\D/g, "");
}

function idDoTelefone(phone: string, id?: string): string {
  const informado = (id || "").trim();
  if (informado) return informado.slice(0, 40);
  return `legado-${soDigitos(phone).slice(-11)}`;
}

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

function telefonesValidos(phones: string[]): string[] {
  const lista: string[] = [];
  for (const raw of phones) {
    const phone = raw.trim();
    if (soDigitos(phone).length < 10) continue;
    const ja = lista.some((p) => soDigitos(p).endsWith(soDigitos(phone).slice(-11)));
    if (!ja) lista.push(phone);
  }
  return lista;
}

/**
 * Comercial MOOPE: Tatiana + DEV, mais cada número com alerta de lead.
 * Demais orgs: só quem está com alerta de lead.
 */
export function destinatariosDoAviso(input: {
  fluxoComercial: boolean;
  phoneConfigurado?: string | null | undefined;
  enabled?: boolean;
  phones?: string[];
}): string[] {
  const extras =
    input.phones && input.phones.length
      ? telefonesValidos(input.phones)
      : input.enabled && input.phoneConfigurado
        ? telefonesValidos([input.phoneConfigurado])
        : [];
  if (!input.fluxoComercial) return extras;
  return telefonesValidos([...DESTINOS_FLUXO_COMERCIAL, ...extras]);
}

/** Quem ligou o alerta de resposta. Não inclui os números fixos do comercial. */
export function destinatariosDaResposta(contacts: AssessorContact[]): string[] {
  return telefonesValidos(contacts.filter((c) => c.replyEnabled).map((c) => c.phone));
}

/**
 * Queda do WhatsApp: avisa quem está na lista, não só quem ligou lead/resposta.
 * Sem gente na lista, o comercial da MOOPE ainda recebe pelos números fixos.
 */
export function destinatariosDaQueda(contacts: AssessorContact[]): string[] {
  return telefonesValidos(contacts.map((c) => c.phone));
}

/** Oscilação de rede não vira Zap. Queda de verdade e chave recusada, sim. */
export function deveAvisarQueda(episodio: string | null | undefined): boolean {
  const e = (episodio ?? "").trim();
  return Boolean(e) && e !== "UNREACHABLE";
}

export function deveAvisarResposta(input: {
  replyEnabled: boolean;
  phone: string | null | undefined;
  inboundCount: number;
  anteriorEraNosso: boolean;
}): boolean {
  const phone = (input.phone || "").replace(/\D/g, "");
  return (
    input.replyEnabled &&
    phone.length >= 10 &&
    input.inboundCount > 1 &&
    input.anteriorEraNosso
  );
}

function lerContatos(box: Record<string, unknown>): AssessorContact[] {
  if (!Array.isArray(box.contacts)) return [];
  const lista: AssessorContact[] = [];
  for (const raw of box.contacts) {
    if (!raw || typeof raw !== "object") continue;
    const c = raw as Record<string, unknown>;
    const phone = typeof c.phone === "string" ? c.phone.trim() : "";
    if (soDigitos(phone).length < 10) continue;
    const name = typeof c.name === "string" ? c.name.trim().slice(0, 80) : "";
    lista.push({
      id: idDoTelefone(phone, typeof c.id === "string" ? c.id : ""),
      name,
      phone,
      leadEnabled: c.lead_enabled === true || c.leadEnabled === true,
      replyEnabled: c.reply_enabled === true || c.replyEnabled === true,
    });
    if (lista.length >= MAX_CONTATOS) break;
  }
  return telefonesUnicos(lista);
}

function telefonesUnicos(contacts: AssessorContact[]): AssessorContact[] {
  const lista: AssessorContact[] = [];
  for (const c of contacts) {
    const chave = soDigitos(c.phone).slice(-11);
    if (lista.some((p) => soDigitos(p.phone).slice(-11) === chave)) continue;
    lista.push(c);
  }
  return lista;
}

function resumo(contacts: AssessorContact[]): Pick<AssessorOrgConfig, "enabled" | "replyEnabled" | "phone"> {
  return {
    enabled: contacts.some((c) => c.leadEnabled),
    replyEnabled: contacts.some((c) => c.replyEnabled),
    phone: contacts[0]?.phone ?? "",
  };
}

export function lerAssessorNasSettings(settings: unknown): AssessorOrgConfig {
  const bag = settings && typeof settings === "object" ? (settings as Record<string, unknown>) : {};
  const raw = bag.assessor;
  const box = raw && typeof raw === "object" ? (raw as Record<string, unknown>) : {};
  const daLista = lerContatos(box);
  if (daLista.length) return { ...resumo(daLista), contacts: daLista };

  const phone = typeof box.phone === "string" ? box.phone : "";
  const enabled = box.enabled === true;
  const replyEnabled = box.reply_enabled === true;
  const legado = soDigitos(phone).length >= 10
    ? [{
        id: idDoTelefone(phone),
        name: "",
        phone,
        leadEnabled: enabled,
        replyEnabled,
      }]
    : [];
  return { enabled, replyEnabled, phone, contacts: legado };
}

/** Grava a lista e o espelho antigo (phone / enabled / reply_enabled). */
export function blocoAssessor(contacts: AssessorContact[]): Record<string, unknown> {
  const lista = telefonesUnicos(
    contacts
      .map((c) => ({
        id: idDoTelefone(c.phone, c.id),
        name: c.name.trim().slice(0, 80),
        phone: c.phone.trim(),
        leadEnabled: c.leadEnabled,
        replyEnabled: c.replyEnabled,
      }))
      .filter((c) => soDigitos(c.phone).length >= 10),
  ).slice(0, MAX_CONTATOS);
  const topo = resumo(lista);
  return {
    phone: topo.phone,
    enabled: topo.enabled,
    reply_enabled: topo.replyEnabled,
    contacts: lista.map((c) => ({
      id: c.id,
      name: c.name,
      phone: c.phone,
      lead_enabled: c.leadEnabled,
      reply_enabled: c.replyEnabled,
    })),
  };
}
