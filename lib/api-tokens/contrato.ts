/**
 * Token de API que outro sistema usa para LER o CRM.
 *
 * Um token por sistema (Facejus, outro painel). Nome, validade e revogação
 * moram em `api_tokens`. Este arquivo só decide se a chave ainda serve.
 */
export const ESCOPO_LEITURA_DO_CRM = "integrations:read";

const MS_DIA = 24 * 60 * 60 * 1000;
export const VALIDADE_MAXIMA_DIAS = 1825;

export function instanteDaValidade(
  expiresOn: string | undefined,
  expiresInDays: number | undefined,
  agora = new Date(),
): { ok: true; expiresAt: string | null } | { ok: false; message: string } {
  if (expiresOn && expiresInDays !== undefined) {
    return { ok: false, message: "Informe a data de validade ou a quantidade de dias, não os dois." };
  }
  if (!expiresOn && expiresInDays === undefined) return { ok: true, expiresAt: null };

  if (expiresInDays !== undefined) {
    if (!Number.isInteger(expiresInDays) || expiresInDays < 1 || expiresInDays > VALIDADE_MAXIMA_DIAS) {
      return { ok: false, message: `A validade fica entre 1 e ${VALIDADE_MAXIMA_DIAS} dias.` };
    }
    return { ok: true, expiresAt: new Date(agora.getTime() + expiresInDays * MS_DIA).toISOString() };
  }

  if (!expiresOn || !/^\d{4}-\d{2}-\d{2}$/.test(expiresOn)) {
    return { ok: false, message: "A validade é uma data AAAA-MM-DD." };
  }
  const fim = new Date(`${expiresOn}T23:59:59.999-03:00`);
  if (Number.isNaN(fim.getTime())) return { ok: false, message: "Data de validade inválida." };
  if (fim.getTime() <= agora.getTime()) {
    return { ok: false, message: "A validade precisa ser uma data futura." };
  }
  if (fim.getTime() - agora.getTime() > VALIDADE_MAXIMA_DIAS * MS_DIA) {
    return {
      ok: false,
      message: "A validade máxima é de 5 anos. Sem data, o token vale até ser revogado.",
    };
  }
  return { ok: true, expiresAt: fim.toISOString() };
}

export function leituraAutorizada(args: {
  encontrado: boolean;
  scopes: unknown;
  revokedAt: string | null;
  expiresAt: string | null;
  agora?: Date;
}): { ok: true } | { ok: false; status: 401 | 403; message: string } {
  if (!args.encontrado) return { ok: false, status: 401, message: "Token não reconhecido." };
  if (args.revokedAt) return { ok: false, status: 401, message: "Token revogado." };
  const agora = args.agora ?? new Date();
  if (args.expiresAt && new Date(args.expiresAt).getTime() <= agora.getTime()) {
    return { ok: false, status: 401, message: "Token vencido." };
  }
  const scopes = Array.isArray(args.scopes)
    ? args.scopes.filter((s): s is string => typeof s === "string")
    : [];
  if (!scopes.includes(ESCOPO_LEITURA_DO_CRM)) {
    return {
      ok: false,
      status: 403,
      message: "Este token não tem permissão para ler o CRM. Marque essa permissão ao criar.",
    };
  }
  return { ok: true };
}
