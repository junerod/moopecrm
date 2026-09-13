/**
 * Nomes que o operador já usa no Finance / mailserver, mapeados para o
 * contrato canônico do CRM. Sem isto, `STORAGE_DRIVER=r2` e
 * `MAILSERVER_FROM=info@…` ficam no `.env` e o runtime ignora — o Knowledge
 * continua no Supabase e o e-mail cai em `not_configured`.
 *
 * Vazio é ausente (contrato do `.env` do projeto). Não adiciona chave no Zod:
 * o `env-example-sync` cobraria documentação de alias como se fosse obrigatória.
 */

export type FonteDeAliases = Record<string, string | undefined>;

function vazio(valor: string | undefined): boolean {
  return !valor || valor.trim() === "";
}

function primeiroPreenchido(
  fonte: FonteDeAliases,
  ...nomes: string[]
): string {
  for (const nome of nomes) {
    const valor = fonte[nome];
    if (!vazio(valor)) return valor!.trim();
  }
  return "";
}

function accountIdDoEndpoint(endpoint: string): string {
  const m = endpoint
    .trim()
    .match(/^https?:\/\/([a-f0-9]{8,})\.r2\.cloudflarestorage\.com/i);
  return m?.[1] ?? "";
}

/**
 * Devolve um mapa novo. Não muta a fonte — testes passam objeto literal.
 */
export function aliasesDeEnv(fonte: FonteDeAliases): FonteDeAliases {
  const out: FonteDeAliases = { ...fonte };

  if (vazio(out.MAILSERVER_FROM_EMAIL)) {
    const from = primeiroPreenchido(
      fonte,
      "MAILSERVER_FROM",
      "MAIL_FROM",
      "MAIL_FROM_NOREPLY",
    );
    if (from) out.MAILSERVER_FROM_EMAIL = from;
  }

  if (vazio(out.MAILSERVER_URL)) {
    const url = primeiroPreenchido(fonte, "MOOPE_MAIL_URL", "MOOPE_MAILSERVER_URL");
    if (url) out.MAILSERVER_URL = url;
  }

  if (vazio(out.MAILSERVER_API_KEY)) {
    const key = primeiroPreenchido(fonte, "MOOPE_API_KEY", "MOOPE_MAILSERVER_API_KEY");
    if (key) out.MAILSERVER_API_KEY = key;
  }

  if (vazio(out.KNOWLEDGE_STORAGE_PROVIDER)) {
    const driver = primeiroPreenchido(fonte, "STORAGE_DRIVER");
    if (driver) out.KNOWLEDGE_STORAGE_PROVIDER = driver;
  }

  if (vazio(out.R2_BUCKET_KNOWLEDGE)) {
    const bucket = primeiroPreenchido(fonte, "R2_BUCKET");
    if (bucket) out.R2_BUCKET_KNOWLEDGE = bucket;
  }

  if (vazio(out.R2_ACCOUNT_ID) && !vazio(out.R2_ENDPOINT)) {
    const id = accountIdDoEndpoint(out.R2_ENDPOINT ?? "");
    if (id) out.R2_ACCOUNT_ID = id;
  }

  return out;
}

/** Aplica no `process.env` antes do Zod parse. Só preenche o que ainda está vazio. */
export function aplicarAliasesDeEnv(env: FonteDeAliases = process.env): void {
  const aplicados = aliasesDeEnv(env);
  for (const chave of [
    "MAILSERVER_FROM_EMAIL",
    "MAILSERVER_URL",
    "MAILSERVER_API_KEY",
    "KNOWLEDGE_STORAGE_PROVIDER",
    "R2_BUCKET_KNOWLEDGE",
    "R2_ACCOUNT_ID",
  ] as const) {
    const valor = aplicados[chave];
    if (vazio(env[chave]) && !vazio(valor)) {
      env[chave] = valor;
    }
  }
}
